import 'server-only';
import { Redis } from '@upstash/redis';

/**
 * Phase 6 A0 — 运营钱包全局串行锁
 *
 * material / score / airdrop 三条 cron 共用同一个 EOA（operatorWalletClient）。
 * 任意两条 cron 同分钟发 tx → nonce race（后发可能 replace 前一笔 / RPC 拒绝 / 互相覆盖）。
 *
 * 实现：Upstash Redis SETNX 分布式锁，30 秒 TTL（cron 单次执行 < 5 秒，留余量）。
 * 释放用 Lua 脚本 GET-then-DEL，避免 lease 过期后误删别人的锁。
 *
 * 本地开发（无 UPSTASH env）→ console.warn + 直接放行（不阻塞开发）。
 */

const LOCK_KEY = 'op_wallet_lock';
const LEASE_MS = 30_000;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  // .env.local 里的引号兼容（Phase 5 Upstash 初始化容错经验）
  redis = new Redis({
    url: url.replace(/^["']+|["']+$/g, '').trim(),
    token: token.replace(/^["']+|["']+$/g, '').trim(),
  });
  return redis;
}

/**
 * 尝试拿锁。返回 true = 拿到了；false = 被别人占用。
 * holder 必须每次调用唯一（推荐 `${cron-name}-${randomUUID()}`），
 * 用于 release 时校验只删自己的锁。
 */
export async function acquireOpLock(holder: string): Promise<boolean> {
  const r = getRedis();
  if (!r) {
    console.warn('[op-lock] Upstash 未配置，无法加锁，跳过（仅限本地开发）');
    return true;
  }
  const result = await r.set(LOCK_KEY, holder, { nx: true, px: LEASE_MS });
  return result === 'OK';
}

/**
 * 释放锁。Lua 脚本保证只删自己的锁（即使 lease 过期了被别人拿走也不会误删）。
 * 静默失败（finally 里调用，不能 throw 影响业务返回）。
 */
export async function releaseOpLock(holder: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.eval(
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
      [LOCK_KEY],
      [holder],
    );
  } catch (err) {
    console.error('[op-lock] release failed (lease 可能已过期，无副作用):', err);
  }
}

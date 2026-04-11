// Arweave 核心工具：多网关 fallback + 上传占位
// 本文件不带 'server-only'，以便 scripts/ 在 tsx 下 import 同一份逻辑。
// Next.js 运行时请统一从 '@/lib/arweave' (index.ts) 引入——那里有 server-only 守护。

// 多网关 fallback 列表，顺序即优先级
// 硬门槛（playbook S0）：上线前至少 2 个网关 CORS 实测通过
export const ARWEAVE_GATEWAYS = [
  'https://arweave.net',
  'https://ar-io.dev',
  'https://arweave.dev',
  'https://gateway.irys.xyz',
] as const;

export type ArweaveGateway = (typeof ARWEAVE_GATEWAYS)[number];

const TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/;

/**
 * 把 Arweave txId 拼成可访问的 HTTPS URL。
 * @param txId Arweave 交易 ID（43 位 base64url 字符）
 * @param gateway 可选网关，默认取主网关
 */
export function resolveArUrl(
  txId: string,
  gateway: ArweaveGateway = ARWEAVE_GATEWAYS[0],
): string {
  if (!TX_ID_RE.test(txId)) {
    throw new Error(`Invalid Arweave txId: ${txId}`);
  }
  return `${gateway}/${txId}`;
}

/**
 * 从 Arweave 下载文件——依次尝试所有网关，任何一个成功即返回。
 * 所有网关都失败时抛错，把每个网关的失败原因拼在一起便于排查。
 */
export async function fetchFromArweave(txId: string): Promise<Buffer> {
  if (!TX_ID_RE.test(txId)) {
    throw new Error(`Invalid Arweave txId: ${txId}`);
  }
  const errors: string[] = [];
  for (const gw of ARWEAVE_GATEWAYS) {
    try {
      const res = await fetch(`${gw}/${txId}`);
      if (!res.ok) {
        errors.push(`${gw}: HTTP ${res.status}`);
        continue;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      errors.push(`${gw}: ${(e as Error).message}`);
    }
  }
  throw new Error(
    `All Arweave gateways failed for ${txId}:\n${errors.join('\n')}`,
  );
}

export type UploadResult = { txId: string; url: string };

/**
 * 把 buffer 上传到 Arweave，返回 { txId, url }。
 *
 * ⚠️ Phase 3 S0.a：故意 throw NOT_FUNDED 防止未充值时误发上传。
 * 用户在 S0.b 充值 Turbo credits → 配置 ARWEAVE_JWK_PATH → 回到本函数把
 * 下面三行换成真实的 @ardrive/turbo-sdk 调用即可。函数签名不变。
 */
export async function uploadBuffer(
  _buffer: Buffer,
  _contentType: string,
): Promise<UploadResult> {
  throw new Error(
    'ARWEAVE_NOT_FUNDED: Turbo credits 尚未配置。' +
      'S0.b pending — 用户充值 Turbo → 设置 ARWEAVE_JWK_PATH → 激活 uploadBuffer 实现',
  );
}

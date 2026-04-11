// 轮询 Turbo 钱包在 Base 链上的 ETH 余额，到账后退出
// 用法：npx tsx scripts/arweave/wait-for-base-eth.ts
// 前置：.env.local 有 TURBO_WALLET_PATH（由 generate-eth-wallet.ts 生成）
//
// 使用时机：每次你用 MetaMask 转 ETH 到 Turbo 钱包后跑这个脚本确认到账
// 间隔 5s，超时 15min

import '../_env';
import { readFileSync } from 'node:fs';
import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';

const POLL_MS = 5000;
const TIMEOUT_MS = 15 * 60 * 1000;

type Wallet = { address: `0x${string}`; token: string };

async function main() {
  const path = process.env.TURBO_WALLET_PATH;
  if (!path) throw new Error('TURBO_WALLET_PATH 未配置（检查 .env.local）');
  const wallet = JSON.parse(readFileSync(path, 'utf-8')) as Wallet;

  const client = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL),
  });

  console.log(`轮询地址：${wallet.address}`);
  console.log(`RPC     ：${process.env.BASE_RPC_URL ?? 'https://mainnet.base.org (public)'}`);
  console.log(`间隔    ：${POLL_MS / 1000}s  超时：${TIMEOUT_MS / 60000}min\n`);

  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < TIMEOUT_MS) {
    try {
      const balance = await client.getBalance({ address: wallet.address });
      if (balance > 0n) {
        console.log(`\n✅ 到账！余额 ${formatEther(balance)} ETH`);
        console.log('\n下一步：npx tsx scripts/arweave/topup-turbo.ts');
        return;
      }
      const elapsed = Math.floor((Date.now() - start) / 1000);
      if (elapsed - lastLog >= 15) {
        console.log(`[${elapsed}s] 余额仍为 0，继续等待...`);
        lastLog = elapsed;
      }
    } catch (e) {
      console.error('⚠️ RPC 错误:', (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('超时未到账（15 min）');
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});

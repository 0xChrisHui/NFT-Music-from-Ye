// 用 Base 链 ETH 换 Turbo credits
// 用法：npx tsx scripts/arweave/topup-turbo.ts [tokenAmountWei]
// 不传金额：用钱包当前余额的 90%（留 10% 作 gas）
// 前置：.env.local 有 TURBO_WALLET_PATH，钱包里已有 Base ETH
//
// 使用时机：wait-for-base-eth 确认 ETH 到账后跑这个换 credits
// 流程：发送链上 tx → 轮询 Turbo API → credits 入账后退出

import '../_env';
import { readFileSync } from 'node:fs';
import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { TurboFactory } from '@ardrive/turbo-sdk';

type Wallet = {
  address: `0x${string}`;
  privateKey: `0x${string}`;
  token: 'base-eth';
};

const CREDITS_POLL_MS = 3000;
const CREDITS_TIMEOUT_MS = 5 * 60 * 1000;

async function main() {
  const path = process.env.TURBO_WALLET_PATH;
  if (!path) throw new Error('TURBO_WALLET_PATH 未配置（检查 .env.local）');
  const wallet = JSON.parse(readFileSync(path, 'utf-8')) as Wallet;
  if (wallet.token !== 'base-eth') {
    throw new Error(`期望 token=base-eth，实际 ${wallet.token}`);
  }

  const pub = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL),
  });
  const balance = await pub.getBalance({ address: wallet.address });
  if (balance === 0n) {
    throw new Error('钱包余额为 0，先跑 npx tsx scripts/arweave/wait-for-base-eth.ts');
  }
  console.log(`当前余额：${formatEther(balance)} ETH`);

  const amount = process.argv[2] ? BigInt(process.argv[2]) : (balance * 9n) / 10n;
  console.log(`充值金额：${formatEther(amount)} ETH`);
  console.log(`留作 gas：${formatEther(balance - amount)} ETH\n`);

  const client = TurboFactory.authenticated({
    privateKey: wallet.privateKey,
    token: 'base-eth',
  });

  const before = await client.getBalance();
  console.log(`充值前 winc: ${before.winc}`);
  console.log('发送链上 tx...');

  const result = await client.topUpWithTokens({ tokenAmount: amount.toString() });
  console.log(`\n✅ tx 已发送`);
  console.log(`   tx id  : ${result.id}`);
  console.log(`   status : ${result.status}`);
  console.log(`   winc   : ${result.winc}\n`);

  console.log('轮询 Turbo 余额等 credits 到账...');
  const start = Date.now();
  while (Date.now() - start < CREDITS_TIMEOUT_MS) {
    const b = await client.getBalance();
    if (BigInt(b.winc) > BigInt(before.winc)) {
      console.log(`\n✅ credits 到账！`);
      console.log(`   winc           : ${b.winc}`);
      console.log(`   controlledWinc : ${b.controlledWinc}`);
      console.log(`   effective      : ${b.effectiveBalance}`);
      console.log('\n下一步：可以跑 upload-sounds.ts / upload-tracks.ts 了');
      return;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, CREDITS_POLL_MS));
  }
  throw new Error('credits 到账超时（5 min）。tx 已发，稍后重跑本脚本或手动查 getBalance');
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});

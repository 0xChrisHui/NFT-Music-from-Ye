import '../../_env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createPublicClient, createWalletClient, decodeEventLog, getAddress, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimismSepolia } from 'viem/chains';
import { SCORE_NFT_ABI, SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';

const labels = new Set(['W0', 'W1', 'W2', 'W3']);
const label = process.argv[2];
if (!label || !labels.has(label)) throw new Error('用法：mint-score.ts <W0|W1|W2|W3>');
if (process.env.NEXT_PUBLIC_CHAIN_ID !== '11155420') throw new Error('只允许 OP Sepolia');

const state = JSON.parse(readFileSync(
  join(homedir(), '.config', 'ripples-in-the-pond', 'p14-testnet-wallets.json'), 'utf8',
)) as { chainId: number; wallets: Record<string, `0x${string}`> };
if (state.chainId !== 11155420) throw new Error('测试钱包链错误');
const recipient = privateKeyToAccount(state.wallets[label]).address;
const contract = getAddress(SCORE_NFT_ADDRESS);
const account = privateKeyToAccount(process.env.OPERATOR_PRIVATE_KEY as `0x${string}`);
const transport = http(process.env.ALCHEMY_RPC_URL);
const operatorWalletClient = createWalletClient({ account, chain: optimismSepolia, transport });
const publicClient = createPublicClient({ chain: optimismSepolia, transport });

async function main() {
  const hash = await operatorWalletClient.writeContract({
    address: contract, abi: SCORE_NFT_ABI, functionName: 'mint', args: [recipient],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 20 });
  const transfer = receipt.logs.map((log) => {
    try { return decodeEventLog({ abi: SCORE_NFT_ABI, data: log.data, topics: log.topics }); }
    catch { return null; }
  }).find((event) => event?.eventName === 'Transfer');
  if (!transfer || transfer.eventName !== 'Transfer' || transfer.args.to !== recipient) {
    throw new Error('Score mint receipt 缺少目标 Transfer');
  }
  console.log(JSON.stringify({
    label, recipient, tokenId: transfer.args.tokenId.toString(), hash,
    blockNumber: receipt.blockNumber.toString(), confirmations: 20,
  }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

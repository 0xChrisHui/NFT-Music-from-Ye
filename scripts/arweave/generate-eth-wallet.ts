// 本地生成专用 ETH 钱包（Turbo Base 链 credits 用）
// 用法：npx tsx scripts/arweave/generate-eth-wallet.ts [output-path]
// 默认路径：~/.ripples-secrets/turbo-wallet.json
//
// ⚠️ 本脚本是真一次性：钱包只建一次，S0.b 跑完后会被 git rm
//    未来如需参考，翻 git 历史。
//
// 安全约束：
// 1. 拒绝写入项目目录（gitignore 规则失效时依然挡得住）
// 2. 拒绝覆盖已存在文件（避免误覆盖已充值钱包）
// 3. 文件权限 0o600（Unix 下生效，Windows 下靠 NTFS ACL）
// 4. 绝不把私钥内容输出到终端（只打印地址 + 文件路径）

import '../_env';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_PATH = resolve(homedir(), '.ripples-secrets', 'turbo-wallet.json');
const PROJECT_ROOT = process.cwd();

function assertSafePath(path: string): void {
  const abs = resolve(path);
  const normalizedProject = PROJECT_ROOT.toLowerCase();
  const normalizedAbs = abs.toLowerCase();
  if (normalizedAbs.startsWith(normalizedProject)) {
    throw new Error(
      `拒绝写入项目目录\n  项目: ${PROJECT_ROOT}\n  请求: ${abs}\n  建议: ${DEFAULT_PATH}`,
    );
  }
}

async function main() {
  const outputPath = process.argv[2] ?? DEFAULT_PATH;
  assertSafePath(outputPath);

  if (existsSync(outputPath)) {
    throw new Error(
      `文件已存在 → ${outputPath}\n如需重新生成，手动删除后重跑（避免覆盖已充值钱包）`,
    );
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const walletJson = {
    address: account.address,
    privateKey,
    token: 'base-eth' as const,
    chain: 'base',
    chainId: 8453,
    purpose: 'Ripples in the Pond — Turbo credits 专用钱包，勿作他用',
    createdAt: new Date().toISOString(),
  };

  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(walletJson, null, 2), { mode: 0o600 });

  console.log('\n✅ 钱包已生成');
  console.log(`   路径  ${outputPath}`);
  console.log(`   地址  ${account.address}`);
  console.log(`   链    Base (chainId 8453)\n`);
  console.log('下一步 ⬇');
  console.log('1. 把下面这一行加进 .env.local：');
  console.log(`   TURBO_WALLET_PATH=${outputPath}\n`);
  console.log('2. 用 MetaMask 切到 Base 网络 → 给上面地址转 0.0044 ETH');
  console.log('3. 跑  npx tsx scripts/arweave/wait-for-base-eth.ts  确认到账');
  console.log('4. 跑  npx tsx scripts/arweave/topup-turbo.ts        换 credits\n');
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});

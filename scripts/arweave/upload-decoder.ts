// Phase 3 S4.b：上传 score-decoder/index.html 到 Arweave
// 用法：npx tsx scripts/arweave/upload-decoder.ts
// 产物：data/decoder-ar.json （记录 txId + url + uploadedAt + size）
// 前置：TURBO_WALLET_PATH 已配置
//
// 一次性 + 偶尔重跑：decoder 基本不动，万一未来 fix bug 重新上传，
// 老的 NFT 永远指向第一次上传的 txid（永久不可变），新 NFT 用新 txid。

import '../_env';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { uploadBuffer } from '../../src/lib/arweave/core';

const ROOT = process.cwd();
const DECODER_PATH = join(ROOT, 'src', 'score-decoder', 'index.html');
const OUTPUT_DIR = join(ROOT, 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'decoder-ar.json');
const SIZE_LIMIT_BYTES = 100 * 1024;

async function main() {
  if (!existsSync(DECODER_PATH)) {
    throw new Error(`找不到 decoder：${DECODER_PATH}`);
  }
  const buf = readFileSync(DECODER_PATH);
  const sizeKb = (buf.length / 1024).toFixed(2);
  console.log(`decoder.html 大小: ${sizeKb} KB (${buf.length} bytes)`);
  if (buf.length > SIZE_LIMIT_BYTES) {
    console.warn(`⚠️ 超过 100 KB playbook 硬目标，但仍继续上传`);
  }

  console.log('上传 Arweave...');
  const result = await uploadBuffer(buf, 'text/html');

  const record = {
    txId: result.txId,
    url: result.url,
    uploadedAt: new Date().toISOString(),
    sizeBytes: buf.length,
  };

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(record, null, 2) + '\n');

  console.log(`\n✅ decoder 上传成功`);
  console.log(`   txId  : ${result.txId}`);
  console.log(`   url   : ${result.url}`);
  console.log(`   record: ${OUTPUT_FILE}`);
  console.log(`\n下一步：`);
  console.log(`  1. 把这一行加进 .env.local：`);
  console.log(`     SCORE_DECODER_AR_TX_ID=${result.txId}\n`);
  console.log(`  2. 浏览器打开测试上线版本（可能要等 10-15 min 完全传播）：`);
  console.log(`     ${result.url}`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});

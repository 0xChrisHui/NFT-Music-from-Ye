// 一次性上传 public/sounds/*.mp3 到 Arweave
// 用法：npx tsx scripts/arweave/upload-sounds.ts
// 产物：data/sounds-ar-map.json（key -> { txId, url }）
// 增量：已在 map 里的 key 会跳过，可反复运行
// 前置：TURBO_WALLET_PATH 已配置 + Turbo credits 已到账

import '../_env';
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { uploadBuffer } from '../../src/lib/arweave/core';

const ROOT = process.cwd();
const SOUNDS_DIR = join(ROOT, 'public', 'sounds');
const OUTPUT_DIR = join(ROOT, 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'sounds-ar-map.json');

type ArMap = Record<string, { txId: string; url: string }>;

function loadMap(): ArMap {
  if (!existsSync(OUTPUT_FILE)) return {};
  return JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8')) as ArMap;
}

function saveMap(map: ArMap): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2) + '\n');
}

async function main() {
  if (!existsSync(SOUNDS_DIR)) {
    throw new Error(`Sounds dir not found: ${SOUNDS_DIR}`);
  }
  const files = readdirSync(SOUNDS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .sort();
  console.log(`发现 ${files.length} 个音效文件 (${SOUNDS_DIR})`);

  const map = loadMap();
  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const key = file.replace(/\.mp3$/i, '');
    if (map[key]) {
      console.log(`⏭  ${key} 已存在 (${map[key].txId})`);
      skipped++;
      continue;
    }
    console.log(`⬆  ${key} 上传中...`);
    const buf = readFileSync(join(SOUNDS_DIR, file));
    const { txId, url } = await uploadBuffer(buf, 'audio/mpeg');
    map[key] = { txId, url };
    saveMap(map); // 每成功一个就落盘，避免中途挂掉丢进度
    console.log(`✅ ${key} → ${txId}`);
    uploaded++;
  }

  console.log(`\n完成：上传 ${uploaded}，跳过 ${skipped}`);
  console.log(`输出：${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error('[upload-sounds] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});

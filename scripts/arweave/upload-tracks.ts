// 增量上传 public/tracks/*.mp3 到 Arweave，回写 tracks.arweave_url
// 用法：npx tsx scripts/arweave/upload-tracks.ts
// 前置：SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL + TURBO_WALLET_PATH
// 行为：查 tracks 表 arweave_url IS NULL 的行 → 对应文件存在则上传 → 回写
//       文件不存在就跳过（预期——未来每周新曲上传一次，跑一次脚本）

import '../_env';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { uploadBuffer } from '../../src/lib/arweave/core';

const ROOT = process.cwd();
const TRACKS_DIR = join(ROOT, 'public', 'tracks');

type TrackRow = {
  id: string;
  week: number;
  audio_url: string;
  arweave_url: string | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from('tracks')
    .select('id, week, audio_url, arweave_url')
    .is('arweave_url', null)
    .order('week', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as TrackRow[];
  if (rows.length === 0) {
    console.log('没有待上传的 track（所有行都已有 arweave_url）');
    return;
  }

  console.log(`待处理：${rows.length} 条`);
  let uploaded = 0;
  let missing = 0;

  for (const row of rows) {
    // audio_url 约定形如 "/tracks/001.mp3"，取文件名部分
    const fileName = row.audio_url.replace(/^\/?tracks\//, '');
    const filePath = join(TRACKS_DIR, fileName);
    if (!existsSync(filePath)) {
      console.log(`⏭  week=${row.week} 文件不存在，跳过：${fileName}`);
      missing++;
      continue;
    }

    console.log(`⬆  week=${row.week} 上传 ${fileName}...`);
    const buf = readFileSync(filePath);
    const { txId, url: arUrl } = await uploadBuffer(buf, 'audio/mpeg');

    const { error: upErr } = await supabase
      .from('tracks')
      .update({ arweave_url: arUrl })
      .eq('id', row.id);
    if (upErr) throw upErr;

    console.log(`✅ week=${row.week} → ${txId}`);
    uploaded++;
  }

  console.log(`\n完成：上传 ${uploaded}，缺文件 ${missing}`);
}

main().catch((e) => {
  console.error('[upload-tracks] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});

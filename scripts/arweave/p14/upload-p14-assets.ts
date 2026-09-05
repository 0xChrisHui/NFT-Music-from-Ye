// P14 永久音频入口；本阶段只开放本地审计，任何上传参数都会 fail closed。
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { auditMp3 } from './mp3-audit';

const CHARSET_V1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ROOT = process.cwd();
const CLIPS_DIR = join(ROOT, 'public', 'the36');
const MANIFEST_PATH = join(ROOT, 'src', 'features', 'wallet-recipe', 'clips-v1.json');

type Clip = {
  key: string;
  fileName: string;
  bytes: number;
  mimeType: 'audio/mpeg';
  sha256: string;
  sampleRate: number;
  channels: number;
  frameCount: number;
  durationMs: number;
  arweaveTxId: null;
};

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function validateArgs(): { writeManifest: boolean } {
  const args = process.argv.slice(2);
  const allowed = new Set(['clips', '--audit', '--write-manifest']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) throw new Error(`不支持的参数：${unknown.join(', ')}`);
  if (!args.includes('clips') || !args.includes('--audit')) {
    throw new Error('A0 仅允许：clips --audit [--write-manifest]');
  }
  return { writeManifest: args.includes('--write-manifest') };
}

function inspectFiles(): Clip[] {
  const entries = readdirSync(CLIPS_DIR, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const mp3Files = files.filter((file) => file.toLowerCase().endsWith('.mp3'));
  const expected = [...CHARSET_V1].map((key) => `${key}.mp3`);
  const missing = expected.filter((file) => !mp3Files.includes(file));
  const extra = mp3Files.filter((file) => !expected.includes(file));
  const caseCollisions = mp3Files.filter(
    (file, index) => mp3Files.findIndex((other) => other.toLowerCase() === file.toLowerCase()) !== index,
  );
  if (missing.length || extra.length || caseCollisions.length || mp3Files.length !== 36) {
    throw new Error(
      `字符集不匹配 missing=${missing.join('|') || '-'} extra=${extra.join('|') || '-'} ` +
        `caseCollisions=${caseCollisions.join('|') || '-'}`,
    );
  }

  return [...CHARSET_V1].map((key) => {
    const fileName = `${key}.mp3`;
    const buffer = readFileSync(join(CLIPS_DIR, fileName));
    if (buffer.length === 0) throw new Error(`${fileName} 是零字节文件`);
    const audio = auditMp3(buffer);
    return {
      key,
      fileName,
      bytes: buffer.length,
      mimeType: 'audio/mpeg',
      sha256: sha256(buffer),
      sampleRate: audio.sampleRate,
      channels: audio.channels,
      frameCount: audio.frameCount,
      durationMs: audio.durationMs,
      arweaveTxId: null,
    };
  });
}

function assertConsistent(clips: Clip[]): void {
  const uniqueHashes = new Set(clips.map((clip) => clip.sha256));
  if (uniqueHashes.size !== clips.length) throw new Error(`SHA-256 仅 ${uniqueHashes.size}/36 唯一`);
  for (const field of ['mimeType', 'sampleRate', 'channels'] as const) {
    const values = new Set(clips.map((clip) => String(clip[field])));
    if (values.size !== 1) throw new Error(`${field} 不一致：${[...values].join(', ')}`);
  }
  if (clips.some((clip) => !Number.isFinite(clip.durationMs) || clip.durationMs <= 0)) {
    throw new Error('存在非有限或非正时长');
  }
}

function buildManifest(clips: Clip[]) {
  const identity = { version: 1 as const, charset: CHARSET_V1, count: clips.length, clips };
  return {
    ...identity,
    generatedAt: new Date().toISOString(),
    manifestSha256: sha256(JSON.stringify(identity)),
  };
}

function main(): void {
  const { writeManifest } = validateArgs();
  const clips = inspectFiles();
  assertConsistent(clips);
  const manifest = buildManifest(clips);
  const output = `${JSON.stringify(manifest, null, 2)}\n`;
  if (writeManifest) {
    mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
    writeFileSync(MANIFEST_PATH, output, 'utf8');
  }
  process.stdout.write(output);
  process.stderr.write(
    `A0 通过：${clips.length}/36，unique hashes=${new Set(clips.map((clip) => clip.sha256)).size}，` +
      `${clips[0].sampleRate} Hz / ${clips[0].channels} ch，` +
      `${writeManifest ? '已冻结候选 manifest' : '只读审计，未写文件'}\n`,
  );
}

try {
  main();
} catch (error) {
  console.error('[P14-A0] 审计失败：', error instanceof Error ? error.message : error);
  process.exit(1);
}

import manifestJson from './clips-v1.json';
import { parseClipManifestV1 } from '@/src/lib/wallet-recipe/clip-manifest';
import type { P14ClipV1 } from '@/src/types/wallet-recipe';

// feature 层只绑定仓库内冻结文件；结构与外部 JSON 的严格校验统一由 lib parser 负责。
export const CLIP_MANIFEST_V1 = parseClipManifestV1(manifestJson);

const CLIPS_BY_KEY = new Map(CLIP_MANIFEST_V1.clips.map((clip) => [clip.key, clip]));

export function getClipV1(key: string): P14ClipV1 {
  const clip = CLIPS_BY_KEY.get(key);
  if (!clip) throw new Error(`P14 v1 不支持字符：${key}`);
  return clip;
}

export function getFrozenClipV1(key: string): P14ClipV1 & { arweaveTxId: string } {
  const clip = getClipV1(key);
  if (!clip.arweaveTxId) throw new Error(`P14 v1 音频 ${key} 尚未永久冻结`);
  return clip as P14ClipV1 & { arweaveTxId: string };
}

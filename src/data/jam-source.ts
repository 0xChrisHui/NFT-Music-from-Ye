import type {
  Sound,
  SaveScoreRequest,
  SaveScoreResponse,
  ScorePreviewResponse,
} from '@/src/types/jam';
import { MOCK_SOUNDS } from './mock-sounds';

/**
 * 合奏数据适配层 — 函数签名冻结
 * Track B：返回假数据 / 假保存
 * Track C：替换内部实现为真实 API 调用
 */

export async function fetchSounds(): Promise<Sound[]> {
  return MOCK_SOUNDS;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Track C 替换实现时会用到参数
export async function saveScore(
  _token: string,
  _data: SaveScoreRequest,
): Promise<SaveScoreResponse> {
  return {
    result: 'ok',
    scoreId: `draft-${Date.now()}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Track C 替换实现时会用到参数
export async function fetchScorePreview(
  _token: string,
  _scoreId: string,
): Promise<ScorePreviewResponse | null> {
  return null;
}

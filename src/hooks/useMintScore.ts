'use client';

import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { mintScore } from '@/src/data/jam-source';

type MintScoreState = 'idle' | 'queued';

/**
 * 乐观草稿铸造 hook（Phase 6 B3）
 *
 * 点击立即变 queued，API 后台跑失败 console.error 不通知
 * （memory: feedback/optimistic_ui_with_rollback —— 用户决策包含重动作）
 *
 * 失败兜底：pending_scores 即使 status='expired' 也保留 events_data，
 *   ops 可通过 /api/health 的 scoreQueue 失败统计 + 用户反馈手动重铸
 *
 * 不需要 disable / loading / error UI 状态：
 *   - 用户感知是"按一下，自动在跑"
 *   - 真过期由 DraftCard 在前端拦（只是 UI 例外，不是 hook 责任）
 */
export function useMintScore() {
  const { getAccessToken } = useAuth();
  const [state, setState] = useState<MintScoreState>('idle');

  const mint = useCallback(async (pendingScoreId: string) => {
    // 乐观：立即变 queued
    setState('queued');

    // 后台 API 调，失败仅日志，UI 不回退
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('[mintScore] 无法获取 token', {
          pendingScoreId, ts: new Date().toISOString(),
        });
        return;
      }
      await mintScore(token, pendingScoreId);
    } catch (err) {
      console.error('[mintScore] 铸造请求失败', {
        pendingScoreId, err,
        ts: new Date().toISOString(),
      });
    }
  }, [getAccessToken]);

  return { state, mint };
}

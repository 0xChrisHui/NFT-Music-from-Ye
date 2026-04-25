'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './useAuth';
import { saveScore } from '@/src/data/jam-source';
import { getDrafts, removeDraft } from '@/src/lib/draft-store';

type FavoriteStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * 爱心收藏 hook — 悲观更新
 *
 * 点击爱心 →
 *   未登录 → 触发 Privy 登录 → 登录成功后自动完成收藏
 *   已登录 → loading → API 成功才变 success（红心）；失败回退 error 并 3s 后自动归 idle
 */
export function useFavorite(
  tokenId: number,
  trackId: string,
  onMinted?: (tokenId: number) => void,
) {
  const { authenticated, login, getAccessToken } = useAuth();
  const [status, setStatus] = useState<FavoriteStatus>('idle');
  const pendingRef = useRef(false);
  const onMintedRef = useRef(onMinted);
  useEffect(() => { onMintedRef.current = onMinted; }, [onMinted]);

  const doFavorite = useCallback(async () => {
    setStatus('loading');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('无法获取 token');

      // 1. 铸造素材 NFT（后端用稳定 idempotencyKey 防并发重复）
      const mintRes = await fetch('/api/mint/material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tokenId }),
      });

      // 409 = 已铸造过，视为成功
      if (!mintRes.ok && mintRes.status !== 409) {
        throw new Error(`铸造请求失败: ${mintRes.status}`);
      }

      // API 确认入队后才推进 UI 到 success
      setStatus('success');
      onMintedRef.current?.(tokenId);

      // 2. 尝试上传该 track 的草稿（如有）— 失败不影响收藏成功
      const drafts = getDrafts();
      const draft = drafts.find((d) => d.trackId === trackId);
      if (draft) {
        try {
          await saveScore(token, {
            trackId: draft.trackId,
            eventsData: draft.eventsData,
            createdAt: draft.createdAt,
          });
          removeDraft(draft.trackId);
        } catch {
          console.warn('[favorite] 草稿上传失败，保留在本地');
        }
      }
    } catch (err) {
      console.error('[favorite] 收藏失败:', err);
      setStatus('error');
      // 3 秒后回到 idle，让用户能重试
      setTimeout(() => setStatus((s) => (s === 'error' ? 'idle' : s)), 3000);
    }
  }, [getAccessToken, tokenId, trackId]);

  // 登录成功后自动完成收藏
  useEffect(() => {
    if (authenticated && pendingRef.current) {
      pendingRef.current = false;
      doFavorite();
    }
  }, [authenticated, doFavorite]);

  const favorite = useCallback(async () => {
    if (!authenticated) {
      pendingRef.current = true;
      login();
      return;
    }
    doFavorite();
  }, [authenticated, login, doFavorite]);

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, favorite, reset };
}

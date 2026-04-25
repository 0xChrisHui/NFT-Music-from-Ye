'use client';

import { useFavorite } from '@/src/hooks/useFavorite';

/**
 * 爱心收藏按钮 — 悲观更新
 *   idle    ♡ 空心（可点）
 *   loading ♡ 淡色 + 禁用（发请求中）
 *   success ♥ 红心（已入队）
 *   error   ♡ 红色边框 + "重试" 提示，3s 后回 idle
 */
export default function FavoriteButton({
  tokenId,
  trackId,
  alreadyMinted = false,
  onMinted,
}: {
  tokenId: number;
  trackId: string;
  alreadyMinted?: boolean;
  onMinted?: (tokenId: number) => void;
}) {
  const { status, favorite } = useFavorite(tokenId, trackId, onMinted);

  if (alreadyMinted || status === 'success') {
    return (
      <span className="text-xl leading-none text-rose-400" aria-label="已收藏">
        &#9829;
      </span>
    );
  }

  if (status === 'loading') {
    return (
      <span
        className="animate-pulse text-xl leading-none text-white/40"
        aria-label="收藏中"
      >
        &#9825;
      </span>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={favorite}
        className="text-xl leading-none text-rose-500/70 transition-all hover:scale-110"
        aria-label="收藏失败，点击重试"
        title="收藏失败，点击重试"
      >
        &#9825;
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={favorite}
      className="text-xl leading-none text-white/30 transition-all hover:scale-110 hover:text-rose-400"
      aria-label="收藏"
    >
      &#9825;
    </button>
  );
}

import Link from 'next/link';
import type { OwnedScoreNFT } from '@/src/types/jam';

/**
 * ScoreCard — 个人页乐谱 NFT 卡片
 * 显示封面缩略图 + 曲目名 + tokenId + 音符数 + 回放入口
 */
export default function ScoreCard({ score }: { score: OwnedScoreNFT }) {
  return (
    <Link
      href={`/score/${score.tokenId}`}
      className="group flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
    >
      {/* 封面缩略图 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={score.coverUrl}
        alt={`Ripples #${score.tokenId}`}
        width={64}
        height={64}
        className="h-16 w-16 rounded-lg object-cover"
      />

      {/* 文字区域 */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-sm font-medium text-white/90">
          Ripples #{score.tokenId}
        </p>
        <p className="mt-0.5 truncate text-xs text-white/50">
          {score.trackTitle} · {score.eventCount} 音符
        </p>
        <p className="mt-0.5 text-xs text-white/30">
          {new Date(score.mintedAt).toLocaleDateString()}
        </p>
      </div>

      {/* 箭头指示 */}
      <span className="self-center text-white/20 transition group-hover:text-white/50">
        →
      </span>
    </Link>
  );
}

/**
 * v87 K 方案 — comet trail 渲染（带 pool 复用）
 *
 * 从 comet-system 抽出，专管 trail 的视觉构建：
 * - 持久化散点（persistent dots）
 * - 非持久化线段（line segments）
 *
 * Heads（彗星头 / eclipse 月亮）保留在 comet-system 直接处理——
 * 数量少（1-6 个）+ 含 click handler，不进 pool。
 */

import { makePool, type SvgPool } from './svg-pool';

export interface TrailHistPoint {
  x: number;
  y: number;
  lifeRate: number;
  spawnTime: number;
  lifetime: number;
  persistent: boolean;
  driftX: number;
  driftY: number;
}

export interface CometTrailPools {
  d: SvgPool<SVGCircleElement>;
  l: SvgPool<SVGLineElement>;
}

export function makeCometTrailPools(layer: SVGGElement): CometTrailPools {
  return {
    d: makePool<SVGCircleElement>(layer, 'circle', (e) => e.setAttribute('fill', 'white')),
    l: makePool<SVGLineElement>(layer, 'line', (e) => {
      e.setAttribute('stroke', 'white');
      e.setAttribute('stroke-linecap', 'round');
    }),
  };
}

/** 每帧每个 comet 调用一次（除 eclipse 状态以外） */
export function renderCometTrail(
  pools: CometTrailPools,
  hist: TrailHistPoint[],
  now: number,
  dispScale: number,
  sizeBase: number,
): void {
  // 持久化散点
  for (const p of hist) {
    if (!p.persistent) continue;
    const tNorm = Math.min(1, (now - p.spawnTime) / p.lifetime);
    const modW = tNorm < 0.15 ? 0 : (tNorm - 0.15) / 0.85;
    const fadeP = Math.max(0, Math.min(1, (1 - tNorm) * (1 + (p.lifeRate - 1) * modW)));
    const d = pools.d.get();
    d.setAttribute('cx', String(p.x + p.driftX * tNorm));
    d.setAttribute('cy', String(p.y + p.driftY * tNorm));
    d.setAttribute('r', String(1.0 + Math.random() * 0.6));
    d.setAttribute('fill-opacity', String(fadeP * 0.30));
  }
  // 线段
  for (let i = hist.length - 1; i >= 1; i--) {
    const p1 = hist[i], p0 = hist[i - 1];
    if (p1.persistent || p0.persistent) continue;
    const tNorm = Math.min(1, (now - p1.spawnTime) / p1.lifetime);
    const fadeBase = 1 - tNorm;
    const modW = tNorm < 0.15 ? 0 : (tNorm - 0.15) / 0.85;
    const fade = Math.max(0, Math.min(1, fadeBase * (1 + (p1.lifeRate - 1) * modW)));
    const seg = pools.l.get();
    seg.setAttribute('x1', String(p1.x));
    seg.setAttribute('y1', String(p1.y));
    seg.setAttribute('x2', String(p0.x));
    seg.setAttribute('y2', String(p0.y));
    seg.setAttribute('stroke-width', String(sizeBase * dispScale * 1.6 * fade));
    seg.setAttribute('stroke-opacity', String(fade * 0.20));
  }
}

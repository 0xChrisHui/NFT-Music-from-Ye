/**
 * v87 — link 渲染从 use-sphere-sim 抽出（控制 hook 文件行数 + 关注点分离）。
 *
 * link 渲染纯几何无状态：每帧根据 source/target 球的当前位置 + tilt + perspective
 * 更新 SVG <line> 端点。日食模式下整段跳过（父 group opacity 0）。
 */

import { type SimNode, type SimLink } from '../sphere-config';
import { tiltCoef, persp } from './render-helpers';

export interface RenderLinksArgs {
  simLinks: SimLink[];
  lineRefs: React.RefObject<(SVGElement | null)[]>;
  zMap: Map<string, number>;
  tiltX: number;
  tiltY: number;
  perspective: boolean;
  cx: number;
  cy: number;
  k: number;
}

export function renderLinks(a: RenderLinksArgs): void {
  a.simLinks.forEach((l, i) => {
    const lineEl = a.lineRefs.current?.[i];
    const src = l.source as SimNode;
    const tgt = l.target as SimNode;
    if (!lineEl || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;
    // v87 Z1 — 删 z 抖动
    const sZ = a.zMap.get(src.id) ?? 0.5;
    const tZ = a.zMap.get(tgt.id) ?? 0.5;
    const sTc = tiltCoef(sZ), tTc = tiltCoef(tZ);
    let sx = src.x + a.tiltX * sTc;
    let sy = src.y + a.tiltY * sTc;
    let tx = tgt.x + a.tiltX * tTc;
    let ty = tgt.y + a.tiltY * tTc;
    if (a.perspective) {
      const ps = persp(sx, sy, sZ, a.cx, a.cy, a.k);
      const pt = persp(tx, ty, tZ, a.cx, a.cy, a.k);
      sx = ps.x; sy = ps.y; tx = pt.x; ty = pt.y;
    }
    lineEl.setAttribute('x1', String(sx));
    lineEl.setAttribute('y1', String(sy));
    lineEl.setAttribute('x2', String(tx));
    lineEl.setAttribute('y2', String(ty));
  });
}

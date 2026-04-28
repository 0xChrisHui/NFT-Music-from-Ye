'use client';

import { createPortal } from 'react-dom';

interface Props {
  zoomGRef: React.RefObject<SVGGElement | null>;
  eclipseGRef: React.RefObject<SVGGElement | null>;
}

/**
 * Phase 6 B2 — 日食覆盖层
 *
 * v4：用 React Portal 渲染到 document.body，跳出 Archipelago section 的
 *     stacking context（之前 z-index:200 在 Archipelago z-0 上下文里被
 *     /test main 内的 SvgAnimationLayer z-40 整层压住）。
 *
 * 几何：
 * - unit r=50（黑圆 = SphereNode r），运行时 transform 含 scale(playingNode.radius/50)
 * - 内核紧贴月亮外缘的细白环（高亮）+ 减淡光晕
 */
export default function EclipseLayer({ zoomGRef, eclipseGRef }: Props) {
  if (typeof window === 'undefined') return null;

  return createPortal(
    <svg
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="eclipse-halo">
          {/* 黑圆内透明 */}
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="22%" stopColor="white" stopOpacity="0" />
          {/* 紧贴黑圆边缘 — 柔和起亮 */}
          <stop offset="24%" stopColor="white" stopOpacity="0.55" />
          {/* ripple 边缘 */}
          <stop offset="36%" stopColor="white" stopOpacity="0.32" />
          {/* 中段过渡 */}
          <stop offset="60%" stopColor="white" stopOpacity="0.10" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={zoomGRef}>
        <g ref={eclipseGRef} style={{ display: 'none' }}>
          {/* 减淡白光（外圈光环）r=220 */}
          <circle r="220" fill="url(#eclipse-halo)" />
          {/* 月亮（黑圆）*/}
          <circle r="50" fill="black" />
          {/* 内核高亮：紧贴月亮外缘的极细白环（v4 新增）*/}
          <circle r="51" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.92" />
          {/* 中间暂停键 — 透明度 10% */}
          <rect x="-14" y="-22" width="9" height="44" fill="white" opacity="0.1" />
          <rect x="5" y="-22" width="9" height="44" fill="white" opacity="0.1" />
        </g>
      </g>
    </svg>,
    document.body,
  );
}

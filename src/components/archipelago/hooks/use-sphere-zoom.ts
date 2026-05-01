'use client';

import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { type Simulation } from 'd3-force';
import { type SimNode, type SimLink } from '../sphere-config';
import type { EffectsConfig } from '../effects-config';

/**
 * v37/v86 — 焦平面景深 helper（element.style.filter 直接 set，绕开 React reconciliation）
 * v86 — blur 2 → 0.6 / brightness 衰减 0.5 → 0.15，远处只是淡淡虚化
 */
// v86 — focusZ 锁定近端 + decay 随 k 衰减：放大后所有球清晰
export function focusZOf(k: number): number {
  return Math.max(0.7, 1 - (k - 1) * 0.1);
}
/** focus 强度衰减：k=1 完整、k=3 全清；用户希望"放大 50% 时最远清晰" */
export function focusDecay(k: number): number {
  return Math.max(0, 1 - (k - 1) * 0.5);
}
export function applyFocusBlur(elements: Map<string, SVGGElement>, k: number): void {
  const focusZ = focusZOf(k);
  const decay = focusDecay(k);
  elements.forEach((el) => {
    const z = parseFloat(el.getAttribute('data-z') || '0.5');
    const dist = Math.abs(z - focusZ);
    el.style.filter = `blur(${dist * 0.6 * decay}px) brightness(${1 - dist * 0.15 * decay})`;
  });
}

/**
 * d3.zoom 行为：滚轮缩放 + Escape reset + 触摸 pinch + drag pan。
 *
 * v53 — perspective 重构：d3.zoom 接收所有 events（含 touch pinch + drag）
 * - wheelDelta 系数 0.005 让 wheel 3 次能到最深 zoom
 * - on zoom: wheel 时算 vanish point 不动 zoomG（球从 vanish 扩散）
 * - on zoom: touch/drag 时 zoomG translate（让 pinch + pan 正常 work）
 * - vanish 判定区 5%-95%（几乎全屏，outlier 球附近也能 mouse hover）
 */
export function useSphereZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  zoomGRef: React.RefObject<SVGGElement | null>,
  eclipseZoomGRef: React.RefObject<SVGGElement | null>,
  simRef: React.RefObject<Simulation<SimNode, SimLink> | null>,
  nodeRefMap: React.RefObject<Map<string, SVGGElement>>,
  simNodesRef: React.RefObject<SimNode[]>,
  effects: EffectsConfig,
): {
  zoomKRef: React.RefObject<number>;
  vanishRef: React.RefObject<{ x: number; y: number }>;
} {
  const lastBigRef = useRef<boolean | null>(null);
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  const zoomKRef = useRef(1);
  const vanishRef = useRef<{ x: number; y: number }>({ x: 400, y: 300 });
  const lastZoomedRef = useRef(false); // v84 vanish 只在 zoom 状态切换时设

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !zoomGRef.current) return;
    vanishRef.current = { x: svg.clientWidth / 2, y: svg.clientHeight / 2 };
    const svgSel = select(svg);
    const zoomG = select(zoomGRef.current);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      // v53 — wheel 系数 0.005：3 次滚轮可到最深 5×（log(5)/0.5 ≈ 3.2）
      .wheelDelta((event) => -event.deltaY * 0.005)
      .filter((event) => {
        if (effectsRef.current.perspective) return true;
        // v77 — wheel 时即使 ctrlKey 也接管（trackpad pinch / 鼠标 ctrl+滚轮），避免浏览器整页缩放
        return (!event.ctrlKey || event.type === 'wheel') && !event.button;
      })
      .on('zoom', (e) => {
        const cfg = effectsRef.current;
        zoomKRef.current = e.transform.k;
        if (cfg.perspective) {
          // v84 — perspective 模式下 zoomG 永远 null（不支持 pan，避免 d3 累积 transform.x/y 在 click 时跳）
          // v85 — vanish 由自定义 wheel.zoom handler 基于 snap-anchor 设置；
          //       这里只在退出 zoomed 状态（reset）时把 vanish 复位到屏幕中心
          const k = e.transform.k;
          const isZoomed = k > 1.001;
          if (isZoomed !== lastZoomedRef.current) {
            if (!isZoomed) {
              vanishRef.current = { x: svg.clientWidth / 2, y: svg.clientHeight / 2 };
            }
            lastZoomedRef.current = isZoomed;
          }
          // v86 — 仅 translate（drag pan）不应用 scale；perspective 自己用 vanish 处理 zoom
          const tStr = `translate(${e.transform.x},${e.transform.y})`;
          zoomG.attr('transform', tStr);
          if (eclipseZoomGRef.current) eclipseZoomGRef.current.setAttribute('transform', tStr);
        } else {
          const t = e.transform.toString();
          zoomG.attr('transform', t);
          if (eclipseZoomGRef.current) eclipseZoomGRef.current.setAttribute('transform', t);
        }
        // v87 perf — focus filter 由 sim tick 统一节流 + cache 处理（15Hz）
        // 这里之前每个 wheel 事件（trackpad ~100Hz）×36 setAttribute 是缩放掉帧元凶
        const big = e.transform.k > 2.5;
        if (simRef.current && big !== lastBigRef.current) {
          simRef.current.alphaTarget(big ? 0.003 : 0.008).alpha(0.1).restart();
          lastBigRef.current = big;
        }
        zoomG.classed('zoom-large', big);
      });

    svgSel.call(zoomBehavior);
    svgSel.on('dblclick.zoom', null);

    // v85/v86 — 覆盖 wheel.zoom：snap-to-sphere（球 80px 内 / 否则中心）+ 200ms anchor lock。
    // perspective 模式 vanish 用 sim 坐标（非视觉），保证缩放时锚点球严格不动。
    const SNAP_RADIUS = 80;
    const findSnapAnchor = (px: number, py: number): {
      visual: [number, number];
      sim: [number, number] | null;
    } => {
      const W = svg.clientWidth || 800;
      const H = svg.clientHeight || 600;
      const refs = nodeRefMap.current;
      const fallback: [number, number] = [W / 2, H / 2];
      if (!refs || refs.size === 0) return { visual: fallback, sim: null };
      const rect = svg.getBoundingClientRect();
      let bestId: string | null = null;
      let bestVisual: [number, number] = fallback;
      let bestDist = SNAP_RADIUS;
      refs.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        const cx = r.left + r.width / 2 - rect.left;
        const cy = r.top + r.height / 2 - rect.top;
        const d = Math.hypot(cx - px, cy - py);
        if (d < bestDist) { bestDist = d; bestId = id; bestVisual = [cx, cy]; }
      });
      if (bestId === null) return { visual: fallback, sim: null };
      const node = simNodesRef.current?.find((n) => n.id === bestId);
      if (!node || node.x == null || node.y == null) {
        return { visual: bestVisual, sim: null };
      }
      return { visual: bestVisual, sim: [node.x, node.y] };
    };

    let wheelAnchor: [number, number] | null = null;
    let wheelIdleTimer: number | null = null;
    const WHEEL_IDLE_MS = 200;
    svgSel.on('wheel.zoom', (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      if (wheelAnchor === null) {
        const snap = findSnapAnchor(px, py);
        wheelAnchor = snap.visual;
        if (effectsRef.current.perspective) {
          // perspective: vanish 用 sim 坐标（球 A 视觉不动）；fallback 屏幕中心
          const W = svg.clientWidth || 800;
          const H = svg.clientHeight || 600;
          const v = snap.sim ?? [W / 2, H / 2];
          vanishRef.current = { x: v[0], y: v[1] };
        }
      }
      if (wheelIdleTimer !== null) window.clearTimeout(wheelIdleTimer);
      wheelIdleTimer = window.setTimeout(() => {
        wheelAnchor = null;
        wheelIdleTimer = null;
      }, WHEEL_IDLE_MS);

      const t0 = zoomTransform(svg);
      const delta = -event.deltaY * 0.005;
      const k1 = Math.max(0.15, Math.min(5, t0.k * Math.pow(2, delta)));
      if (k1 === t0.k) return;
      if (effectsRef.current.perspective) {
        // v86 — perspective 时保留 drag 累积的 t0.x/y，仅改 k；vanish 锚点已在上方设
        svgSel.call(zoomBehavior.transform, zoomIdentity.translate(t0.x, t0.y).scale(k1));
      } else {
        const [ax, ay] = wheelAnchor;
        const wx = (ax - t0.x) / t0.k;
        const wy = (ay - t0.y) / t0.k;
        const tx = ax - wx * k1;
        const ty = ay - wy * k1;
        svgSel.call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(k1));
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (effectsRef.current.perspective) {
          zoomKRef.current = 1;
          zoomG.attr('transform', null);
          if (eclipseZoomGRef.current) eclipseZoomGRef.current.removeAttribute('transform');
          vanishRef.current = { x: svg.clientWidth / 2, y: svg.clientHeight / 2 };
        }
        svgSel.call(zoomBehavior.transform, zoomIdentity);
      }
    };
    // v78 — 全局 ctrl+wheel 拦截（防止鼠标在 fixed 按钮上方 wheel 触发浏览器整页缩放）
    const onGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onGlobalWheel, { passive: false, capture: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onGlobalWheel, { capture: true });
      if (wheelIdleTimer !== null) window.clearTimeout(wheelIdleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { zoomKRef, vanishRef };
}

/**
 * v87 — sim tick 公用渲染常量 + 几何 helpers，从 use-sphere-sim 抽出。
 *
 * use-sphere-sim 和 render-links 都用，独立成文件避免循环依赖 + 控制单文件行数。
 */

/** tilt: 远端 baseline 0.15 微动，近端 pow(z,1.2) 偏陡；TILT_PX 145 近球 145px */
export const TILT_PX = 145;
export const tiltCoef = (z: number): number =>
  0.15 + Math.pow(Math.max(0, z), 1.2) * 0.85;

/**
 * 一点透视投影：z 高（近）的球随 k 增长更快。
 * v86: cap 4→8（让边缘 cluster 球飞出屏幕）。
 * v87 Z3: cap 8→4（缩放最大时 SVG filter 区域 1.5×4=6 base bbox vs 1.5×8=12，
 *   面积缩小 4 倍 → GPU feGaussianBlur 像素工作量降到 1/4）
 */
export function persp(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  k: number,
): { x: number; y: number; factor: number } {
  const factor = Math.min(4, Math.pow(k, 0.6 + z * 1.0));
  return { x: cx + (x - cx) * factor, y: cy + (y - cy) * factor, factor };
}

/**
 * v87 G3 — 全局活动追踪。
 *
 * 任何 mousemove/wheel/keydown/click 都会更新 lastActivityTime。
 * sim tick 用 getLastActivityTime() 判断是否进入 idle 模式（5s 无输入 → 半频更新 DOM）。
 *
 * 模块级状态而非 React hook：所有 sim tick 共享一份；只装一次 listener。
 * SSR 安全：window 检查 + 懒初始化。
 */
let lastActivityTime = 0;
let activityTrackingInited = false;

export function getLastActivityTime(): number {
  return lastActivityTime;
}

export function initActivityTracking(): void {
  if (activityTrackingInited || typeof window === 'undefined') return;
  activityTrackingInited = true;
  lastActivityTime = performance.now();
  const update = (): void => { lastActivityTime = performance.now(); };
  window.addEventListener('mousemove', update, { passive: true });
  window.addEventListener('wheel', update, { passive: true });
  window.addEventListener('keydown', update);
  window.addEventListener('click', update);
}

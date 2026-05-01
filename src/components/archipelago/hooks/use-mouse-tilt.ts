'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * v38 — mouse tilt 视差：监听 mousemove，返回归一化偏移 ref { x, y } ∈ [-0.5, 0.5]。
 * SphereCanvas 在 sim tick 里读这个 ref，给每球加 tilt offset：
 * 远球（z 小）偏移少、近球（z 大）偏移多 — 模拟相机转头看场景的视差感。
 * 鼠标离开窗口时归零，球回到 sim 物理位置。
 */
// v86 — 鼠标离开后 1s 才把 target 归零，sim tick 用 insideRef 区分 lerp 系数
const LEAVE_DELAY_MS = 1000;

export interface MouseTiltState {
  ref: RefObject<{ x: number; y: number }>;
  insideRef: RefObject<boolean>;
}

// v86 — 双 ref smoothing：inside 单层灵敏 / outside 双层柔回弹
export interface MouseSmoothState {
  smooth: { x: number; y: number };
  middle: { x: number; y: number };
}

export function lerpMouseSmooth(
  s: MouseSmoothState,
  target: { x: number; y: number },
  inside: boolean,
): { x: number; y: number } {
  if (inside) {
    s.smooth.x += (target.x - s.smooth.x) * 0.18;
    s.smooth.y += (target.y - s.smooth.y) * 0.18;
    s.middle.x = s.smooth.x; s.middle.y = s.smooth.y;
  } else {
    s.middle.x += (target.x - s.middle.x) * 0.08;
    s.middle.y += (target.y - s.middle.y) * 0.08;
    s.smooth.x += (s.middle.x - s.smooth.x) * 0.08;
    s.smooth.y += (s.middle.y - s.smooth.y) * 0.08;
  }
  return s.smooth;
}

export function useMouseTilt(): MouseTiltState {
  const ref = useRef({ x: 0, y: 0 });
  const insideRef = useRef(false);
  useEffect(() => {
    let leaveTimer: number | null = null;
    const onMove = (e: MouseEvent) => {
      if (leaveTimer !== null) { window.clearTimeout(leaveTimer); leaveTimer = null; }
      insideRef.current = true;
      ref.current.x = e.clientX / window.innerWidth - 0.5;
      ref.current.y = e.clientY / window.innerHeight - 0.5;
    };
    const onLeave = () => {
      // v86 — 不立即切 insideRef，等 1s 后与 target 归零同时切，避免 lerp 系数中途突变造成迟滞
      if (leaveTimer !== null) window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        insideRef.current = false;
        ref.current.x = 0;
        ref.current.y = 0;
        leaveTimer = null;
      }, LEAVE_DELAY_MS);
    };
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      if (leaveTimer !== null) window.clearTimeout(leaveTimer);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);
  return { ref, insideRef };
}

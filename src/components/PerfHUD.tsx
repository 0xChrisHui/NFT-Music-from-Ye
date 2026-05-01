'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * v87 — FPS / 长帧监测浮窗（左下角）
 *
 * 1s 滚动 FPS + 这 1s 内最长单帧 ms。绿/黄/红色编码：
 *   FPS：≥55 绿，30-54 黄，<30 红
 *   maxMs：≤18 绿（约 60fps 单帧），19-50 黄，>50 红（W3C long task 阈值）
 *
 * 用 rAF deltaTime 估算帧间隔，作为 long task 代理。pointer-events:none，不挡交互。
 */
export default function PerfHUD() {
  const [stats, setStats] = useState({ fps: 0, maxMs: 0 });
  const stateRef = useRef({
    frames: 0,
    maxMs: 0,
    windowStart: 0,
    lastFrame: 0,
  });

  useEffect(() => {
    const t0 = performance.now();
    const s = stateRef.current;
    s.windowStart = t0;
    s.lastFrame = t0;
    s.frames = 0;
    s.maxMs = 0;

    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const dt = now - s.lastFrame;
      // v87 G1 — 巨大 dt 通常是 tab 刚从隐藏状态恢复（rAF 自动暂停过），
      // 不计入 maxMs 也不算入帧数（避免显示 "0 fps · max 30000ms" 假数据）
      if (dt > 100) {
        s.lastFrame = now;
        s.windowStart = now;
        s.frames = 0;
        s.maxMs = 0;
        raf = requestAnimationFrame(loop);
        return;
      }
      s.lastFrame = now;
      s.frames++;
      if (dt > s.maxMs) s.maxMs = dt;

      const elapsed = now - s.windowStart;
      if (elapsed >= 1000) {
        setStats({
          fps: Math.round((s.frames * 1000) / elapsed),
          maxMs: Math.round(s.maxMs),
        });
        s.frames = 0;
        s.maxMs = 0;
        s.windowStart = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fpsColor =
    stats.fps >= 55 ? 'text-emerald-400'
    : stats.fps >= 30 ? 'text-yellow-400'
    : 'text-red-400';
  const msColor =
    stats.maxMs <= 18 ? 'text-emerald-400'
    : stats.maxMs <= 50 ? 'text-yellow-400'
    : 'text-red-400';

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[70] rounded bg-black/70 px-2.5 py-1 font-mono text-[10px] tracking-wider">
      <span className={fpsColor}>{stats.fps} fps</span>
      <span className="text-white/30"> · max </span>
      <span className={msColor}>{stats.maxMs}ms</span>
    </div>
  );
}

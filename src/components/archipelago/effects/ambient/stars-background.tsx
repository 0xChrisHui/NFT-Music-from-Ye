'use client';

import { useEffect, useRef } from 'react';

/**
 * v48/v86 — 星尘背景 (E17)
 * v86 改动：
 * - 改用真实 SVG element 渲染（之前 data URI raster）
 * - 5% 星星 CSS animation 闪烁（fill-opacity 0.15 ↔ 0.95，独立 phase）
 * - 每秒 30% 概率 spawn 新星 + 30% 概率 despawn（fade in/out 1.5s）
 *
 * 性能：~80 颗 small circles，每 3.3s 一次 DOM append/remove，
 *      闪烁 ~4 颗独立 animation。负担远低于背景涟漪。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const STAR_INIT = 80;
const TWINKLE_RATIO = 0.125; // ~10 / 80 颗
const TICK_MS = 1000;
const SPAWN_PROB = 0.30;
const DESPAWN_PROB = 0.30;
const FADE_MS = 1500;

function makeStar(): SVGCircleElement {
  const el = document.createElementNS(SVG_NS, 'circle');
  el.setAttribute('cx', String(Math.random() * 100));
  el.setAttribute('cy', String(Math.random() * 100));
  el.setAttribute('r', String((0.5 + Math.random() * 1.0) * 0.1));
  el.setAttribute('fill', 'white');
  if (Math.random() < TWINKLE_RATIO) {
    // 闪烁星：CSS animation 控制 fill-opacity，不 setAttribute 避免冲突
    el.style.animation = `star-twinkle ${2 + Math.random() * 2.5}s ease-in-out infinite`;
    el.style.animationDelay = `-${Math.random() * 3}s`;
  } else {
    el.setAttribute('fill-opacity', String(0.3 + Math.random() * 0.5));
  }
  return el;
}

export default function StarsBackground() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let cancelled = false;
    const fadeTimers: number[] = [];

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (let i = 0; i < STAR_INIT; i++) svg.appendChild(makeStar());

    const interval = window.setInterval(() => {
      if (cancelled) return;
      if (document.hidden) return; // v87 G1 — tab 不可见时跳过 spawn/despawn
      // spawn — fade in
      if (Math.random() < SPAWN_PROB) {
        const star = makeStar();
        star.style.opacity = '0';
        star.style.transition = `opacity ${FADE_MS}ms ease`;
        svg.appendChild(star);
        requestAnimationFrame(() => { star.style.opacity = '1'; });
      }
      // despawn — fade out + remove
      if (Math.random() < DESPAWN_PROB && svg.children.length > 0) {
        const idx = Math.floor(Math.random() * svg.children.length);
        const target = svg.children[idx] as SVGElement;
        target.style.transition = `opacity ${FADE_MS}ms ease`;
        target.style.opacity = '0';
        const id = window.setTimeout(() => { if (target.parentNode) target.remove(); }, FADE_MS + 50);
        fadeTimers.push(id);
      }
    }, TICK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      fadeTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes star-twinkle {
          0%, 100% { fill-opacity: 0.15; }
          50% { fill-opacity: 0.95; }
        }
      `}</style>
      <svg
        ref={svgRef}
        className="pointer-events-none fixed inset-0 z-0"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      />
    </>
  );
}

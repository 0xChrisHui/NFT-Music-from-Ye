import type { Palette } from './palettes';

/**
 * Phase 6 B2 - SVG 动画接口（移植 references/aaaa/patatap-engine.jsx）
 *
 * 每个动画接 ctx，自己创建 SVG 元素 + 注册 RAF + 完成时清理（element.remove）。
 * 完全无状态 — 一次按键一次调用，不持有持久 group。
 */

export interface AnimContext {
  svg: SVGSVGElement;
  w: number;
  h: number;
  p: Palette;
  variant?: number;
}

export type AnimFn = (ctx: AnimContext) => void;

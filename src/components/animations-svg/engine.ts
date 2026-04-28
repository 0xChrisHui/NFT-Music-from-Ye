/**
 * Phase 6 B2 - SVG 动画引擎入口（移植 references/aaaa/patatap-engine.jsx）
 *
 * 26 键映射 12 个独立动画（pistons 接 variant=1 default）
 * - a-l: 12 个独立动画
 * - m-x: 重复 a-l
 * - y/z: 重复 confetti / prisms
 */
import type { AnimFn } from './types';
import { PALETTES } from './palettes';
import { bubbles } from './effects/bubbles';
import { clay } from './effects/clay';
import { confetti } from './effects/confetti';
import { corona } from './effects/corona';
import { moon } from './effects/moon';
import { pinwheel } from './effects/pinwheel';
import { pistons } from './effects/pistons';
import { prisms } from './effects/prisms';
import { squiggle } from './effects/squiggle';
import { strike } from './effects/strike';
import { wipe } from './effects/wipe';
import { zigzag } from './effects/zigzag';

const ANIM_BY_KEY: Record<string, AnimFn> = {
  a: bubbles,   b: clay,      c: confetti,  d: corona,
  e: pinwheel,  f: pistons,   g: prisms,    h: squiggle,
  i: strike,    j: wipe,      k: zigzag,    l: moon,
  m: bubbles,   n: clay,      o: confetti,  p: corona,
  q: pinwheel,  r: pistons,   s: prisms,    t: squiggle,
  u: strike,    v: wipe,      w: zigzag,    x: moon,
  y: confetti,  z: prisms,
};

export function trigger(svg: SVGSVGElement, key: string, paletteKey = 'grey'): boolean {
  const fn = ANIM_BY_KEY[key.toLowerCase()];
  if (!fn) return false;
  const w = svg.clientWidth || window.innerWidth;
  const h = svg.clientHeight || window.innerHeight;
  const p = PALETTES[paletteKey] || PALETTES.grey;
  try {
    fn({ svg, w, h, p });
    return true;
  } catch (err) {
    console.error('[svg-anim] error:', err);
    return false;
  }
}

export function getRegisteredKeys(): string[] {
  return Object.keys(ANIM_BY_KEY);
}

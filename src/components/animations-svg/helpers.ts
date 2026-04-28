/**
 * Phase 6 B2 - SVG 动画 helpers（移植 references/aaaa/patatap-engine.jsx）
 */

const NS = 'http://www.w3.org/2000/svg';
export const TAU = Math.PI * 2;

export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const choice = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function makeEl<T extends SVGElement = SVGElement>(
  tag: string,
  attrs: Record<string, string | number> = {},
): T {
  const el = document.createElementNS(NS, tag) as unknown as T;
  for (const k in attrs) (el as Element).setAttribute(k, String(attrs[k]));
  return el;
}

export function animate(
  durMs: number,
  onTick: (t: number) => void,
  onDone?: () => void,
): () => void {
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durMs);
    onTick(t);
    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export const ease = {
  sineOut: (t: number) => Math.sin((t * Math.PI) / 2),
  sineIn: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  sineInOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  cubicOut: (t: number) => 1 - Math.pow(1 - t, 3),
  cubicIn: (t: number) => t * t * t,
  expoOut: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoIn: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  circOut: (t: number) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  circIn: (t: number) => 1 - Math.sqrt(1 - t * t),
};

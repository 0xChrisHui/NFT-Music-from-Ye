import type { AnimFn } from '../types';
import { makeEl, ease } from '../helpers';

/** corona — 三层同心圆环从中心扩散 */
export const corona: AnimFn = ({ svg, w, h, p }) => {
  const cx = w / 2;
  const cy = h / 2;
  const colors = [p.foreground, p.highlight, p.accent];
  const g = makeEl('g');
  svg.appendChild(g);

  interface Ring {
    c: SVGCircleElement;
    delay: number;
  }
  const rings: Ring[] = [];
  for (let i = 0; i < 3; i++) {
    const c = makeEl<SVGCircleElement>('circle', {
      cx, cy, r: 5,
      fill: 'none',
      stroke: colors[i],
      'stroke-width': 3 - i * 0.6,
      opacity: 0.9,
    });
    g.appendChild(c);
    rings.push({ c, delay: i * 60 });
  }

  const startTime = performance.now();
  const dur = 800;
  const maxR = Math.min(w, h) * 0.5;
  let raf = 0;
  const tick = (now: number) => {
    let alive = false;
    rings.forEach((ring) => {
      const tt = (now - startTime - ring.delay) / dur;
      if (tt >= 0 && tt <= 1) {
        alive = true;
        const e = ease.circOut(tt);
        ring.c.setAttribute('r', String(5 + maxR * e));
        ring.c.setAttribute('opacity', String(0.9 * (1 - e)));
      } else if (tt > 1) {
        ring.c.setAttribute('opacity', '0');
      } else {
        alive = true;
      }
    });
    if (alive) raf = requestAnimationFrame(tick);
    else g.remove();
  };
  raf = requestAnimationFrame(tick);
  void raf;
};

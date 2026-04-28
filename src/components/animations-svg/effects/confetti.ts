import type { AnimFn } from '../types';
import { rand, choice, makeEl, animate, ease } from '../helpers';

/** confetti — 彩纸碎片从屏幕一边扇形散开 */
export const confetti: AnimFn = ({ svg, w, h, p }) => {
  const cx = w / 2;
  const cy = h / 2;
  const pos = Math.floor(Math.random() * 4);
  let ox: number;
  let oy: number;
  if (pos === 0) { ox = cx; oy = h * 1.1; }
  else if (pos === 1) { ox = cx; oy = -h * 0.1; }
  else if (pos === 2) { ox = w * 1.1; oy = cy; }
  else { ox = -w * 0.1; oy = cy; }

  const theta = Math.atan2(cy - oy, cx - ox);
  const dev = Math.PI / 2;
  const dist = w;

  const colorKeys: (keyof typeof p)[] = ['foreground', 'middleground', 'highlight', 'accent', 'white'];
  const g = makeEl('g');
  svg.appendChild(g);

  interface Dot {
    c: SVGCircleElement;
    ox: number;
    oy: number;
    tx: number;
    ty: number;
  }
  const dots: Dot[] = [];
  for (let i = 0; i < 28; i++) {
    const t = theta + (Math.random() * 2 - 1) * dev;
    const a = Math.random() * dist;
    const tx = a * Math.cos(t);
    const ty = a * Math.sin(t);
    const r = Math.round(rand(4, 9));
    const colorKey = choice(colorKeys);
    const c = makeEl<SVGCircleElement>('circle', {
      cx: ox, cy: oy, r,
      fill: p[colorKey] as string,
    });
    g.appendChild(c);
    dots.push({ c, ox, oy, tx, ty });
  }

  animate(700, (t) => {
    const e = ease.sineOut(t);
    dots.forEach((d) => {
      d.c.setAttribute('cx', String(d.ox + d.tx * e));
      d.c.setAttribute('cy', String(d.oy + d.ty * e));
    });
  }, () => g.remove());
};

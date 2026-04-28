import type { AnimFn } from '../types';
import { makeEl, animate, ease } from '../helpers';

/** pistons — N 条横活塞（variant 1/2/3 → 5/9/13 条）*/
export const pistons: AnimFn = ({ svg, w, h, p, variant = 1 }) => {
  const cx = w / 2;
  const amount = variant * 4 + 1;
  const barW = w * 0.75;
  const barH = h / amount - h / (amount * 3);
  const fromLeft = Math.random() > 0.5;
  const startX = fromLeft ? -barW : w;
  const endX = fromLeft ? w : -barW;

  const g = makeEl('g');
  svg.appendChild(g);

  interface Bar {
    r: SVGRectElement;
    startX: number;
    endX: number;
  }
  const bars: Bar[] = [];
  for (let i = 0; i < amount; i++) {
    const y = (i + 1) * (h / (amount + 1)) - barH / 2;
    const r = makeEl<SVGRectElement>('rect', {
      x: startX, y, width: barW, height: barH,
      fill: p.white,
    });
    g.appendChild(r);
    bars.push({ r, startX, endX });
  }

  animate(220, (t) => {
    const e = ease.sineOut(t);
    bars.forEach((b) => b.r.setAttribute('x', String(b.startX + (cx - barW / 2 - b.startX) * e)));
  }, () => {
    animate(220, (t) => {
      const e = ease.sineIn(t);
      bars.forEach((b) => b.r.setAttribute('x', String(cx - barW / 2 + (b.endX - (cx - barW / 2)) * e)));
    }, () => g.remove());
  });
};

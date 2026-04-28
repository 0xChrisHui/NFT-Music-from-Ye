import type { AnimFn } from '../types';
import { makeEl, animate, ease } from '../helpers';

/** wipe — 色幕从一侧扫过 */
export const wipe: AnimFn = ({ svg, w, h, p }) => {
  const fromLeft = Math.random() > 0.5;
  const startX = fromLeft ? -w : w;
  const endX = fromLeft ? w * 1.2 : -w * 1.2;
  const rect = makeEl('rect', {
    x: startX, y: 0, width: w, height: h,
    fill: p.middleground,
  });
  svg.appendChild(rect);

  animate(300, (t) => {
    const e = ease.expoOut(t);
    rect.setAttribute('x', String(startX + (0 - startX) * e));
  }, () => {
    animate(300, (t) => {
      const e = ease.expoIn(t);
      rect.setAttribute('x', String(0 + (endX - 0) * e));
    }, () => rect.remove());
  });
};

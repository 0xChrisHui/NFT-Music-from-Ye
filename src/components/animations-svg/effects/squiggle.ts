import type { AnimFn } from '../types';
import { TAU, rand, choice, makeEl, animate, ease } from '../helpers';

/** squiggle — S 形波浪线先描出再擦除 */
export const squiggle: AnimFn = ({ svg, w, h, p }) => {
  const cy = rand(h * 0.25, h * 0.75);
  const amp = rand(20, 80);
  const periods = choice([3, 4, 5]);
  const len = w * 0.7;
  const startX = (w - len) / 2;

  let d = `M ${startX} ${cy}`;
  const pts = 60;
  for (let i = 1; i <= pts; i++) {
    const x = startX + (i / pts) * len;
    const y = cy + Math.sin((i / pts) * TAU * periods) * amp;
    d += ` L ${x} ${y}`;
  }

  const path = makeEl('path', {
    d,
    fill: 'none',
    stroke: p.foreground,
    'stroke-width': 4,
    'stroke-linecap': 'round',
  });

  const totalLen = pts * (len / pts) * 1.4;
  path.setAttribute('stroke-dasharray', String(totalLen));
  path.setAttribute('stroke-dashoffset', String(totalLen));
  svg.appendChild(path);

  animate(280, (t) => {
    const e = ease.sineOut(t);
    path.setAttribute('stroke-dashoffset', String(totalLen * (1 - e)));
  }, () => {
    animate(220, (t) => {
      path.setAttribute('opacity', String(1 - t));
    }, () => path.remove());
  });
};

import type { AnimFn } from '../types';
import { makeEl, animate, ease } from '../helpers';

/** moon — clipPath 揭示一个圆，然后再隐藏 */
export const moon: AnimFn = ({ svg, w, h, p }) => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.33;
  const rot = Math.random() * 360;

  const id = `moon-clip-${Math.random().toString(36).slice(2, 8)}`;
  const clip = makeEl('clipPath', { id });
  const clipRect = makeEl('rect', { x: cx - r, y: cy, width: r * 2, height: 0 });
  clip.appendChild(clipRect);
  const defs = makeEl('defs');
  defs.appendChild(clip);
  svg.appendChild(defs);

  const g = makeEl('g', { transform: `rotate(${rot} ${cx} ${cy})` });
  const circ = makeEl('circle', {
    cx, cy, r,
    fill: p.foreground,
    'clip-path': `url(#${id})`,
  });
  g.appendChild(circ);
  svg.appendChild(g);

  animate(420, (t) => {
    const e = ease.sineOut(t);
    clipRect.setAttribute('y', String(cy - r * e));
    clipRect.setAttribute('height', String(r * 2 * e));
  }, () => {
    animate(420, (t) => {
      const e = ease.sineOut(t);
      clipRect.setAttribute('y', String(cy - r));
      clipRect.setAttribute('height', String(r * 2 * (1 - e)));
    }, () => {
      g.remove();
      defs.remove();
    });
  });
};

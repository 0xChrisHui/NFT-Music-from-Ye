import type { AnimFn } from '../types';
import { TAU, makeEl, animate, ease } from '../helpers';

/** pinwheel — 顶点逐一沿圆周散开形成多边形 */
export const pinwheel: AnimFn = ({ svg, w, h, p }) => {
  const cx = w / 2;
  const cy = h / 2;
  const amount = 8;
  const radius = h / 6;
  const drift = Math.random() * TAU;

  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < amount; i++) verts.push({ x: radius, y: 0 });

  const update = () => {
    poly.setAttribute('points', verts.map((v) => `${v.x},${v.y}`).join(' '));
  };

  const poly = makeEl<SVGPolygonElement>('polygon', {
    points: '',
    fill: p.highlight,
    transform: `translate(${cx} ${cy}) rotate(${(Math.random() * 360).toFixed(1)})`,
  });
  svg.appendChild(poly);
  update();

  let step = 0;
  const stepDur = 90;
  const stepIv = setInterval(() => {
    if (step >= amount) {
      clearInterval(stepIv);
      animate(220, (t) => {
        const e = ease.sineOut(t);
        poly.setAttribute('transform', `translate(${cx} ${cy}) scale(${1 - e})`);
      }, () => poly.remove());
      return;
    }
    const idx = step;
    const center = Math.PI * ((idx + 1) / amount);
    const targets = verts.map((_, j) => {
      const tt = Math.min(j / (idx + 1), 1);
      const angle = tt * TAU + center + drift;
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
    const startVerts = verts.map((v) => ({ x: v.x, y: v.y }));
    animate(stepDur * 1.1, (tt) => {
      const e = ease.sineOut(tt);
      for (let j = 0; j < amount; j++) {
        verts[j].x = startVerts[j].x + (targets[j].x - startVerts[j].x) * e;
        verts[j].y = startVerts[j].y + (targets[j].y - startVerts[j].y) * e;
      }
      update();
    });
    step++;
  }, stepDur);
};

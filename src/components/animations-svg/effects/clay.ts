import type { AnimFn } from '../types';
import { TAU, makeEl, animate, ease } from '../helpers';

/** clay — 多边形朝冲击点变形（受拉扯）*/
export const clay: AnimFn = ({ svg, w, h, p }) => {
  const sides = 12;
  const corner = Math.floor(Math.random() * 8);
  const positions: [number, number][] = [
    [w / 2, 0], [w, 0], [w, h / 2], [w, h],
    [w / 2, h], [0, h], [0, h / 2], [0, 0],
  ];
  const [cx, cy] = positions[corner];
  const distR = Math.max(w, h) * 0.7;
  const impact = { x: Math.random() * w, y: Math.random() * h };

  const startPts: [number, number][] = [];
  const endPts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU;
    const sx = distR * Math.cos(a);
    const sy = distR * Math.sin(a);
    startPts.push([sx, sy]);
    const ix = impact.x - cx;
    const iy = impact.y - cy;
    const dx = ix - sx;
    const dy = iy - sy;
    const d = Math.hypot(dx, dy) + 1;
    const pull = (12 * distR) / Math.sqrt(d);
    endPts.push([sx + (dx / d) * pull, sy + (dy / d) * pull]);
  }

  const path = makeEl('path', {
    d: '',
    fill: p.middleground,
    transform: `translate(${cx} ${cy})`,
  });
  svg.appendChild(path);

  const updatePath = (k: number) => {
    const cur = startPts.map((s, i) => [
      s[0] + (endPts[i][0] - s[0]) * k,
      s[1] + (endPts[i][1] - s[1]) * k,
    ] as [number, number]);
    let dStr = `M ${cur[0][0]} ${cur[0][1]} `;
    for (let i = 1; i <= sides; i++) {
      const p0 = cur[(i - 1) % sides];
      const p1 = cur[i % sides];
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      dStr += `Q ${p0[0]} ${p0[1]} ${mid[0]} ${mid[1]} `;
    }
    dStr += 'Z';
    path.setAttribute('d', dStr);
  };
  updatePath(0);

  animate(700, (t) => {
    const e = ease.circIn(t);
    updatePath(e);
  }, () => path.remove());
};

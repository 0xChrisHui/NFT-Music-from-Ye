/* global React */
// ════════════════════════════════════════════════════════════════════════════
// PATATAP ENGINE — faithful port of jonobr1/patatap visual language to SVG
// Each animation reads from the active palette so they re-color on swap.
// All animations are stateless: spawn(svg, ctx) → schedules its own cleanup.
// ════════════════════════════════════════════════════════════════════════════

// Real Patatap palettes (from uploads/palette.js)
const PATATAP_PALETTES = {
  grey: {
    background: 'rgb(181,181,181)',
    middleground: 'rgb(141,164,170)',
    foreground: 'rgb(227,79,12)',
    highlight: 'rgb(163,141,116)',
    accent: 'rgb(255,197,215)',
    white: 'rgb(255,255,255)',
    black: 'rgb(0,0,0)',
    isDark: false,
    label: 'Grey',
  },
  white: {
    background: 'rgb(255,230,255)',
    middleground: 'rgb(151,41,164)',
    foreground: 'rgb(1,120,186)',
    highlight: 'rgb(255,255,0)',
    accent: 'rgb(255,51,148)',
    white: 'rgb(255,255,255)',
    black: 'rgb(255,255,255)',
    isDark: false,
    label: 'White',
  },
  orange: {
    background: 'rgb(217,82,31)',
    middleground: 'rgb(143,74,45)',
    foreground: 'rgb(255,108,87)',
    highlight: 'rgb(255,126,138)',
    accent: 'rgb(227,190,141)',
    white: 'rgb(255,255,255)',
    black: 'rgb(0,0,0)',
    isDark: false,
    label: 'Orange',
  },
  blue: {
    background: 'rgb(57,109,193)',
    middleground: 'rgb(186,60,223)',
    foreground: 'rgb(213,255,93)',
    highlight: 'rgb(213,160,255)',
    accent: 'rgb(36,221,165)',
    white: 'rgb(215,236,255)',
    black: 'rgb(0,0,0)',
    isDark: true,
    label: 'Blue',
  },
  cream: {
    background: 'rgb(255,244,211)',
    middleground: 'rgb(207,145,79)',
    foreground: 'rgb(38,83,122)',
    highlight: 'rgb(178,87,53)',
    accent: 'rgb(235,192,92)',
    white: 'rgb(226,82,87)',
    black: 'rgb(0,0,0)',
    isDark: false,
    label: 'Cream',
  },
  purple: {
    background: 'rgb(39,6,54)',
    middleground: 'rgb(69,26,87)',
    foreground: 'rgb(252,25,246)',
    highlight: 'rgb(52,255,253)',
    accent: 'rgb(133,102,193)',
    white: 'rgb(253,228,252)',
    black: 'rgb(255,255,255)',
    isDark: true,
    label: 'Purple',
  },
};
window.PATATAP_PALETTES = PATATAP_PALETTES;

const PALETTE_KEYS = ['grey', 'white', 'orange', 'blue', 'cream', 'purple'];
window.PALETTE_KEYS = PALETTE_KEYS;

// ════════════════════════════════════════════════════════════════════════════
// ANIMATION REGISTRY — each entry returns an SVGElement and self-cleans.
// Signatures: spawn({ svg, w, h, palette, key }) → cleanup() | element
// ════════════════════════════════════════════════════════════════════════════

const NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makeEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Run a JS-driven animation loop with a deadline.
function animate(durMs, onTick, onDone) {
  const start = performance.now();
  let raf = 0;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / durMs);
    onTick(t);
    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

const ease = {
  sineOut: (t) => Math.sin((t * Math.PI) / 2),
  sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicIn: (t) => t * t * t,
  expoOut: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoIn: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  circOut: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  circIn: (t) => 1 - Math.sqrt(1 - t * t),
};

// ──────────────────────────────────────────────
// 1. STRIKE — a fast line through the canvas
// ──────────────────────────────────────────────
function strike({ svg, w, h, p }) {
  const cx = w / 2, cy = h / 2;
  const dist = rand(h * 0.5, w * 0.6);
  const theta = Math.random() * TAU;
  const x1 = cx + dist * Math.cos(theta);
  const y1 = cy + dist * Math.sin(theta);
  const x2 = cx + dist * Math.cos(theta + Math.PI);
  const y2 = cy + dist * Math.sin(theta + Math.PI);
  const lw = Math.round(rand(3, 10));
  const line = makeEl('line', {
    x1, y1, x2: x1, y2: y1,
    stroke: p.black, 'stroke-width': lw, 'stroke-linecap': 'round',
  });
  svg.appendChild(line);
  animate(180, (t) => {
    const e = ease.circIn(t);
    line.setAttribute('x2', x1 + (x2 - x1) * e);
    line.setAttribute('y2', y1 + (y2 - y1) * e);
  }, () => {
    animate(450, (t) => {
      const e = ease.circOut(t);
      line.setAttribute('x1', x1 + (x2 - x1) * e);
      line.setAttribute('y1', y1 + (y2 - y1) * e);
    }, () => line.remove());
  });
}

// ──────────────────────────────────────────────
// 2. WIPE — a colored panel sweeps across
// ──────────────────────────────────────────────
function wipe({ svg, w, h, p }) {
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
    rect.setAttribute('x', startX + (0 - startX) * e);
  }, () => {
    animate(300, (t) => {
      const e = ease.expoIn(t);
      rect.setAttribute('x', 0 + (endX - 0) * e);
    }, () => rect.remove());
  });
}

// ──────────────────────────────────────────────
// 3. PRISMS — a polygon that scales out from center
// ──────────────────────────────────────────────
function prisms({ svg, w, h, p }) {
  const cx = w / 2, cy = h / 2;
  const sides = choice([3, 4, 5, 6]);
  const r = Math.min(w, h) * 0.05;
  const pts = [];
  const rot = Math.random() * TAU;
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  const poly = makeEl('polygon', {
    points: pts.join(' '),
    fill: 'none',
    stroke: p.black,
    'stroke-width': 0.8,
  });
  // dots at vertices
  const dots = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const d = makeEl('circle', { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a), r: 3, fill: p.black });
    dots.push(d);
  }
  const g = makeEl('g', { 'transform-origin': `${cx} ${cy}` });
  g.appendChild(poly);
  dots.forEach((d) => g.appendChild(d));
  svg.appendChild(g);
  animate(750, (t) => {
    const e = ease.circIn(t);
    const s = e * 8;
    g.setAttribute('transform', `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`);
    g.setAttribute('opacity', 1 - t * 0.6);
  }, () => g.remove());
}

// ──────────────────────────────────────────────
// 4. PISTONS — horizontal bars shooting across
// ──────────────────────────────────────────────
function pistons({ svg, w, h, p, variant = 1 }) {
  const cx = w / 2, cy = h / 2;
  const amount = variant * 4 + 1;
  const barW = w * 0.75;
  const barH = h / amount - h / (amount * 3);
  const fromLeft = Math.random() > 0.5;
  const startX = fromLeft ? -barW : w;
  const endX = fromLeft ? w : -barW;

  const g = makeEl('g');
  svg.appendChild(g);
  const bars = [];
  for (let i = 0; i < amount; i++) {
    const y = (i + 1) * (h / (amount + 1)) - barH / 2;
    const r = makeEl('rect', { x: startX, y, width: barW, height: barH, fill: p.white });
    g.appendChild(r);
    bars.push({ r, startX, endX });
  }
  animate(220, (t) => {
    const e = ease.sineOut(t);
    bars.forEach((b) => b.r.setAttribute('x', b.startX + (cx - barW / 2 - b.startX) * e));
  }, () => {
    animate(220, (t) => {
      const e = ease.sineIn(t);
      bars.forEach((b) => b.r.setAttribute('x', cx - barW / 2 + (b.endX - (cx - barW / 2)) * e));
    }, () => g.remove());
  });
}

// ──────────────────────────────────────────────
// 5. CONFETTI — colored dots burst from edge
// ──────────────────────────────────────────────
function confetti({ svg, w, h, p }) {
  const cx = w / 2, cy = h / 2;
  const pos = Math.floor(Math.random() * 4);
  let ox, oy;
  if (pos === 0) { ox = cx; oy = h * 1.1; }
  else if (pos === 1) { ox = cx; oy = -h * 0.1; }
  else if (pos === 2) { ox = w * 1.1; oy = cy; }
  else { ox = -w * 0.1; oy = cy; }
  const theta = Math.atan2(cy - oy, cx - ox);
  const dev = Math.PI / 2;
  const dist = w;

  const colorKeys = ['foreground', 'middleground', 'highlight', 'accent', 'white'];
  const g = makeEl('g');
  svg.appendChild(g);
  const dots = [];
  for (let i = 0; i < 28; i++) {
    const t = theta + (Math.random() * 2 - 1) * dev;
    const a = Math.random() * dist;
    const tx = a * Math.cos(t);
    const ty = a * Math.sin(t);
    const r = Math.round(rand(4, 9));
    const c = makeEl('circle', { cx: ox, cy: oy, r, fill: p[choice(colorKeys)] });
    g.appendChild(c);
    dots.push({ c, ox, oy, tx, ty });
  }
  animate(700, (t) => {
    const e = ease.sineOut(t);
    dots.forEach((d) => {
      d.c.setAttribute('cx', d.ox + d.tx * e);
      d.c.setAttribute('cy', d.oy + d.ty * e);
    });
  }, () => g.remove());
}

// ──────────────────────────────────────────────
// 6. BUBBLES — circle of dots tracing a ring
// ──────────────────────────────────────────────
function bubbles({ svg, w, h, p }) {
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) / 3;
  const bubbleR = Math.min(w, h) / 90;
  const amount = 24;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const rot = Math.random() * TAU;
  const g = makeEl('g', { transform: `translate(${cx} ${cy}) rotate(${(rot * 180) / Math.PI})` });
  svg.appendChild(g);

  const circles = [];
  for (let i = 0; i < amount; i++) {
    const c = makeEl('circle', { cx: radius, cy: 0, r: bubbleR, fill: p.black, opacity: 0 });
    g.appendChild(c);
    circles.push(c);
  }
  // Sequentially light them around the ring
  let i = 0;
  const stepDur = 28;
  const interval = setInterval(() => {
    if (i >= amount) {
      clearInterval(interval);
      // fade out
      animate(280, (t) => {
        circles.forEach((c) => c.setAttribute('opacity', 1 - t));
      }, () => g.remove());
      return;
    }
    const a = (i / amount) * TAU * direction;
    circles[i].setAttribute('cx', radius * Math.cos(a));
    circles[i].setAttribute('cy', radius * Math.sin(a));
    circles[i].setAttribute('opacity', 1);
    i++;
  }, stepDur);
}

// ──────────────────────────────────────────────
// 7. ZIGZAG — lightning bolt drawn on, drawn off
// ──────────────────────────────────────────────
function zigzag({ svg, w, h, p }) {
  const fromLeft = Math.random() > 0.5;
  const cx = fromLeft ? w * 0.15 : w * 0.85;
  const cy = h / 2;
  const phi = choice([2, 3, 4, 5]);
  const width = w / 16;
  const height = h * 0.66;
  const amount = 80;
  const rotate = Math.random() > 0.5 ? 180 : 0;
  const pts = [];
  for (let i = 0; i < amount; i++) {
    const pct = i / amount;
    const triangle = Math.abs((((2 * (pct * TAU * phi + Math.PI / 2)) / Math.PI) - 1) % 4 - 2) - 1;
    const x = (triangle * width) / 2;
    const y = -height / 2 + pct * height;
    pts.push([x, y]);
  }
  const totalLen = pts.reduce((acc, pt, idx) => idx === 0 ? 0 : acc + Math.hypot(pt[0] - pts[idx - 1][0], pt[1] - pts[idx - 1][1]), 0);
  const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`).join(' ');
  const path = makeEl('path', {
    d, fill: 'none', stroke: p.black, 'stroke-width': Math.min(w, h) / 30,
    'stroke-linecap': 'butt', 'stroke-linejoin': 'miter',
    transform: `translate(${cx} ${cy}) rotate(${rotate})`,
    'stroke-dasharray': `${totalLen} ${totalLen}`,
    'stroke-dashoffset': totalLen,
  });
  svg.appendChild(path);
  animate(220, (t) => {
    const e = ease.sineOut(t);
    path.setAttribute('stroke-dashoffset', totalLen * (1 - e));
  }, () => {
    animate(220, (t) => {
      const e = ease.sineOut(t);
      path.setAttribute('stroke-dasharray', `${totalLen * (1 - e)} ${totalLen * e + 0.1} ${totalLen * e}`);
    }, () => path.remove());
  });
}

// ──────────────────────────────────────────────
// 8. PINWHEEL — sequential vertices spin around
// ──────────────────────────────────────────────
function pinwheel({ svg, w, h, p }) {
  const cx = w / 2, cy = h / 2;
  const amount = 8;
  const radius = h / 6;
  const drift = Math.random() * TAU;
  // Polygon will morph as vertices migrate around the circle.
  const verts = [];
  for (let i = 0; i < amount; i++) verts.push({ x: radius, y: 0 });
  const update = () => {
    poly.setAttribute('points', verts.map((v) => `${v.x},${v.y}`).join(' '));
  };
  const poly = makeEl('polygon', { points: '', fill: p.highlight, transform: `translate(${cx} ${cy}) rotate(${(Math.random() * 360).toFixed(1)})` });
  svg.appendChild(poly);
  update();

  // Sequence: vertex i moves to its destination angle.
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
      const t = Math.min(j / (idx + 1), 1);
      const angle = t * TAU + center + drift;
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
}

// ──────────────────────────────────────────────
// 9. MOON — half-circle reveals into a full disc
// ──────────────────────────────────────────────
function moon({ svg, w, h, p }) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.33;
  const rot = Math.random() * 360;
  // Use a path with two arcs — start as a flat line, animate to a circle.
  // Simpler: animate a clipPath revealing a circle from the bottom up, then receding.
  const id = `moon-clip-${Math.random().toString(36).slice(2, 8)}`;
  const clip = makeEl('clipPath', { id });
  const clipRect = makeEl('rect', { x: cx - r, y: cy, width: r * 2, height: 0 });
  clip.appendChild(clipRect);
  const defs = makeEl('defs');
  defs.appendChild(clip);
  svg.appendChild(defs);
  const g = makeEl('g', { transform: `rotate(${rot} ${cx} ${cy})` });
  const circ = makeEl('circle', { cx, cy, r, fill: p.foreground, 'clip-path': `url(#${id})` });
  g.appendChild(circ);
  svg.appendChild(g);
  animate(420, (t) => {
    const e = ease.sineOut(t);
    clipRect.setAttribute('y', cy - r * e);
    clipRect.setAttribute('height', r * 2 * e);
  }, () => {
    animate(420, (t) => {
      const e = ease.sineOut(t);
      clipRect.setAttribute('y', cy - r);
      clipRect.setAttribute('height', r * 2 * (1 - e));
    }, () => { g.remove(); defs.remove(); });
  });
}

// ──────────────────────────────────────────────
// 10. CLAY — blob deforms toward an impact point
// ──────────────────────────────────────────────
function clay({ svg, w, h, p }) {
  const sides = 12;
  // Spawn from a corner / edge.
  const corner = Math.floor(Math.random() * 8);
  const positions = [
    [w / 2, 0], [w, 0], [w, h / 2], [w, h],
    [w / 2, h], [0, h], [0, h / 2], [0, 0],
  ];
  const [cx, cy] = positions[corner];
  const distR = Math.max(w, h) * 0.7;
  const impact = { x: Math.random() * w, y: Math.random() * h };

  const startPts = [];
  const endPts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU;
    const sx = distR * Math.cos(a);
    const sy = distR * Math.sin(a);
    startPts.push([sx, sy]);
    // pull toward impact a little
    const ix = impact.x - cx, iy = impact.y - cy;
    const dx = ix - sx, dy = iy - sy;
    const d = Math.hypot(dx, dy) + 1;
    const pull = 12 * distR / Math.sqrt(d);
    endPts.push([sx + (dx / d) * pull, sy + (dy / d) * pull]);
  }
  const path = makeEl('path', { d: '', fill: p.middleground, transform: `translate(${cx} ${cy})` });
  svg.appendChild(path);
  const updatePath = (k) => {
    const cur = startPts.map((s, i) => [
      s[0] + (endPts[i][0] - s[0]) * k,
      s[1] + (endPts[i][1] - s[1]) * k,
    ]);
    // smooth via simple Catmull-Rom to bezier
    let d = `M ${cur[0][0]} ${cur[0][1]} `;
    for (let i = 1; i <= sides; i++) {
      const p0 = cur[(i - 1) % sides];
      const p1 = cur[i % sides];
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      d += `Q ${p0[0]} ${p0[1]} ${mid[0]} ${mid[1]} `;
    }
    d += 'Z';
    path.setAttribute('d', d);
  };
  updatePath(0);
  animate(700, (t) => {
    const e = ease.circIn(t);
    updatePath(e);
  }, () => path.remove());
}

// ──────────────────────────────────────────────
// 11. CORONA — concentric expanding rings
// ──────────────────────────────────────────────
function corona({ svg, w, h, p }) {
  const cx = w / 2, cy = h / 2;
  const colors = [p.foreground, p.highlight, p.accent];
  const g = makeEl('g');
  svg.appendChild(g);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const c = makeEl('circle', {
      cx, cy, r: 5, fill: 'none',
      stroke: colors[i], 'stroke-width': 3 - i * 0.6, opacity: 0.9,
    });
    g.appendChild(c);
    rings.push({ c, delay: i * 60 });
  }
  const startTime = performance.now();
  const dur = 800;
  const maxR = Math.min(w, h) * 0.5;
  let raf = 0;
  const tick = (now) => {
    let alive = false;
    rings.forEach((ring) => {
      const tt = (now - startTime - ring.delay) / dur;
      if (tt >= 0 && tt <= 1) {
        alive = true;
        const e = ease.circOut(tt);
        ring.c.setAttribute('r', 5 + maxR * e);
        ring.c.setAttribute('opacity', 0.9 * (1 - e));
      } else if (tt > 1) {
        ring.c.setAttribute('opacity', 0);
      } else {
        alive = true;
      }
    });
    if (alive) raf = requestAnimationFrame(tick);
    else g.remove();
  };
  raf = requestAnimationFrame(tick);
}

// ──────────────────────────────────────────────
// 12. SQUIGGLE — wavy line stretches across
// ──────────────────────────────────────────────
function squiggle({ svg, w, h, p }) {
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
    d, fill: 'none', stroke: p.foreground,
    'stroke-width': 4, 'stroke-linecap': 'round',
  });
  // Use stroke-dasharray for draw-on/off
  // Approximate length
  const totalLen = pts * (len / pts) * 1.4;
  path.setAttribute('stroke-dasharray', `${totalLen}`);
  path.setAttribute('stroke-dashoffset', totalLen);
  svg.appendChild(path);
  animate(280, (t) => {
    const e = ease.sineOut(t);
    path.setAttribute('stroke-dashoffset', totalLen * (1 - e));
  }, () => {
    animate(220, (t) => {
      path.setAttribute('opacity', 1 - t);
    }, () => path.remove());
  });
}

// ──────────────────────────────────────────────
// Map A–Z to animation functions (mix of all the above)
// ──────────────────────────────────────────────
const ANIM_BY_KEY = {
  a: bubbles,    b: clay,       c: confetti,   d: corona,
  e: pinwheel,   f: pistons,    g: prisms,     h: squiggle,
  i: strike,     j: wipe,       k: zigzag,     l: moon,
  m: bubbles,    n: clay,       o: confetti,   p: corona,
  q: pinwheel,   r: pistons,    s: prisms,     t: squiggle,
  u: strike,     v: wipe,       w: zigzag,     x: moon,
  y: confetti,   z: prisms,
};

// Public API: trigger an animation for a given key
function triggerKey({ svg, w, h, paletteKey, key, animKey }) {
  const palette = PATATAP_PALETTES[paletteKey] || PATATAP_PALETTES.purple;
  const fn = ANIM_BY_KEY[animKey || key] || strike;
  try { fn({ svg, w, h, p: palette, key }); } catch (err) {
    console.error('anim err', err);
  }
}
window.triggerKey = triggerKey;

// Animation names for label display
const ANIM_NAMES = {
  bubbles, clay, confetti, corona, pinwheel,
  pistons, prisms, squiggle, strike, wipe, zigzag, moon,
};
window.ANIM_NAMES = Object.keys(ANIM_NAMES);

// Export ANIM_BY_KEY so jam canvas can show what each key triggers
window.ANIM_BY_KEY = ANIM_BY_KEY;

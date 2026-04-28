/* global React, d3 */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ════════════════════════════════════════════════════════════════════════════
// POND JAM — fused canvas: spheres (top layer) + Patatap animations (bottom)
// Pressing A–Z fires:
//   1) Patatap animation behind everything (center-radiating)
//   2) Closest matching sphere pulses + plays its tone
// Clicking a sphere also fires (sphere position becomes the visual origin glow).
// SPACE = pure mode (UI + spheres hide; only animations).
// Auto-records on first hit, like the Jam canvas.
// ════════════════════════════════════════════════════════════════════════════

const PJ_SEASONS = [
  { id: 'spring', label: '春 SPRING', range: [0, 27],  accent: '#9DD9A8' },
  { id: 'summer', label: '夏 SUMMER', range: [27, 54], accent: '#F0A050' },
  { id: 'autumn', label: '秋 AUTUMN', range: [54, 81], accent: '#E47C5A' },
  { id: 'winter', label: '冬 WINTER', range: [81, 108],accent: '#7BA8E8' },
];
const PJ_PALETTES = {
  spring: ['#9DD9A8','#7BC890','#B3E6BC','#5EB079','#A8DEB1','#76C68C','#90D4A0','#84CD96'],
  summer: ['#F0A050','#D97828','#F4BC6A','#C46018','#E8883A','#FAD080','#D06820','#F09840'],
  autumn: ['#E47C5A','#C95C44','#EDA088','#B14A35','#D9694F','#F1B4A0','#A24026','#E08366'],
  winter: ['#7BA8E8','#5C8AD0','#9CC0F4','#4B7DC0','#86B0E8','#3D6FB4','#A8CCFC','#6898D8'],
};

function pjImportance(seed) {
  return 0.32 + ((seed * 1023) % 100) / 100 * 0.63;
}

function buildPondGraph(allTracks, season) {
  const [from, to] = season.range;
  const slice = allTracks.slice(from, to);
  const palette = PJ_PALETTES[season.id];
  const seasonIdx = PJ_SEASONS.findIndex((s) => s.id === season.id);
  const nodes = slice.map((trk, i) => {
    const imp = pjImportance(trk.seed);
    return {
      ...trk,
      importance: imp,
      radius: 16 + imp * 36,
      color: palette[i % palette.length],
      crossSeason: ((trk.week * 7) % 5 === 0) ? PJ_SEASONS[(seasonIdx + 1 + (trk.week % 3)) % 4].id : null,
      // each sphere is bound to a letter (deterministic A–Z)
      letter: String.fromCharCode(97 + (trk.week - 1) % 26),
    };
  });
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const seed = ((a.week * 17 + b.week * 31 + a.week * b.week) % 97) / 97;
      const avgImp = (a.importance + b.importance) / 2;
      if (seed < avgImp * 0.5) {
        const corr = 0.18 + ((a.week * 3 + b.week * 7) % 10) / 13;
        links.push({ source: a.week, target: b.week, correlation: Math.min(0.95, corr) });
      }
    }
  }
  return { nodes, links };
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────
function PondJam({ tracks, initialPaletteKey = 'purple' }) {
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [paletteKey, setPaletteKey] = useState(initialPaletteKey);
  const [pure, setPure] = useState(false);
  const seasonSwitchTokenRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [recStart, setRecStart] = useState(null);
  const [notes, setNotes] = useState([]);
  const [keyHits, setKeyHits] = useState([]);
  const [, setTick] = useState(0);
  const [hoverNode, setHoverNode] = useState(null);
  const [pulses, setPulses] = useState([]); // sphere pulse rings
  const [nowPlaying, setNowPlaying] = useState(null); // week being "listened to"
  const animSvgRef = useRef(null);
  const graphSvgRef = useRef(null);
  const wrapRef = useRef(null);
  const simRef = useRef(null);
  const sphereRefs = useRef(new Map()); // week -> g element
  const lastPlayedRef = useRef(null);
  const pulseSphereRef = useRef(null);
  const allShimmerRef = useRef(null);
  const nowPlayingRef = useRef(null);

  const season = PJ_SEASONS[seasonIdx];
  const palette = window.PATATAP_PALETTES[paletteKey];
  const graph = useMemo(() => buildPondGraph(tracks, season), [tracks, season]);

  // Switch season with a 1-second high-rebound impulse to the simulation,
  // then settle back to the always-alive idle state.
  const switchSeason = useCallback((nextIdx) => {
    setSeasonIdx((cur) => (cur === nextIdx ? cur : nextIdx));
    setNowPlaying(null); // entering a new season clears the now-playing context
    // After the new graph mounts (next frame), give the simulation a kick.
    requestAnimationFrame(() => {
      const sim = simRef.current;
      if (!sim) return;
      const token = ++seasonSwitchTokenRef.current;
      sim.alphaTarget(0.55).alpha(0.65).velocityDecay(0.30).restart();
      setTimeout(() => {
        if (seasonSwitchTokenRef.current !== token) return; // a newer switch happened
        if (simRef.current !== sim) return; // graph rebuilt; new sim handles its own settle
        sim.alphaTarget(0.04).velocityDecay(0.55);
      }, 1000);
    });
  }, []);

  // Resize
  const [size, setSize] = useState({ w: 1600, h: 920 });
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = wrapRef.current.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    const r = wrapRef.current.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  // Build / rebuild the d3-force graph whenever season or size changes
  useEffect(() => {
    if (!graphSvgRef.current || !window.d3 || size.w < 100) return;
    const W = size.w, H = size.h;
    const cx = W / 2, cy = H / 2;
    const svg = d3.select(graphSvgRef.current);
    const linksG = svg.select('#pj-links');
    const nodesG = svg.select('#pj-nodes');
    linksG.selectAll('*').remove();
    nodesG.selectAll('*').remove();
    sphereRefs.current.clear();

    if (simRef.current) simRef.current.stop();

    const nodes = graph.nodes.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * Math.min(W, H) * 0.7,
      y: cy + (Math.random() - 0.5) * Math.min(W, H) * 0.7,
    }));
    const links = graph.links.map((l) => ({ ...l }));

    const linkSel = linksG.selectAll('line')
      .data(links).enter().append('line')
      .attr('stroke', (d) => {
        const src = nodes.find((n) => n.week === (d.source.week ?? d.source));
        return src ? src.color : season.accent;
      })
      .attr('stroke-width', (d) => 0.4 + d.correlation * 1.6)
      .attr('stroke-opacity', (d) => 0.06 + d.correlation * 0.18)
      .attr('fill', 'none')
      .attr('pointer-events', 'none');

    const ng = nodesG.selectAll('g.pj-node')
      .data(nodes, (d) => d.week)
      .enter().append('g')
      .attr('class', 'pj-node')
      .style('cursor', 'pointer');

    ['r1', 'r2', 'r3'].forEach((cls) => {
      ng.append('circle')
        .attr('class', `pj-ripple ${cls}`)
        .attr('r', (d) => d.radius)
        .attr('fill', 'none')
        .attr('stroke', (d) => d.color)
        .attr('stroke-width', 1.2)
        .attr('pointer-events', 'none');
    });

    ng.filter((d) => !!d.crossSeason)
      .append('circle')
      .attr('r', (d) => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => PJ_SEASONS.find((s) => s.id === d.crossSeason)?.accent ?? '#fff')
      .attr('stroke-width', 1.1)
      .attr('stroke-dasharray', '3.5 3')
      .attr('opacity', 0.4)
      .attr('pointer-events', 'none');

    // Pulse ring (animated when sphere is hit). Stays at r=0 normally.
    ng.append('circle')
      .attr('class', 'pj-pulse')
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none')
      .attr('opacity', 0);

    ng.append('circle')
      .attr('class', 'pj-circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', (d) => 0.5 + d.importance * 0.36)
      .attr('filter', 'url(#pj-glow)');

    // Inner wave-line (cover DNA)
    ng.append('path')
      .attr('d', (d) => {
        const r = d.radius;
        const amp = r * 0.22;
        const ww = r * 1.55;
        let p = `M ${-ww / 2} 0`;
        for (let x = -ww / 2 + 4; x <= ww / 2; x += 4) {
          const y = Math.sin((x / ww) * Math.PI * 3 + d.seed * 6) * amp;
          p += ` L ${x} ${y.toFixed(1)}`;
        }
        return p;
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('fill', 'none')
      .attr('opacity', 0.18)
      .attr('pointer-events', 'none');

    // Week number inside (the song's identity, NOT the keyboard binding)
    ng.append('text')
      .attr('class', 'pj-week-num')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius > 28 ? d.radius * 0.18 : 4)
      .attr('font-family', "'Cormorant Garamond', serif")
      .attr('font-style', 'italic')
      .attr('font-weight', 300)
      .attr('font-size', (d) => Math.max(11, d.radius * 0.78))
      .attr('letter-spacing', '0.01em')
      .attr('fill', 'rgba(255,255,255,0.94)')
      .attr('pointer-events', 'none')
      .text((d) => d.week);

    // Title below
    ng.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 16)
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', 11)
      .attr('font-weight', 300)
      .attr('letter-spacing', '0.08em')
      .attr('fill', 'rgba(232,228,217,0.78)')
      .attr('pointer-events', 'none')
      .text((d) => d.title);

    ng.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 30)
      .attr('font-family', "'Azeret Mono', monospace")
      .attr('font-size', 8.5)
      .attr('letter-spacing', '0.18em')
      .attr('fill', 'rgba(232,228,217,0.32)')
      .attr('pointer-events', 'none')
      .text((d) => `W${String(d.week).padStart(2, '0')}`);

    // Now-playing ring — only visible on the active song
    ng.append('circle')
      .attr('class', 'pj-now-ring')
      .attr('r', (d) => d.radius + 10)
      .attr('fill', 'none')
      .attr('stroke', '#fcf3e0')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .attr('pointer-events', 'none')
      .attr('stroke-dasharray', '4 5')
      .style('transition', 'opacity 0.3s');

    // Hover ▶ overlay
    ng.append('circle')
      .attr('class', 'pj-hover')
      .attr('r', 16)
      .attr('fill', 'rgba(0,0,0,0.55)')
      .attr('stroke', 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 1)
      .attr('opacity', 0)
      .attr('pointer-events', 'none')
      .style('transition', 'opacity 0.18s');

    // Save sphere refs
    ng.each(function (d) {
      sphereRefs.current.set(d.week, this);
    });

    // Drag — high responsiveness while dragging; on release, do NOT yank the
    // sphere back. Soft-release fx/fy over ~250ms so it "lands" at the drop
    // point, then physics gently breathes around it. The pond remembers.
    const drag = d3.drag()
      .on('start', (e, d) => {
        d._dragged = false;
        d.fx = d.x; d.fy = d.y;
        if (simRef.current) {
          simRef.current.alphaTarget(0.18);
          simRef.current.velocityDecay(0.45);
          simRef.current.restart();
        }
      })
      .on('drag', (e, d) => {
        if (!d._dragged) d._dragged = true;
        d.fx = e.x; d.fy = e.y;
      })
      .on('end', (e, d) => {
        // Soft release: gradually loosen the pin instead of snapping it free,
        // so the sphere doesn't get yanked back to its old equilibrium.
        const startX = d.fx, startY = d.fy;
        const t0 = performance.now();
        const dur = 240;
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / dur);
          // Hold position firmly at first, then ease the pin away.
          const k = 1 - t;
          d.fx = startX; d.fy = startY;
          if (t < 1) requestAnimationFrame(step);
          else { d.fx = null; d.fy = null; }
        };
        requestAnimationFrame(step);
        if (simRef.current) {
          simRef.current.alphaTarget(0.04);
          simRef.current.velocityDecay(0.62); // calmer settle = less rebound
        }
      });
    ng.call(drag);

    ng.on('mouseenter', function (e, d) {
      const sel = d3.select(this);
      sel.select('.pj-hover').attr('opacity', 1);
      sel.select('.pj-circle').attr('r', d.radius * 1.07);
      setHoverNode(d);
    })
    .on('mouseleave', function (e, d) {
      const sel = d3.select(this);
      sel.select('.pj-hover').attr('opacity', 0);
      sel.select('.pj-circle').attr('r', d.radius);
      setHoverNode(null);
    })
      .on('click', function (e, d) {
        if (d._dragged) return;
        e.stopPropagation();
        // Click a sphere → enter "listening to this song" state.
        // Toggle if same sphere clicked again.
        setNowPlaying((cur) => (cur === d.week ? null : d.week));
        // Visual pulse on the sphere itself (not coupled to keyboard)
        pulseSphereRef.current?.(d.week);
      });

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.week)
        .distance((d) => 140 + (1 - d.correlation) * 130)
        .strength((d) => d.correlation * 0.18))
      .force('charge', d3.forceManyBody().strength((d) => -(520 * (0.6 + d.importance * 0.8))))
      .force('collide', d3.forceCollide().radius((d) => d.radius * 1.05 + 28).strength(0.92).iterations(4))
      .force('center', d3.forceCenter(cx, cy).strength(0.02))
      // — physics tuned for a permanently-living pond —
      // alphaMin = 0 means alpha never auto-stops; we keep alphaTarget > 0 so it never freezes.
      .alphaMin(0)
      .alphaTarget(0.5)         // initial settle: high flow for ~1s
      .alphaDecay(0.05)         // settles toward target in <1s
      .velocityDecay(0.32)      // low damping during initial settle (high rebound)
      .on('tick', () => {
        linkSel
          .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
          .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
        ng.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });
    simRef.current = sim;

    // After ~1 second of high-rebound flow, settle to "always-alive" idle:
    //   alphaTarget = 0.04 keeps a low pulse of activity forever (so drift is real),
    //   velocityDecay = 0.55 gives a calm-but-responsive rest state.
    const settleTimer = setTimeout(() => {
      if (simRef.current === sim) {
        sim.alphaTarget(0.04);
        sim.velocityDecay(0.55);
      }
    }, 1000);

    return () => { clearTimeout(settleTimer); sim.stop(); };
  }, [graph, season, size.w, size.h]);

  // Pond-drift: every ~2.5s nudge a few random nodes slightly so the system
  // keeps gently breathing even when nobody touches it.
  useEffect(() => {
    const id = setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      const ns = sim.nodes();
      if (!ns.length) return;
      // Pick 3 random nodes; give them a tiny velocity kick (no fx, so physics carries it).
      for (let i = 0; i < 3; i++) {
        const n = ns[Math.floor(Math.random() * ns.length)];
        if (n.fx != null) continue; // skip if user is dragging this one
        n.vx = (n.vx || 0) + (Math.random() - 0.5) * 1.4;
        n.vy = (n.vy || 0) + (Math.random() - 0.5) * 1.4;
      }
      // Make sure the simulation isn't completely asleep
      if (sim.alpha() < 0.04) sim.alpha(0.06);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // Pulse a specific sphere (purely visual; called from sphere clicks)
  const pulseSphere = useCallback((week) => {
    const g = sphereRefs.current.get(week);
    if (!g) return;
    const node = graph.nodes.find((n) => n.week === week);
    if (!node) return;
    const pulse = g.querySelector('.pj-pulse');
    const circle = g.querySelector('.pj-circle');
    if (!pulse || !circle) return;
    const r0 = node.radius;
    const start = performance.now();
    const dur = 700;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      const e = 1 - Math.pow(1 - t, 2.4);
      pulse.setAttribute('r', r0 + e * 90);
      pulse.setAttribute('opacity', 0.7 * (1 - t));
      pulse.setAttribute('stroke-width', 2 + (1 - t) * 1.5);
      if (t < 1) requestAnimationFrame(step);
      else { pulse.setAttribute('opacity', 0); pulse.setAttribute('r', 0); }
    };
    requestAnimationFrame(step);
    circle.setAttribute('r', r0 * 1.18);
    setTimeout(() => circle.setAttribute('r', r0), 180);
  }, [graph]);
  useEffect(() => { pulseSphereRef.current = pulseSphere; }, [pulseSphere]);

  // Single-sphere shimmer — only the now-playing sphere ripples on key press.
  // (When nothing is playing, no sphere is bound to keys at all.)
  const shimmerActiveSphere = useCallback(() => {
    if (nowPlaying == null) return;
    const g = sphereRefs.current.get(nowPlaying);
    if (!g) return;
    const node = graph.nodes.find((n) => n.week === nowPlaying);
    if (!node) return;
    const circle = g.querySelector('.pj-circle');
    if (!circle) return;
    const r0 = node.radius;
    circle.setAttribute('r', r0 * 1.10);
    setTimeout(() => circle.setAttribute('r', r0), 170);
  }, [graph, nowPlaying]);
  useEffect(() => { allShimmerRef.current = shimmerActiveSphere; }, [shimmerActiveSphere]);

  // Update the now-playing golden ring + dim non-active spheres + reposition
  // the active sphere to screen center as part of the "enter jam stage" ritual.
  // When nowPlaying is set, the entire pond becomes the immersive Patatap canvas
  // with the chosen song as its centerpiece. When cleared, everything restores.
  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
    const playing = nowPlaying != null;
    const cx = size.w / 2, cy = size.h / 2;

    sphereRefs.current.forEach((g, week) => {
      const ring = g.querySelector('.pj-now-ring');
      if (ring) ring.setAttribute('opacity', week === nowPlaying ? 0.85 : 0);
      const isActive = week === nowPlaying;
      g.style.transition = 'opacity 600ms ease';
      g.style.opacity = !playing ? 1 : (isActive ? 1 : 0);

      // Pin the active sphere to screen center (it floats up to be the
      // jam-stage centerpiece). Release on exit.
      const node = graph.nodes.find((n) => n.week === week);
      if (!node) return;
      if (isActive) {
        node._stagePinX = node.x; node._stagePinY = node.y; // remember origin
        // Smoothly tween the active sphere from its current spot to screen
        // center over ~650ms (mirrors the curtain rise). d3 will pick up
        // fx/fy on every tick, so we just animate fx/fy directly.
        const fromX = node.x ?? cx, fromY = node.y ?? cy;
        const t0 = performance.now();
        const dur = 650;
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const stepIn = () => {
          if (nowPlayingRef.current !== week) return; // user already exited
          const t = Math.min(1, (performance.now() - t0) / dur);
          const k = ease(t);
          node.fx = fromX + (cx - fromX) * k;
          node.fy = fromY + (cy - fromY) * k;
          if (simRef.current) simRef.current.alpha(0.15);
          if (t < 1) requestAnimationFrame(stepIn);
        };
        requestAnimationFrame(stepIn);
        // simultaneously enlarge the active sphere to feel like a stage
        const circle = g.querySelector('.pj-circle');
        const pulse = g.querySelector('.pj-pulse');
        if (circle) {
          circle.style.transition = 'r 650ms cubic-bezier(0.22, 1, 0.36, 1), fill-opacity 650ms ease';
          circle.setAttribute('r', node.radius * 2.3);
          circle.setAttribute('fill-opacity', 0.42);
        }
        if (pulse) pulse.setAttribute('r', 0);
      } else if (node._stagePinX != null && node._stagePinY != null) {
        // restoring: release fixed position so physics can carry it home
        node.fx = null; node.fy = null;
        node._stagePinX = null; node._stagePinY = null;
        const circle = g.querySelector('.pj-circle');
        if (circle) {
          circle.style.transition = 'all 500ms cubic-bezier(0.22, 1, 0.36, 1)';
          circle.setAttribute('r', node.radius);
          circle.setAttribute('fill-opacity', 0.5 + node.importance * 0.36);
        }
      }
    });

    // Hide all links during play mode (the jam stage should be uncluttered).
    if (graphSvgRef.current) {
      const lines = graphSvgRef.current.querySelectorAll('#pj-links line');
      lines.forEach((ln) => {
        ln.style.transition = 'opacity 500ms ease';
        ln.style.opacity = playing ? 0 : '';
      });
    }

    // Wake the simulation up so released spheres can actually drift home.
    if (simRef.current && !playing) {
      simRef.current.alphaTarget(0.18).alpha(0.4).restart();
      setTimeout(() => {
        if (simRef.current) simRef.current.alphaTarget(0.04);
      }, 800);
    }
  }, [nowPlaying, graph, size.w, size.h]);

  // Animate the now-playing ring (rotating dasharray)
  useEffect(() => {
    if (nowPlaying == null) return;
    let raf, t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) * 0.06;
      const g = sphereRefs.current.get(nowPlaying);
      if (g) {
        const ring = g.querySelector('.pj-now-ring');
        if (ring) ring.setAttribute('stroke-dashoffset', -t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nowPlaying]);

  // The fire function — invoked by keyboard or the bottom-keyboard strip.
  // Keyboard A–Z = an INSTRUMENT, decoupled from any specific song/sphere.
  const fireKey = useCallback((rawKey) => {
    const key = String(rawKey).toLowerCase();
    if (!/^[a-z]$/.test(key)) return;

    // 1) Patatap animation behind everything
    if (animSvgRef.current && window.triggerKey) {
      window.triggerKey({
        svg: animSvgRef.current,
        w: size.w, h: size.h,
        paletteKey, key, animKey: key,
      });
    }

    // 2) Tone (placeholder; real samples come later)
    if (window.playJamTone) window.playJamTone(key, paletteKey);
    else if (window.playTone) window.playTone(key);

    // 3) Only the NOW-PLAYING sphere shimmers (if any). Otherwise the keyboard
    //    is purely ambient — it doesn't disturb the pond.
    allShimmerRef.current?.();

    // 4) Recording — note which song you're currently listening to (nowPlaying)
    const ctx = nowPlaying;
    if (!recording) {
      setRecording(true);
      const start = performance.now();
      setRecStart(start);
      setNotes([{ key, week: ctx, t: 0 }]);
    } else {
      setNotes((n) => [...n, { key, week: ctx, t: performance.now() - recStart }]);
    }

    // 5) Key flash on the bottom strip
    const id = Math.random();
    setKeyHits((h) => [...h, { id, key }]);
    setTimeout(() => setKeyHits((h) => h.filter((x) => x.id !== id)), 1100);

    lastPlayedRef.current = key;
  }, [size, paletteKey, recording, recStart, nowPlaying]);

  // Stable ref so d3 click handler can call latest fireKey
  const fireKeyRef = useRef(fireKey);
  useEffect(() => { fireKeyRef.current = fireKey; }, [fireKey]);

  // Recording timer
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [recording]);

  // Keyboard listener
  useEffect(() => {
    const down = new Set();
    const handle = (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ' && !e.repeat) { e.preventDefault(); setPure((p) => !p); return; }
      if (k === 'arrowright') { switchSeason((seasonIdx + 1) % PJ_SEASONS.length); return; }
      if (k === 'arrowleft') { switchSeason((seasonIdx + PJ_SEASONS.length - 1) % PJ_SEASONS.length); return; }
      if (k.length !== 1 || !/[a-z]/.test(k)) return;
      if (down.has(k)) return;
      down.add(k);
      fireKey(k);
    };
    const up = (e) => down.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handle);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', handle);
      window.removeEventListener('keyup', up);
    };
  }, [fireKey]);

  const elapsed = recording && recStart
    ? (performance.now() - recStart) / 1000
    : (notes.length ? notes[notes.length - 1].t / 1000 : 0);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s * 10) % 10))}`;

  const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const playMode = nowPlaying != null;
  const activeNode = playMode ? graph.nodes.find((n) => n.week === nowPlaying) : null;

  return (
    <div ref={wrapRef} style={{
      position: 'relative', width: '100%', height: '100%',
      background: palette.background,
      overflow: 'hidden', userSelect: 'none',
      fontFamily: "'Azeret Mono', monospace",
      color: palette.isDark ? palette.white : palette.black,
      cursor: pure ? 'none' : 'default',
    }}>
      {/* Layer 1: Patatap animations (bottom) */}
      <svg ref={animSvgRef} width={size.w} height={size.h}
           viewBox={`0 0 ${size.w} ${size.h}`}
           style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />

      {/* Layer 2: tinted overlay so spheres pop over the strong patatap colors */}
      {!pure && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: palette.isDark
            ? 'radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 65%, rgba(0,0,0,0.35) 100%)'
            : 'radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.06) 65%, rgba(0,0,0,0.18) 100%)',
        }} />
      )}

      {/* Jam-stage curtain — rises from the pond floor when a song starts.
          Quietly darkens the canvas so Patatap animations and the centered
          sphere become the entire scene. */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: palette.isDark
          ? 'radial-gradient(ellipse at center, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.78) 100%)'
          : 'radial-gradient(ellipse at center, rgba(255,255,255,0.0) 0%, rgba(20,18,15,0.35) 70%, rgba(20,18,15,0.55) 100%)',
        opacity: playMode ? 1 : 0,
        transition: 'opacity 700ms cubic-bezier(0.22, 1, 0.36, 1)',
      }} />

      {/* Layer 3: spheres graph (top, fades in pure mode) */}
      <svg ref={graphSvgRef} width={size.w} height={size.h}
           viewBox={`0 0 ${size.w} ${size.h}`}
           style={{
             position: 'absolute', inset: 0, zIndex: 3,
             opacity: pure ? 0 : 1,
             transition: 'opacity 0.5s ease',
             pointerEvents: pure ? 'none' : 'auto',
           }}>
        <defs>
          <filter id="pj-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g id="pj-links"></g>
        <g id="pj-nodes"></g>
      </svg>

      {/* Click-anywhere fallback (excluding sphere clicks). Below HUD layer. */}
      {!pure && (
        <div
          onPointerDown={(e) => {
            // ignore if click landed on a sphere
            if (e.target.closest('g.pj-node')) return;
            const r = wrapRef.current.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const idx = Math.max(0, Math.min(25, Math.floor(px * 26)));
            fireKey(String.fromCharCode(97 + idx));
          }}
          style={{ position: 'absolute', inset: 0, zIndex: 2, cursor: 'crosshair' }}
        />
      )}

      {/* Header */}
      {!pure && (
        <header style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 54,
          display: 'flex', alignItems: 'center', padding: '0 24px',
          borderBottom: playMode ? 'none' : `1px solid ${palette.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
          zIndex: 10,
          background: playMode ? 'transparent' : (palette.isDark
            ? 'linear-gradient(180deg, rgba(7,7,15,0.78) 0%, rgba(7,7,15,0.4) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.25) 100%)'),
          backdropFilter: playMode ? 'none' : 'blur(8px)',
          color: palette.isDark ? palette.white : palette.black,
          transition: 'background 500ms ease, border-color 500ms ease',
        }}>
          {playMode ? (
            <button
              onClick={() => setNowPlaying(null)}
              style={{
                fontFamily: "'Azeret Mono', monospace", fontSize: 10,
                letterSpacing: '0.28em', textTransform: 'uppercase',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: palette.isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
                padding: '8px 14px 8px 0', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 14 }}>←</span> 返回池塘 BACK TO POND
            </button>
          ) : (
            <>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20, fontStyle: 'italic', fontWeight: 300,
                letterSpacing: '0.05em', marginRight: 28,
              }}>
                <em style={{ fontWeight: 600 }}>池中</em> 涟漪
                <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 8, letterSpacing: '0.22em', fontStyle: 'normal', fontFamily: "'Azeret Mono', monospace" }}>RIPPLES · JAM</span>
              </div>

              <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
                {PJ_SEASONS.map((s, i) => {
                  const active = i === seasonIdx;
                  const count = s.range[1] - s.range[0];
                  return (
                    <button key={s.id}
                      onClick={() => switchSeason(i)}
                      style={{
                        padding: '6px 14px',
                        fontFamily: "'Azeret Mono', monospace",
                        fontSize: 9.5, letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: active
                          ? (palette.isDark ? palette.white : palette.black)
                          : (palette.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'),
                        background: active
                          ? (palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                          : 'transparent',
                        border: active
                          ? (palette.isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)')
                          : '1px solid transparent',
                        borderRadius: 3,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: s.accent,
                      }} />
                      {s.label}
                      <span style={{ fontSize: 8.5, opacity: 0.55 }}>{count}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Palette dots */}
              <div style={{ display: 'flex', gap: 7, marginRight: 14 }}>
                {window.PALETTE_KEYS.map((k) => {
                  const pal = window.PATATAP_PALETTES[k];
                  const active = paletteKey === k;
                  return (
                    <button key={k}
                      onClick={() => setPaletteKey(k)}
                      title={pal.label}
                      style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: pal.background,
                        border: active
                          ? `2px solid ${palette.isDark ? palette.white : palette.black}`
                          : `1px solid ${palette.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'}`,
                        cursor: 'pointer', padding: 0,
                      }} />
                  );
                })}
              </div>

              <div style={{
                fontSize: 9, letterSpacing: '0.18em',
                opacity: 0.45, marginRight: 14,
              }}>
                点击岛屿开始 · CLICK AN ISLAND
              </div>
            </>
          )}
        </header>
      )}

      {/* First-time prompt — only when nothing is playing */}
      {!playMode && !pure && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 32,
          transform: 'translateX(-50%)',
          zIndex: 9, pointerEvents: 'none',
          color: palette.isDark ? palette.white : palette.black,
          fontFamily: "'Azeret Mono', monospace",
          fontSize: 10, letterSpacing: '0.4em', opacity: 0.45,
          textTransform: 'uppercase',
        }}>
          点击一座岛屿 · CLICK AN ISLAND TO BEGIN
        </div>
      )}

      {/* Hover label */}
      {hoverNode && !pure && (
        <div style={{
          position: 'absolute', top: 84, left: 24,
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic', fontWeight: 300,
          fontSize: 30, letterSpacing: '0.02em',
          color: palette.isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
          pointerEvents: 'none',
          zIndex: 9,
          textShadow: palette.isDark ? '0 1px 14px rgba(0,0,0,0.5)' : 'none',
        }}>
          {hoverNode.title}
          <span style={{
            fontFamily: "'Azeret Mono', monospace", fontStyle: 'normal',
            fontSize: 10, letterSpacing: '0.22em',
            opacity: 0.55, marginLeft: 14, verticalAlign: 'middle',
          }}>
            W{String(hoverNode.week).padStart(2, '0')} · KEY {hoverNode.letter.toUpperCase()}
          </span>
        </div>
      )}

      {/* Bottom HUD — jam stage only */}
      {playMode && !pure && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 24px 18px',
          display: 'flex', flexDirection: 'column', gap: 10,
          zIndex: 10,
          color: palette.isDark ? palette.white : palette.black,
          background: palette.isDark
            ? 'linear-gradient(0deg, rgba(7,7,15,0.86) 0%, rgba(7,7,15,0) 100%)'
            : 'linear-gradient(0deg, rgba(20,18,15,0.55) 0%, rgba(20,18,15,0) 100%)',
          paddingTop: 60,
          pointerEvents: 'none',
          animation: 'pj-rise 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>
          {/* Now-playing band — title + meta directly above keyboard */}
          {activeNode && (
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 18,
              pointerEvents: 'none', marginBottom: 4,
            }}>
              <span style={{
                fontFamily: "'Azeret Mono', monospace", fontSize: 9.5,
                letterSpacing: '0.28em', opacity: 0.55, textTransform: 'uppercase',
              }}>NOW JAMMING · W{String(activeNode.week).padStart(2, '0')}</span>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
                fontSize: 26, fontWeight: 300, letterSpacing: '0.03em',
                color: 'rgba(255,255,255,0.95)',
                textShadow: '0 1px 18px rgba(0,0,0,0.6)',
              }}>{activeNode.title}</span>
              <span style={{
                fontFamily: "'Azeret Mono', monospace", fontSize: 9.5,
                letterSpacing: '0.28em', opacity: 0.55,
              }}>{activeNode.duration}″ · {activeNode.noteCount} 音符</span>
            </div>
          )}

          {/* Keyboard strip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', pointerEvents: 'auto' }}>
            {KB_ROWS.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 4, marginLeft: ri * 14 }}>
                {row.split('').map((k) => {
                  const hit = keyHits.find((h) => h.key === k);
                  return (
                    <div key={k}
                      onPointerDown={(e) => { e.stopPropagation(); fireKey(k); }}
                      style={{
                        position: 'relative',
                        width: 30, height: 30, borderRadius: 4,
                        border: `1px solid ${palette.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)'}`,
                        background: hit ? (palette.isDark ? palette.white : '#fff') : 'transparent',
                        color: hit ? (palette.isDark ? palette.black : '#111')
                          : (palette.isDark ? palette.white : '#fff'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
                        textTransform: 'uppercase', cursor: 'pointer',
                        transition: hit ? 'none' : 'background 0.4s, color 0.4s',
                        opacity: 0.92,
                      }}>
                      {k}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Status row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 10, letterSpacing: '0.18em',
            pointerEvents: 'auto', marginTop: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: recording ? '#e54040' : (palette.isDark ? palette.white : '#fff'),
                opacity: recording ? 1 : 0.4,
                animation: recording ? 'blink 1.2s infinite' : 'none',
              }} />
              <span style={{ textTransform: 'uppercase', opacity: 0.85 }}>
                {recording ? '录制中 RECORDING' : (notes.length ? '已录制 RECORDED' : '准备合奏 READY')}
              </span>
              <span style={{ opacity: 0.55, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                {fmt(elapsed)}
              </span>
              <span style={{ opacity: 0.55 }}>{notes.length} 音符</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {recording && <button onClick={() => { setRecording(false); setRecStart(null); }} style={pjGhost(palette)}>■ STOP</button>}
              {notes.length > 0 && !recording && <button onClick={() => alert('回放原型 / replay prototype')} style={pjGhost(palette)}>▶ 回放</button>}
              {notes.length > 0 && !recording && <button onClick={() => alert('铸造原型 / mint prototype')} style={pjPrimary(palette)}>↑ 铸造乐谱 MINT</button>}
              {notes.length > 0 && <button onClick={() => { setNotes([]); setRecording(false); setRecStart(null); }} style={pjGhost(palette)}>✕ 清除</button>}
            </div>
          </div>
        </div>
      )}

      {/* Pure mode hint */}
      {pure && (
        <div style={{
          position: 'absolute', top: 16, right: 20, zIndex: 11,
          fontSize: 9, letterSpacing: '0.3em', opacity: 0.4,
          textTransform: 'uppercase',
          color: palette.isDark ? palette.white : palette.black,
        }}>
          SPACE · 退出纯享 EXIT PURE
        </div>
      )}

      {/* CSS */}
      <style>{`
        @keyframes pj-breathe {
          0%   { transform: scale(1); opacity: 0.46; }
          100% { transform: scale(1.32); opacity: 0; }
        }
        .pj-ripple {
          transform-box: fill-box;
          transform-origin: center;
          animation: pj-breathe 3.2s ease-out infinite;
        }
        .pj-ripple.r1 { animation-delay: 0s; }
        .pj-ripple.r2 { animation-delay: -1.07s; }
        .pj-ripple.r3 { animation-delay: -2.14s; }
        .pj-circle { transition: r 0.18s ease; }
        @keyframes pj-rise {
          from { transform: translateY(28px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes blink {
          0%, 60%, 100% { opacity: 1; }
          30%           { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function pjGhost(palette) {
  return {
    background: 'transparent',
    color: palette.isDark ? palette.white : palette.black,
    border: `1px solid ${palette.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
    padding: '5px 11px',
    fontSize: 10,
    fontFamily: "'Azeret Mono', monospace",
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    borderRadius: 3,
    cursor: 'pointer',
  };
}
function pjPrimary(palette) {
  return {
    background: palette.isDark ? palette.white : palette.black,
    color: palette.isDark ? palette.black : palette.white,
    border: 'none',
    padding: '6px 14px',
    fontSize: 10,
    fontFamily: "'Azeret Mono', monospace",
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    borderRadius: 3,
    cursor: 'pointer',
    fontWeight: 500,
  };
}

window.PondJam = PondJam;

/* global React, d3 */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ════════════════════════════════════════════════════════════════════════════
// POND SPHERES — Sound Spheres language × Ripples in the Pond DNA
// 108 songs across 4 seasons (春夏秋冬). d3-force physics, breathing ripples,
// drag, hover-▶, click to listen. JAM button → full-bleed Patatap canvas.
// ════════════════════════════════════════════════════════════════════════════

// Real Patatap palette (purple) is dark + has the right contrast.
// We expose 4 "season" palettes for tabs, each tinted distinctly.
const SEASON_PALETTES = {
  spring: ['#9DD9A8','#7BC890','#B3E6BC','#5EB079','#A8DEB1','#76C68C','#90D4A0','#84CD96'],
  summer: ['#F0A050','#D97828','#F4BC6A','#C46018','#E8883A','#FAD080','#D06820','#F09840'],
  autumn: ['#E47C5A','#C95C44','#EDA088','#B14A35','#D9694F','#F1B4A0','#A24026','#E08366'],
  winter: ['#7BA8E8','#5C8AD0','#9CC0F4','#4B7DC0','#86B0E8','#3D6FB4','#A8CCFC','#6898D8'],
};
const SEASONS = [
  { id: 'spring', label: '春 SPRING', range: [0, 27],   accent: '#9DD9A8' },
  { id: 'summer', label: '夏 SUMMER', range: [27, 54],  accent: '#F0A050' },
  { id: 'autumn', label: '秋 AUTUMN', range: [54, 81],  accent: '#E47C5A' },
  { id: 'winter', label: '冬 WINTER', range: [81, 108], accent: '#7BA8E8' },
];

// Generate a deterministic "importance" so size varies but is stable per track.
function importanceOf(track) {
  // Hash seed → 0.32–0.95
  const s = track.seed;
  return 0.32 + ((s * 1023) % 100) / 100 * 0.63;
}

// Build season-scoped graph: nodes = the season's 27 tracks, plus a few "echo"
// links to other seasons (cross-season tracks → dashed cross-group ring).
function getSeasonGraph(allTracks, season) {
  const [from, to] = season.range;
  const slice = allTracks.slice(from, to);
  const palette = SEASON_PALETTES[season.id];
  const nodes = slice.map((trk, i) => {
    const imp = importanceOf(trk);
    return {
      ...trk,
      importance: imp,
      radius: 16 + imp * 38,
      color: palette[i % palette.length],
      // Roughly 1 in 4 tracks is a "cross-season echo"
      crossSeason: ((trk.week * 7) % 5 === 0) ? SEASONS[(SEASONS.findIndex(s => s.id === season.id) + 1 + (trk.week % 3)) % 4].id : null,
      label: trk.title,
      sublabel: `第${String(trk.week).padStart(2, '0')}周 · W${String(trk.week).padStart(2, '0')}`,
    };
  });
  // Generate links between similar tracks
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

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function PondSpheres({ tracks, onJam }) {
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const zoomRef = useRef(null);

  const season = SEASONS[seasonIdx];
  const graph = useMemo(() => getSeasonGraph(tracks, season), [tracks, season]);

  // Set up zoom/pan once
  useEffect(() => {
    if (!svgRef.current || !window.d3) return;
    const svg = d3.select(svgRef.current);
    const zoomG = svg.select('#zoom-g');
    const z = d3.zoom()
      .scaleExtent([0.3, 4])
      .filter((event) => {
        // Allow only wheel + non-node drags for pan
        if (event.type === 'wheel') return true;
        // Don't initiate pan if pressing on a node
        const el = event.target;
        return !el.closest('.pond-node-g');
      })
      .on('zoom', (e) => {
        zoomG.attr('transform', e.transform);
      });
    svg.call(z);
    svg.on('dblclick.zoom', null).on('dblclick', () => {
      svg.transition().duration(500).call(z.transform, d3.zoomIdentity);
    });
    zoomRef.current = z;
    return () => svg.on('.zoom', null);
  }, []);

  // Render graph whenever season changes
  useEffect(() => {
    if (!svgRef.current || !window.d3 || !wrapRef.current) return;
    const wrap = wrapRef.current;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const cx = W / 2, cy = H / 2;

    if (simRef.current) simRef.current.stop();

    const svg = d3.select(svgRef.current);
    const linksG = svg.select('#pond-links');
    const nodesG = svg.select('#pond-nodes');
    linksG.selectAll('*').remove();
    nodesG.selectAll('*').remove();

    const nodes = graph.nodes.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 200,
    }));
    const links = graph.links.map((l) => ({ ...l }));

    // Links
    const linkSel = linksG.selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('class', 'pond-link')
      .attr('stroke', (d) => {
        const src = nodes.find((n) => n.week === (d.source.week ?? d.source));
        return src ? src.color : season.accent;
      })
      .attr('stroke-width', (d) => 0.4 + d.correlation * 1.6)
      .attr('stroke-opacity', (d) => 0.05 + d.correlation * 0.18)
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .attr('pointer-events', 'none');

    // Node groups
    const ng = nodesG.selectAll('g.pond-node-g')
      .data(nodes, (d) => d.week)
      .enter().append('g')
      .attr('class', 'pond-node-g')
      .style('cursor', 'pointer');

    // Three breathing rings (CSS animation)
    ['r1', 'r2', 'r3'].forEach((cls) => {
      ng.append('circle')
        .attr('class', `pond-ripple ${cls}`)
        .attr('r', (d) => d.radius)
        .attr('fill', 'none')
        .attr('stroke', (d) => d.color)
        .attr('stroke-width', 1.2)
        .attr('pointer-events', 'none');
    });

    // Cross-season dashed ring
    ng.filter((d) => !!d.crossSeason)
      .append('circle')
      .attr('class', 'pond-xs-ring')
      .attr('r', (d) => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => SEASONS.find((s) => s.id === d.crossSeason)?.accent ?? '#fff')
      .attr('stroke-width', 1.1)
      .attr('stroke-dasharray', '3.5 3')
      .attr('opacity', 0.4)
      .attr('pointer-events', 'none');

    // Main filled circle
    ng.append('circle')
      .attr('class', 'pond-circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', (d) => 0.5 + d.importance * 0.35)
      .attr('filter', 'url(#pond-glow-soft)')
      .style('transition', 'r 0.22s ease');

    // Inner texture — a faint wave line, channelling the cover-DNA
    ng.append('path')
      .attr('class', 'pond-cover-line')
      .attr('d', (d) => {
        const r = d.radius;
        const amp = r * 0.22;
        const w = r * 1.6;
        let p = `M ${-w / 2} 0`;
        for (let x = -w / 2 + 4; x <= w / 2; x += 4) {
          const y = Math.sin((x / w) * Math.PI * 3 + d.seed * 6) * amp;
          p += ` L ${x} ${y.toFixed(1)}`;
        }
        return p;
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('fill', 'none')
      .attr('opacity', 0.18)
      .attr('pointer-events', 'none');

    // Track number label INSIDE big spheres
    ng.filter((d) => d.radius > 28)
      .append('text')
      .attr('class', 'pond-num')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-family', "'Cormorant Garamond', serif")
      .attr('font-style', 'italic')
      .attr('font-weight', 300)
      .attr('font-size', (d) => d.radius * 0.72)
      .attr('fill', 'rgba(255,255,255,0.9)')
      .attr('pointer-events', 'none')
      .text((d) => d.week);

    // Title label below
    ng.append('text')
      .attr('class', 'pond-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 16)
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', 11)
      .attr('font-weight', 300)
      .attr('letter-spacing', '0.08em')
      .attr('fill', 'rgba(232,228,217,0.78)')
      .attr('pointer-events', 'none')
      .text((d) => d.label);

    // Week sublabel
    ng.append('text')
      .attr('class', 'pond-sublabel')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 30)
      .attr('font-family', "'Azeret Mono', monospace")
      .attr('font-size', 8.5)
      .attr('letter-spacing', '0.18em')
      .attr('fill', 'rgba(232,228,217,0.32)')
      .attr('pointer-events', 'none')
      .text((d) => `W${String(d.week).padStart(2, '0')}`);

    // Hover ▶ play overlay
    ng.append('circle')
      .attr('class', 'pond-hover-bg')
      .attr('r', 16)
      .attr('fill', 'rgba(0,0,0,0.55)')
      .attr('stroke', 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 1)
      .attr('opacity', 0)
      .attr('pointer-events', 'none')
      .style('transition', 'opacity 0.2s');
    ng.append('path')
      .attr('class', 'pond-play-icon')
      .attr('d', 'M-5,-7 L8,0 L-5,7 Z')
      .attr('fill', 'white')
      .attr('opacity', 0)
      .attr('pointer-events', 'none')
      .style('transition', 'opacity 0.2s');

    // Drag
    const dragB = d3.drag()
      .on('start', (event, d) => {
        d._dragged = false;
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => {
        if (!d._dragged) {
          d._dragged = true;
          if (!event.active && simRef.current) simRef.current.alphaTarget(0.1).restart();
        }
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active && simRef.current) simRef.current.alphaTarget(0);
        // Keep the node where it was dropped (don't unfix). Optional.
        d.fx = null; d.fy = null;
      });
    ng.call(dragB);

    // Hover handlers
    ng.on('mouseenter', function (e, d) {
      const sel = d3.select(this);
      sel.select('.pond-hover-bg').attr('opacity', 1);
      sel.select('.pond-play-icon').attr('opacity', 1);
      sel.select('.pond-circle')
        .attr('filter', 'url(#pond-glow-strong)')
        .attr('r', d.radius * 1.08);
      setHoverNode(d);
    })
    .on('mouseleave', function (e, d) {
      const sel = d3.select(this);
      if (playingIdRef.current !== d.week) {
        sel.select('.pond-hover-bg').attr('opacity', 0);
        sel.select('.pond-play-icon').attr('opacity', 0);
      }
      sel.select('.pond-circle')
        .attr('filter', 'url(#pond-glow-soft)')
        .attr('r', d.radius);
      setHoverNode(null);
    })
    .on('click', function (e, d) {
      if (d._dragged) return;
      e.stopPropagation();
      // Toggle play
      setPlayingId((cur) => (cur === d.week ? null : d.week));
    });

    // Force simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id((d) => d.week)
        .distance((d) => 95 + (1 - d.correlation) * 110)
        .strength((d) => d.correlation * 0.32)
      )
      .force('charge', d3.forceManyBody()
        .strength((d) => -(320 * (0.6 + d.importance * 0.8)))
      )
      .force('collide', d3.forceCollide()
        .radius((d) => d.radius * 1.05 + 10)
        .strength(0.85)
        .iterations(4)
      )
      .force('center', d3.forceCenter(cx, cy).strength(0.05))
      .alphaDecay(0.018)
      .velocityDecay(0.42)
      .on('tick', () => {
        linkSel
          .attr('x1', (d) => d.source.x)
          .attr('y1', (d) => d.source.y)
          .attr('x2', (d) => d.target.x)
          .attr('y2', (d) => d.target.y);
        ng.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });
    simRef.current = sim;

    return () => sim.stop();
  }, [graph, season]);

  // Keep a ref to playingId for use inside d3 closures
  const playingIdRef = useRef(playingId);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  // Update play icon UI when playingId changes
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('g.pond-node-g').each(function (d) {
      const sel = d3.select(this);
      const isPlaying = d.week === playingId;
      sel.select('.pond-play-icon')
        .attr('d', isPlaying ? 'M-5,-7 L-1,-7 L-1,7 L-5,7 Z M2,-7 L6,-7 L6,7 L2,7 Z' : 'M-5,-7 L8,0 L-5,7 Z')
        .attr('opacity', isPlaying ? 1 : (sel.attr('data-hover') === '1' ? 1 : 0));
      sel.select('.pond-hover-bg').attr('opacity', isPlaying ? 1 : 0);
    });
  }, [playingId]);

  // Resize → re-center force
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!simRef.current || !wrapRef.current) return;
      const W = wrapRef.current.clientWidth;
      const H = wrapRef.current.clientHeight;
      simRef.current.force('center', d3.forceCenter(W / 2, H / 2).strength(0.05));
      simRef.current.alpha(0.3).restart();
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Keyboard ← →
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowRight') setSeasonIdx((i) => (i + 1) % SEASONS.length);
      if (e.key === 'ArrowLeft') setSeasonIdx((i) => (i + SEASONS.length - 1) % SEASONS.length);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const playingNode = playingId != null ? graph.nodes.find((n) => n.week === playingId) : null;

  return (
    <div ref={wrapRef} style={{
      position: 'relative',
      width: '100%', height: '100%',
      background: '#07070f',
      color: '#d8d3c8',
      overflow: 'hidden',
      fontFamily: "'Azeret Mono', monospace",
      userSelect: 'none',
    }}>
      {/* Noise grain overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        opacity: 0.035, pointerEvents: 'none', zIndex: 99,
      }} />

      {/* HEADER */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'center', padding: '0 24px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        zIndex: 20,
        background: 'linear-gradient(180deg, rgba(7,7,15,0.92) 0%, rgba(7,7,15,0.72) 100%)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 19, fontStyle: 'italic', fontWeight: 300,
          letterSpacing: '0.05em', marginRight: 32,
          whiteSpace: 'nowrap',
        }}>
          <em style={{ fontWeight: 600 }}>池中</em> 涟漪 <span style={{ opacity: 0.5, fontSize: 12, marginLeft: 6, letterSpacing: '0.18em', fontStyle: 'normal' }}>RIPPLES</span>
        </div>

        {/* Season tabs */}
        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {SEASONS.map((s, i) => {
            const active = i === seasonIdx;
            const count = s.range[1] - s.range[0];
            return (
              <button key={s.id}
                onClick={() => setSeasonIdx(i)}
                style={{
                  padding: '6px 14px',
                  fontFamily: "'Azeret Mono', monospace",
                  fontSize: 9.5, letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: active ? '#d8d3c8' : 'rgba(216,211,200,0.4)',
                  background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: active ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'color 0.18s, background 0.18s, border 0.18s',
                }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: s.accent, flexShrink: 0,
                }} />
                {s.label}
                <span style={{ fontSize: 8.5, opacity: 0.5 }}>{count}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ fontSize: 9, color: 'rgba(216,211,200,0.4)', letterSpacing: '0.12em', marginRight: 16 }}>
          DRAG · SCROLL · ← →
        </div>

        {/* Big JAM button */}
        <button
          onClick={() => onJam?.(playingNode)}
          style={{
            fontFamily: "'Azeret Mono', monospace",
            fontSize: 11, letterSpacing: '0.3em', fontWeight: 400,
            padding: '8px 18px',
            background: '#fcf3e0',
            color: '#07070f',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            textTransform: 'uppercase',
            boxShadow: '0 0 20px rgba(252,243,224,0.18)',
          }}>
          ◐ 合奏 JAM
        </button>
      </header>

      {/* CANVAS */}
      <svg ref={svgRef} style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        cursor: 'grab',
      }}>
        <defs>
          <filter id="pond-glow-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="pond-glow-strong" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g id="zoom-g">
          <g id="pond-links"></g>
          <g id="pond-nodes"></g>
        </g>
      </svg>

      {/* FOOTER */}
      <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 32, display: 'flex', alignItems: 'center',
        padding: '0 24px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        fontSize: 9, color: 'rgba(216,211,200,0.4)',
        letterSpacing: '0.12em',
        zIndex: 20,
        background: 'linear-gradient(0deg, rgba(7,7,15,0.92) 0%, rgba(7,7,15,0.72) 100%)',
        backdropFilter: 'blur(8px)',
      }}>
        <span>⊙ {graph.nodes.length} 岛屿 · NODES</span>
        <span style={{ margin: '0 16px', opacity: 0.3 }}>│</span>
        <span style={{ color: playingNode ? '#d8d3c8' : 'rgba(216,211,200,0.4)' }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: playingNode ? '#9DD9A8' : 'rgba(216,211,200,0.4)',
            marginRight: 7, marginTop: -1, verticalAlign: 'middle',
            animation: playingNode ? 'blink 1.4s ease-in-out infinite' : 'none',
          }} />
          {playingNode
            ? <>正在聆听 · NOW PLAYING <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 12, letterSpacing: '0.04em', marginLeft: 6 }}>{playingNode.label}</span> <span style={{ opacity: 0.5, marginLeft: 6 }}>W{String(playingNode.week).padStart(2, '0')}</span></>
            : '尚未选定 · NO TRACK SELECTED'}
        </span>

        <span style={{ marginLeft: 'auto' }}>{season.label} · {String(seasonIdx + 1).padStart(2, '0')}/{String(SEASONS.length).padStart(2, '0')}</span>
      </footer>

      {/* Hover tooltip — small floating label */}
      {hoverNode && (
        <div style={{
          position: 'absolute', top: 70, left: 24,
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic', fontWeight: 300,
          fontSize: 28, letterSpacing: '0.02em',
          color: 'rgba(216,211,200,0.92)',
          pointerEvents: 'none',
          zIndex: 15,
        }}>
          {hoverNode.label}
          <span style={{ fontFamily: "'Azeret Mono', monospace", fontStyle: 'normal',
            fontSize: 10, letterSpacing: '0.18em',
            color: 'rgba(216,211,200,0.45)', marginLeft: 14, verticalAlign: 'middle' }}>
            W{String(hoverNode.week).padStart(2, '0')} · IMP {hoverNode.importance.toFixed(2)}
          </span>
        </div>
      )}

      {/* CSS for breathing rings */}
      <style>{`
        @keyframes pond-breathe {
          0%   { transform: scale(1); opacity: 0.46; }
          100% { transform: scale(1.32); opacity: 0; }
        }
        .pond-ripple {
          transform-box: fill-box;
          transform-origin: center;
          animation: pond-breathe 3.2s ease-out infinite;
        }
        .pond-ripple.r1 { animation-delay: 0s; }
        .pond-ripple.r2 { animation-delay: -1.07s; }
        .pond-ripple.r3 { animation-delay: -2.14s; }
        .pond-link { fill: none; pointer-events: none; }
      `}</style>
    </div>
  );
}

window.PondSpheres = PondSpheres;

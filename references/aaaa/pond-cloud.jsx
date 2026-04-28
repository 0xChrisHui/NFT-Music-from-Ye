/* global React */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ════════════════════════════════════════════════════════════════════════════
// POND CLOUD — Direction D : Suspended Particle Cloud
// 108 songs as bodies floating in a 3D field. No rings, no orbits, no axes.
// Each body has its own (x,y,z) position, its own slow XYZ sinusoidal drift,
// its own breathing rhythm. Camera responds to mouse via parallax.
// Palette: 显影 / Film Stock (Kodak Portra · Fuji 400H · Cinestill 800T).
// ════════════════════════════════════════════════════════════════════════════

// 显影配色 — 8 voices, all from photochemical color casts
const FILM_PALETTE = [
  { hex: '#d8a878', name: 'Portra 暖橙' },
  { hex: '#7ea898', name: 'Fuji 青绿' },
  { hex: '#a83a3a', name: 'Cinestill 红' },
  { hex: '#6a7898', name: 'Ektachrome 蓝' },
  { hex: '#e8d8b8', name: '高光奶油' },
  { hex: '#382828', name: '阴影巧克力' },
  { hex: '#b8a8c8', name: '紫调阴影' },
  { hex: '#9aa878', name: 'CN16 草绿' },
];

// Hash a track to a stable position + drift profile
function hash(seed, salt) {
  return ((seed * 9301 + salt * 49297) % 233280) / 233280;
}

function importanceOf(seed) {
  return 0.32 + ((seed * 1023) % 100) / 100 * 0.63;
}

// Build the cloud — 108 bodies in a 3D field [-1..1]^3.
// Use Poisson-disk-style rejection sampling so bodies are evenly distributed
// and never overlap in 3D. Slight clustering is added via 3 weak attractors
// (15% bias), but the dominant force is *separation*.
function buildCloud(tracks) {
  // The field is wider on X (landscape), shallower in Y and Z.
  const FIELD = { x: 1.55, y: 0.78, z: 0.85 };
  const MIN_DIST = 0.22; // 3D minimum separation (in unit space)

  // 3 weak attractors (used only 30% of time, gentle pull)
  const attractors = [
    { x: -0.85, y: -0.08, z:  0.10 },
    { x:  0.12, y:  0.22, z: -0.30 },
    { x:  0.92, y: -0.20, z:  0.35 },
  ];

  const placed = [];
  // Process tracks in deterministic but shuffled order so ones with bigger
  // importance don't all land together.
  const order = tracks
    .map((t, i) => ({ t, k: hash(t.seed, 101) }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.t);

  for (const trk of order) {
    let chosen = null;
    const r1 = hash(trk.seed + 1, 11);
    const r2 = hash(trk.seed + 1, 23);
    const r3 = hash(trk.seed + 1, 37);
    const r4 = hash(trk.seed + 1, 53);
    const r5 = hash(trk.seed + 1, 71);
    const r6 = hash(trk.seed + 1, 89);

    // up to 80 attempts to find a non-colliding spot, with progressive relaxation
    for (let attempt = 0; attempt < 80; attempt++) {
      const rA = hash(trk.seed + attempt * 13, 17);
      const rB = hash(trk.seed + attempt * 13, 29);
      const rC = hash(trk.seed + attempt * 13, 41);
      const rD = hash(trk.seed + attempt * 13, 53);

      let x, y, z;
      // 25% of bodies are nudged toward an attractor, 75% are uniform
      if (rD < 0.25) {
        const a = attractors[Math.floor(rA * attractors.length)];
        const dx = (rB - 0.5) * 0.7;
        const dy = (rC - 0.5) * 0.45;
        const dz = (rA - 0.5) * 0.55;
        x = a.x + dx; y = a.y + dy; z = a.z + dz;
      } else {
        x = (rA * 2 - 1) * FIELD.x;
        y = (rB * 2 - 1) * FIELD.y;
        z = (rC * 2 - 1) * FIELD.z;
      }

      // clamp
      x = Math.max(-FIELD.x, Math.min(FIELD.x, x));
      y = Math.max(-FIELD.y, Math.min(FIELD.y, y));
      z = Math.max(-FIELD.z, Math.min(FIELD.z, z));

      // relaxed minimum distance after many attempts (so we always place all 108)
      const minDist = MIN_DIST * Math.max(0.45, 1 - attempt / 60);
      let collides = false;
      for (const p of placed) {
        const ddx = p.bx - x, ddy = p.by - y, ddz = p.bz - z;
        if (ddx * ddx + ddy * ddy + ddz * ddz < minDist * minDist) {
          collides = true; break;
        }
      }
      if (!collides) {
        chosen = { x, y, z };
        break;
      }
    }
    if (!chosen) {
      // last resort fallback — random anywhere
      chosen = { x: (r1 * 2 - 1) * FIELD.x, y: (r2 * 2 - 1) * FIELD.y, z: (r3 * 2 - 1) * FIELD.z };
    }

    const imp = importanceOf(trk.seed);
    const color = FILM_PALETTE[Math.floor(hash(trk.seed, 7) * FILM_PALETTE.length)];

    placed.push({
      ...trk,
      bx: chosen.x, by: chosen.y, bz: chosen.z,
      ax: 0.018 + r4 * 0.028,
      ay: 0.014 + r5 * 0.024,
      az: 0.020 + r6 * 0.030,
      px: 9 + r1 * 12,
      py: 11 + r2 * 14,
      pz: 13 + r3 * 16,
      phx: r4 * Math.PI * 2,
      phy: r5 * Math.PI * 2,
      phz: r6 * Math.PI * 2,
      importance: imp,
      bodyR: 0.009 + imp * 0.020, // smaller bodies; min ~0.011 max ~0.029
      color: color.hex,
      colorName: color.name,
      breath: 2.6 + r1 * 2.2,
      breathPhase: r2 * Math.PI * 2,
    });
  }
  return placed;
}

// project 3D point to 2D screen with simple perspective.
// Parallax: NEAR bodies shift MORE than far bodies (movie parallax).
function project(x, y, z, W, H, camX, camY, scale) {
  const focal = 3.2;
  const viewZ = focal - z;
  const f = focal / viewZ;
  // depth: 0 = far (-1), 1 = near (+1). near layer reacts more to mouse.
  const depth = (z + 1) / 2;
  const px = (x + camX * 0.05 * depth) * f;
  const py = (y + camY * 0.05 * depth) * f;
  const sx = W / 2 + px * scale;
  const sy = H / 2 + py * scale;
  return { sx, sy, scale: f };
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function PondCloud({ tracks, onJam }) {
  const [hoverId, setHoverId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [time, setTime] = useState(0);
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const [pulse, setPulse] = useState({}); // {trackWeek: pulseStartTime}
  const wrapRef = useRef(null);
  const camRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const rafRef = useRef(0);
  const startedAt = useRef(performance.now());

  const cloud = useMemo(() => buildCloud(tracks), [tracks]);

  // Time loop — drives independent body drift and breathing
  useEffect(() => {
    let frame;
    const tick = () => {
      const now = performance.now();
      const t = (now - startedAt.current) / 1000;
      setTime(t);
      // ease camera toward target
      camRef.current.x += (camRef.current.tx - camRef.current.x) * 0.06;
      camRef.current.y += (camRef.current.ty - camRef.current.y) * 0.06;
      setCam({ x: camRef.current.x, y: camRef.current.y });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Mouse-based parallax — moves camera target in [-1..1]
  const onMouseMove = useCallback((e) => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    camRef.current.tx = nx;
    camRef.current.ty = ny;
  }, []);

  // Project each body for the current frame
  const W = wrapRef.current?.clientWidth ?? 1600;
  const H = wrapRef.current?.clientHeight ?? 920;
  // scale = pixels per unit at the focal plane. Tuned so a body at z=0
  // with bodyR=0.02 renders at ~16px radius — visible but not crowding.
  const scale = Math.min(W, H) * 0.50;

  const projected = useMemo(() => {
    return cloud.map((b) => {
      const dx = Math.sin(time * (Math.PI * 2 / b.px) + b.phx) * b.ax;
      const dy = Math.sin(time * (Math.PI * 2 / b.py) + b.phy) * b.ay;
      const dz = Math.sin(time * (Math.PI * 2 / b.pz) + b.phz) * b.az;
      const x = b.bx + dx, y = b.by + dy, z = b.bz + dz;
      const p = project(x, y, z, W, H, cam.x, cam.y, scale);
      // breathing scale 0.92..1.08
      const breath = 1 + Math.sin(time * (Math.PI * 2 / b.breath) + b.breathPhase) * 0.08;
      const radius = b.bodyR * scale * p.scale * breath;
      // depth alpha + blur
      const depthT = (z + 1) / 2; // 0 = far, 1 = near
      const alpha = 0.30 + depthT * 0.55;
      const blur = (1 - depthT) * 5.5; // far things blur up to 5.5px
      return { body: b, x: p.sx, y: p.sy, z, radius, alpha, blur, depth: depthT };
    });
  }, [cloud, time, cam.x, cam.y, W, H, scale]);

  // Sort back-to-front for painter's algorithm
  const sorted = useMemo(() => [...projected].sort((a, b) => a.z - b.z), [projected]);

  // Jam pulse — when user hits a key bound to a track, that body briefly flares
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k.length !== 1 || !/[a-z]/.test(k)) return;
      // bind A..Z to tracks 1..26, repeat for 27-52, etc
      const letter = k.charCodeAt(0) - 97;
      const candidates = cloud.filter((c) => (c.week - 1) % 26 === letter);
      const target = candidates[Math.floor(Math.random() * candidates.length)] ?? cloud[letter % cloud.length];
      if (target) {
        setPulse((p) => ({ ...p, [target.week]: performance.now() }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cloud]);

  const hoverNode = hoverId != null ? cloud.find((c) => c.week === hoverId) : null;
  const playingNode = playingId != null ? cloud.find((c) => c.week === playingId) : null;

  return (
    <div ref={wrapRef}
      onMouseMove={onMouseMove}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: 'radial-gradient(ellipse at 50% 55%, #0c0a08 0%, #030302 70%, #000 100%)',
        color: '#e8d8b8',
        overflow: 'hidden',
        fontFamily: "'Azeret Mono', monospace",
        userSelect: 'none',
        cursor: 'crosshair',
      }}>
      {/* film grain — appropriate to 显影 palette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 99,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        opacity: 0.07, mixBlendMode: 'overlay',
      }} />

      {/* HEADER */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'center', padding: '0 24px',
        borderBottom: '1px solid rgba(232,216,184,0.07)',
        zIndex: 20,
        background: 'linear-gradient(180deg, rgba(12,10,8,0.85) 0%, rgba(12,10,8,0.0) 100%)',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 19, fontStyle: 'italic', fontWeight: 300,
          letterSpacing: '0.05em', marginRight: 32, whiteSpace: 'nowrap',
          pointerEvents: 'auto',
        }}>
          <em style={{ fontWeight: 600 }}>悬浮</em> 群音
          <span style={{ opacity: 0.5, fontSize: 12, marginLeft: 6, letterSpacing: '0.18em', fontStyle: 'normal' }}>SUSPENDED CLOUD</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, color: 'rgba(232,216,184,0.4)', letterSpacing: '0.18em', marginRight: 16, pointerEvents: 'auto' }}>
          108 BODIES · 显影 FILM STOCK · MOVE MOUSE TO PARALLAX
        </div>
        <button onClick={() => onJam?.(playingNode)} style={{
            fontFamily: "'Azeret Mono', monospace",
            fontSize: 11, letterSpacing: '0.3em', fontWeight: 400,
            padding: '8px 18px',
            background: '#e8d8b8', color: '#0c0a08',
            border: 'none', borderRadius: 3, cursor: 'pointer',
            textTransform: 'uppercase',
            boxShadow: '0 0 24px rgba(232,216,184,0.22)',
            pointerEvents: 'auto',
          }}>
          ◐ 合奏 JAM
        </button>
      </header>

      {/* CANVAS */}
      <svg style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
      }}>
        <defs>
          <filter id="cloud-blur-far" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id="cloud-blur-mid" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <filter id="cloud-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="body-shade" cx="35%" cy="32%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {sorted.map((p) => {
          const isHover = hoverId === p.body.week;
          const isPlaying = playingId === p.body.week;
          const pulseStart = pulse[p.body.week];
          let pulseT = 0;
          if (pulseStart) {
            const dt = (performance.now() - pulseStart) / 1000;
            if (dt < 1.4) pulseT = 1 - dt / 1.4;
          }
          const filter = p.blur > 3 ? 'url(#cloud-blur-far)'
                       : p.blur > 1 ? 'url(#cloud-blur-mid)'
                       : (isHover || isPlaying) ? 'url(#cloud-glow)'
                       : null;
          const fontSize = Math.max(8, p.radius * 0.65);
          const showLabel = p.radius > 14 || isHover || isPlaying;

          return (
            <g key={p.body.week}
               transform={`translate(${p.x},${p.y})`}
               style={{ cursor: 'pointer' }}
               onMouseEnter={() => setHoverId(p.body.week)}
               onMouseLeave={() => setHoverId((cur) => (cur === p.body.week ? null : cur))}
               onClick={(e) => { e.stopPropagation(); setPlayingId((cur) => cur === p.body.week ? null : p.body.week); }}
            >
              {/* breathing ring (only mid/near, otherwise too noisy) */}
              {p.depth > 0.45 && (
                <circle r={p.radius * (1.05 + 0.45 * (1 - (Math.sin(time * 1.6 + p.body.breathPhase) + 1) / 2))}
                  fill="none" stroke={p.body.color}
                  strokeOpacity={0.18 * p.depth}
                  strokeWidth="0.6"
                  filter={filter} />
              )}

              {/* pulse ring (jam strike) */}
              {pulseT > 0 && (
                <>
                  <circle r={p.radius * (1 + (1 - pulseT) * 4)} fill="none"
                    stroke={p.body.color} strokeOpacity={pulseT * 0.85} strokeWidth="1.3" />
                  <circle r={p.radius * (1 + (1 - pulseT) * 7)} fill="none"
                    stroke={p.body.color} strokeOpacity={pulseT * 0.4} strokeWidth="0.6" />
                </>
              )}

              {/* body */}
              <circle r={p.radius * (1 + pulseT * 0.35)}
                fill={p.body.color}
                fillOpacity={p.alpha * (isHover ? 1.0 : 1) * (isPlaying ? 1.0 : 1)}
                filter={filter}
              />
              {/* shading highlight (sphere cue) */}
              {p.radius > 4 && p.blur < 3 && (
                <circle r={p.radius} fill="url(#body-shade)" />
              )}
              {/* drop shadow disc to reinforce 3D */}
              {p.depth > 0.55 && (
                <ellipse cy={p.radius * 1.6} rx={p.radius * 0.85} ry={p.radius * 0.18}
                  fill="rgba(0,0,0,0.42)" />
              )}

              {/* hover ▶ */}
              {(isHover || isPlaying) && (
                <>
                  <circle r="14" fill="rgba(0,0,0,0.55)" stroke="rgba(232,216,184,0.4)" strokeWidth="1" />
                  {isPlaying ? (
                    <>
                      <rect x="-5" y="-7" width="3.5" height="14" fill="#e8d8b8" />
                      <rect x="1.5" y="-7" width="3.5" height="14" fill="#e8d8b8" />
                    </>
                  ) : (
                    <path d="M-4,-7 L7,0 L-4,7 Z" fill="#e8d8b8" />
                  )}
                </>
              )}

              {/* track number */}
              {showLabel && p.radius > 16 && (
                <text textAnchor="middle" dy="4"
                  fontFamily="'Cormorant Garamond', serif"
                  fontStyle="italic" fontWeight="300"
                  fontSize={fontSize}
                  fill="rgba(255,255,255,0.85)"
                  pointerEvents="none">
                  {p.body.week}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* HOVER CARD — top-left, big italic */}
      {hoverNode && (
        <div style={{
          position: 'absolute', top: 70, left: 24, zIndex: 15,
          pointerEvents: 'none',
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic', fontWeight: 300,
          fontSize: 32, letterSpacing: '0.02em',
          color: 'rgba(232,216,184,0.96)',
        }}>
          {hoverNode.title || `第 ${hoverNode.week} 周`}
          <div style={{
            fontFamily: "'Azeret Mono', monospace", fontStyle: 'normal',
            fontSize: 10, letterSpacing: '0.22em',
            color: 'rgba(232,216,184,0.42)', marginTop: 6,
          }}>
            W{String(hoverNode.week).padStart(3, '0')} · {hoverNode.colorName} · IMP {hoverNode.importance.toFixed(2)}
          </div>
        </div>
      )}

      {/* DEPTH LEGEND — small bottom-left */}
      <div style={{
        position: 'absolute', bottom: 48, left: 24, zIndex: 18,
        fontSize: 8.5, letterSpacing: '0.22em', color: 'rgba(232,216,184,0.42)',
        pointerEvents: 'none',
      }}>
        <div style={{ marginBottom: 6 }}>DEPTH FIELD</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#382828', filter: 'blur(2px)', opacity: 0.5 }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7ea898', opacity: 0.7 }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#d8a878' }} />
          <span style={{ marginLeft: 8 }}>FAR ← → NEAR</span>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 32, display: 'flex', alignItems: 'center',
        padding: '0 24px',
        borderTop: '1px solid rgba(232,216,184,0.07)',
        fontSize: 9, color: 'rgba(232,216,184,0.4)',
        letterSpacing: '0.18em', zIndex: 20,
        background: 'linear-gradient(0deg, rgba(12,10,8,0.85) 0%, rgba(12,10,8,0) 100%)',
        backdropFilter: 'blur(8px)',
      }}>
        <span>⊙ 108 BODIES SUSPENDED</span>
        <span style={{ margin: '0 16px', opacity: 0.3 }}>│</span>
        <span style={{ color: playingNode ? '#e8d8b8' : 'rgba(232,216,184,0.4)' }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: playingNode ? playingNode.color : 'rgba(232,216,184,0.4)',
            marginRight: 7, verticalAlign: 'middle',
            animation: playingNode ? 'blink 1.4s ease-in-out infinite' : 'none',
          }} />
          {playingNode
            ? <>NOW PLAYING <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 12, letterSpacing: '0.04em', marginLeft: 6 }}>{playingNode.title || `第 ${playingNode.week} 周`}</span> <span style={{ opacity: 0.5, marginLeft: 6 }}>W{String(playingNode.week).padStart(3, '0')}</span></>
            : '尚未选定 · TAP A BODY'}
        </span>
        <span style={{ marginLeft: 'auto' }}>显影 / FILM STOCK</span>
      </footer>
    </div>
  );
}

window.PondCloud = PondCloud;

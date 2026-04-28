/* global React */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ════════════════════════════════════════════════════════════════════════════
// POND RING — Direction A : Distant Planet + Ring Slice
// A planet sits far away, its ring stretching toward camera. We see a small
// arc of that ring up close in the foreground; 108 song-bodies are embedded
// in the ring and ride it as it rotates, drifting past the viewer.
// Palette: 显影 / Film Stock.
// ════════════════════════════════════════════════════════════════════════════

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

function hash(seed, salt) {
  return ((seed * 9301 + salt * 49297) % 233280) / 233280;
}
function importanceOf(seed) {
  return 0.32 + ((seed * 1023) % 100) / 100 * 0.63;
}

// ════════════════════════════════════════════════════════════════════════════
// Ring geometry
// ─────────────────────────────────────────────────────────────────────────────
// We treat the ring as a flat annulus around a planet, viewed at a low angle.
// A body's position on the ring is parameterized by:
//    angle θ (0..2π)  → which point on the orbit
//    radius r (0..1)  → which "lane" inside the ring band (inner..outer)
// The camera sits at +Z looking toward -Z; planet center is at world (0, 0, 0).
// We render with a perspective transform that creates the foreground arc and
// the receding far arc behind the planet.
// ════════════════════════════════════════════════════════════════════════════

const RING_INNER = 0.95;
const RING_OUTER = 1.45;
const RING_TILT = 0.32;   // y-flatten = sin(angle of tilt above horizon). lower = flatter.
const CAM_Z = 4.4;        // camera distance from planet center
const ORBIT_PERIOD = 240; // seconds for full revolution (slow)
const PLANET_RADIUS = 0.85;

function buildBodies(tracks) {
  return tracks.map((trk, i) => {
    const r1 = hash(trk.seed + 1, 11);
    const r2 = hash(trk.seed + 1, 23);
    const r3 = hash(trk.seed + 1, 37);
    const r4 = hash(trk.seed + 1, 53);
    const r5 = hash(trk.seed + 1, 71);

    // distribute angles roughly evenly with jitter so they don't perfectly
    // line up. 108 bodies → base step 360°/108 = 3.33°, jitter ±0.7×step
    const baseAngle = (i / tracks.length) * Math.PI * 2;
    const jitter = (r1 - 0.5) * (Math.PI * 2 / tracks.length) * 1.4;
    const angle = baseAngle + jitter;

    // radial position inside the ring band: more bodies in middle than edges
    const radial = 0.5 + (r2 - 0.5) * 0.85;
    const r = RING_INNER + radial * (RING_OUTER - RING_INNER);

    // small vertical jitter so the ring has thickness (not razor-thin)
    const yJitter = (r3 - 0.5) * 0.06;

    const imp = importanceOf(trk.seed);
    const color = FILM_PALETTE[Math.floor(hash(trk.seed, 7) * FILM_PALETTE.length)];

    return {
      ...trk,
      angleBase: angle,
      r,
      yJitter,
      importance: imp,
      bodyR: 0.024 + imp * 0.040, // bigger than cloud — these are foreground stars
      color: color.hex,
      colorName: color.name,
      breath: 2.6 + r4 * 2.2,
      breathPhase: r5 * Math.PI * 2,
    };
  });
}

// project a (x, y, z) world point to screen.
function project(x, y, z, W, H, scale) {
  const viewZ = CAM_Z - z;
  if (viewZ <= 0.05) return null;
  const f = CAM_Z / viewZ;
  const sx = W / 2 + x * scale * f;
  const sy = H / 2 + y * scale * f;
  return { sx, sy, scale: f, viewZ };
}

// world position of a body given current ring rotation
function bodyWorldPos(body, ringAngle) {
  const a = body.angleBase + ringAngle;
  // Ring lies on a plane tilted around the X axis by an angle whose sine
  // is RING_TILT. For a circle of radius b.r in the plane:
  //   x = r·cos(a)
  //   y_plane = r·sin(a)
  //   then tilt: y_world = y_plane * RING_TILT, z_world = -y_plane * cos(tilt)
  // We use a simpler approximation that produces a recognisable elliptical
  // ring on screen.
  const x = body.r * Math.cos(a);
  const yPlane = body.r * Math.sin(a);
  const cosT = Math.sqrt(1 - RING_TILT * RING_TILT);
  const y = yPlane * RING_TILT + body.yJitter;
  const z = -yPlane * cosT;
  return { x, y, z };
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function PondRing({ tracks, onJam }) {
  const [hoverId, setHoverId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [time, setTime] = useState(0);
  const [pulse, setPulse] = useState({});
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const wrapRef = useRef(null);
  const startedAt = useRef(performance.now());
  const offsetRef = useRef(0); // accumulated ring rotation when paused

  const bodies = useMemo(() => buildBodies(tracks), [tracks]);

  // animation loop
  useEffect(() => {
    let frame;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!paused) offsetRef.current += dt * speed;
      setTime((t) => t + dt);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, speed]);

  // jam: A–Z pulses one of the bodies tied to that letter
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); setPaused((p) => !p); return; }
      if (k.length !== 1 || !/[a-z]/.test(k)) return;
      const letter = k.charCodeAt(0) - 97;
      const candidates = bodies.filter((c) => (c.week - 1) % 26 === letter);
      const target = candidates[Math.floor(Math.random() * candidates.length)] ?? bodies[letter % bodies.length];
      if (target) setPulse((p) => ({ ...p, [target.week]: performance.now() }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bodies]);

  const W = wrapRef.current?.clientWidth ?? 1600;
  const H = wrapRef.current?.clientHeight ?? 920;
  const scale = Math.min(W, H) * 0.42;

  const ringAngle = (offsetRef.current / ORBIT_PERIOD) * Math.PI * 2;

  // Project all bodies for current frame, and split them into BEHIND-PLANET
  // and IN-FRONT-OF-PLANET layers. Bodies on the far side of the planet
  // need to be partially occluded by the disc.
  const projected = useMemo(() => {
    const items = [];
    for (const body of bodies) {
      const wp = bodyWorldPos(body, ringAngle);
      const p = project(wp.x, wp.y, wp.z, W, H, scale);
      if (!p) continue;
      // visibility: a body is "behind planet" iff z<0 AND its projected
      // distance to planet center on screen is within the planet radius.
      const planetScreenR = PLANET_RADIUS * scale * (CAM_Z / CAM_Z); // at z=0 planet is at viewer's plane → f=1
      const dxs = p.sx - W / 2, dys = p.sy - H / 2;
      const distFromCenter = Math.sqrt(dxs * dxs + dys * dys);
      const occluded = wp.z < 0 && distFromCenter < planetScreenR * 0.96;
      if (occluded) continue;
      // breathing
      const breath = 1 + Math.sin(time * (Math.PI * 2 / body.breath) + body.breathPhase) * 0.08;
      const radius = body.bodyR * scale * p.scale * breath;
      // depth alpha + blur using viewZ relative to camera distance
      const nearness = Math.max(0, Math.min(1, (CAM_Z - p.viewZ + 1.6) / 3.2));
      const alpha = 0.35 + nearness * 0.55;
      const blur = (1 - nearness) * 4.5;
      items.push({ body, x: p.sx, y: p.sy, z: wp.z, viewZ: p.viewZ, radius, alpha, blur, nearness });
    }
    return items;
  }, [bodies, ringAngle, time, W, H, scale]);

  // back-to-front order
  const sorted = useMemo(() => [...projected].sort((a, b) => b.viewZ - a.viewZ), [projected]);

  const hoverNode = hoverId != null ? bodies.find((c) => c.week === hoverId) : null;
  const playingNode = playingId != null ? bodies.find((c) => c.week === playingId) : null;

  // Planet visuals — fixed at center
  const planetX = W / 2;
  const planetY = H / 2;
  const planetR = PLANET_RADIUS * scale;

  // Ring ellipse parameters (the "back arc" line drawn behind planet, "front arc" in front)
  const ellipseRX = ((RING_INNER + RING_OUTER) / 2) * scale;
  const ellipseRY = ellipseRX * RING_TILT;

  return (
    <div ref={wrapRef}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: 'radial-gradient(ellipse at 50% 60%, #0c0a08 0%, #050402 60%, #000 100%)',
        color: '#e8d8b8',
        overflow: 'hidden',
        fontFamily: "'Azeret Mono', monospace",
        userSelect: 'none',
        cursor: 'default',
      }}>
      {/* film grain */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 99,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        opacity: 0.08, mixBlendMode: 'overlay',
      }} />

      {/* HEADER */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'center', padding: '0 24px',
        borderBottom: '1px solid rgba(232,216,184,0.07)',
        zIndex: 20,
        background: 'linear-gradient(180deg, rgba(12,10,8,0.85) 0%, rgba(12,10,8,0) 100%)',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 19, fontStyle: 'italic', fontWeight: 300,
          letterSpacing: '0.05em', marginRight: 32, whiteSpace: 'nowrap',
          pointerEvents: 'auto',
        }}>
          <em style={{ fontWeight: 600 }}>环</em> 上的群音
          <span style={{ opacity: 0.5, fontSize: 12, marginLeft: 6, letterSpacing: '0.18em', fontStyle: 'normal' }}>BODIES ON THE RING</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, color: 'rgba(232,216,184,0.4)', letterSpacing: '0.18em', marginRight: 16, pointerEvents: 'auto' }}>
          108 BODIES · 显影 · ROTATING · {paused ? 'PAUSED' : `${speed.toFixed(2)}×`}
        </div>
        <button onClick={() => setPaused((p) => !p)} style={{
            fontFamily: "'Azeret Mono', monospace",
            fontSize: 10, letterSpacing: '0.22em', fontWeight: 400,
            padding: '6px 12px',
            background: 'transparent', color: '#e8d8b8',
            border: '1px solid rgba(232,216,184,0.25)',
            borderRadius: 3, cursor: 'pointer', textTransform: 'uppercase',
            marginRight: 8, pointerEvents: 'auto',
          }}>
          {paused ? '▶ PLAY' : '❚❚ PAUSE'}
        </button>
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
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <filter id="ring-blur-far"><feGaussianBlur stdDeviation="3.2" /></filter>
          <filter id="ring-blur-mid"><feGaussianBlur stdDeviation="1.4" /></filter>
          <filter id="ring-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="body-shade" cx="35%" cy="32%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <radialGradient id="planet-shade" cx="32%" cy="30%" r="78%">
            <stop offset="0%"  stopColor="#e8d8b8" />
            <stop offset="22%" stopColor="#a07050" />
            <stop offset="62%" stopColor="#3a2818" />
            <stop offset="100%" stopColor="#0a0604" />
          </radialGradient>
          <radialGradient id="planet-atmo" cx="50%" cy="50%" r="55%">
            <stop offset="0%"  stopColor="rgba(232,216,184,0)" />
            <stop offset="78%" stopColor="rgba(232,168,120,0)" />
            <stop offset="92%" stopColor="rgba(232,168,120,0.18)" />
            <stop offset="100%" stopColor="rgba(232,168,120,0)" />
          </radialGradient>
          {/* ring band gradient — subtle dust */}
          <linearGradient id="ring-band" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"  stopColor="rgba(216,168,120,0.05)" />
            <stop offset="50%" stopColor="rgba(216,168,120,0.18)" />
            <stop offset="100%" stopColor="rgba(216,168,120,0.05)" />
          </linearGradient>
        </defs>

        {/* DISTANT STARS */}
        <g>
          {Array.from({ length: 80 }).map((_, i) => {
            const sr = hash(i + 1, 17);
            const sx = hash(i + 1, 29) * W;
            const sy = hash(i + 1, 41) * H * 0.7;
            const r = 0.4 + sr * 1.1;
            return <circle key={`star-${i}`} cx={sx} cy={sy} r={r} fill="rgba(232,216,184,0.5)" />;
          })}
        </g>

        {/* ATMOSPHERIC GLOW around planet */}
        <circle cx={planetX} cy={planetY} r={planetR * 1.45}
          fill="url(#planet-atmo)" />

        {/* BACK HALF OF RING — the arc behind the planet */}
        {/* Drawn as an ellipse stroke; clipped to the upper half by drawing only
            the top arc. We approximate by drawing two ellipse paths, one outer
            and one inner, with low opacity, using arcs. */}
        <g>
          <ellipse cx={planetX} cy={planetY} rx={ellipseRX} ry={ellipseRY}
            fill="none" stroke="rgba(216,168,120,0.10)" strokeWidth={ellipseRY * 0.55}
            transform={`rotate(${(-ringAngle * 180 / Math.PI) * 0} ${planetX} ${planetY})`} />
          <ellipse cx={planetX} cy={planetY} rx={ellipseRX * 1.04} ry={ellipseRY * 1.04}
            fill="none" stroke="rgba(216,168,120,0.04)" strokeWidth="1" />
          <ellipse cx={planetX} cy={planetY} rx={ellipseRX * 0.92} ry={ellipseRY * 0.92}
            fill="none" stroke="rgba(216,168,120,0.04)" strokeWidth="1" />
        </g>

        {/* BODIES ON THE BACK (z < 0 side that's not occluded — i.e. left/right of planet) */}
        {sorted.filter((p) => p.z < 0).map((p) => renderBody(p, time, pulse, hoverId, playingId, setHoverId, setPlayingId))}

        {/* PLANET */}
        <g>
          <circle cx={planetX} cy={planetY} r={planetR} fill="url(#planet-shade)" />
          {/* terminator shadow on the right side */}
          <circle cx={planetX + planetR * 0.18} cy={planetY + planetR * 0.06} r={planetR * 1.02}
            fill="rgba(0,0,0,0.55)" />
          {/* atmospheric rim light on the left */}
          <circle cx={planetX} cy={planetY} r={planetR}
            fill="none" stroke="rgba(232,216,184,0.22)" strokeWidth="1.4" />
        </g>

        {/* BODIES ON THE FRONT (z >= 0) */}
        {sorted.filter((p) => p.z >= 0).map((p) => renderBody(p, time, pulse, hoverId, playingId, setHoverId, setPlayingId))}
      </svg>

      {/* HOVER CARD */}
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

      {/* SPEED SLIDER */}
      <div style={{
        position: 'absolute', bottom: 48, right: 24, zIndex: 18,
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 9, letterSpacing: '0.22em', color: 'rgba(232,216,184,0.45)',
        pointerEvents: 'auto',
      }}>
        <span>SPEED</span>
        <input type="range" min="0" max="4" step="0.05"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          style={{ width: 120, accentColor: '#d8a878' }} />
        <span style={{ minWidth: 40 }}>{speed.toFixed(2)}×</span>
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
        <span>⊙ 108 BODIES · ORBIT {ORBIT_PERIOD}s</span>
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
            : 'SPACE = PAUSE · A–Z = JAM PULSE'}
        </span>
        <span style={{ marginLeft: 'auto' }}>显影 / FILM STOCK</span>
      </footer>
    </div>
  );
}

// shared body renderer
function renderBody(p, time, pulse, hoverId, playingId, setHoverId, setPlayingId) {
  const isHover = hoverId === p.body.week;
  const isPlaying = playingId === p.body.week;
  const pulseStart = pulse[p.body.week];
  let pulseT = 0;
  if (pulseStart) {
    const dt = (performance.now() - pulseStart) / 1000;
    if (dt < 1.4) pulseT = 1 - dt / 1.4;
  }
  const filter = p.blur > 3 ? 'url(#ring-blur-far)'
               : p.blur > 1 ? 'url(#ring-blur-mid)'
               : (isHover || isPlaying) ? 'url(#ring-glow)'
               : null;
  const showLabel = p.radius > 18 && !p.blur;

  return (
    <g key={p.body.week}
       transform={`translate(${p.x},${p.y})`}
       style={{ cursor: 'pointer' }}
       onMouseEnter={() => setHoverId(p.body.week)}
       onMouseLeave={() => setHoverId((cur) => (cur === p.body.week ? null : cur))}
       onClick={(e) => { e.stopPropagation(); setPlayingId((cur) => cur === p.body.week ? null : p.body.week); }}
    >
      {/* breathing ring (only foreground) */}
      {p.nearness > 0.55 && (
        <circle r={p.radius * (1.05 + 0.45 * (1 - (Math.sin(time * 1.6 + p.body.breathPhase) + 1) / 2))}
          fill="none" stroke={p.body.color}
          strokeOpacity={0.20 * p.nearness} strokeWidth="0.6"
          filter={filter} />
      )}
      {/* pulse ring */}
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
        fillOpacity={p.alpha}
        filter={filter}
      />
      {/* shading highlight */}
      {p.radius > 4 && p.blur < 3 && (
        <circle r={p.radius} fill="url(#body-shade)" />
      )}
      {/* drop shadow disc to reinforce 3D — only for near bodies */}
      {p.nearness > 0.7 && (
        <ellipse cy={p.radius * 1.6} rx={p.radius * 0.85} ry={p.radius * 0.18}
          fill="rgba(0,0,0,0.42)" />
      )}
      {/* hover overlay */}
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
      {/* track number on big foreground bodies */}
      {showLabel && p.radius > 22 && (
        <text textAnchor="middle" dy="4"
          fontFamily="'Cormorant Garamond', serif"
          fontStyle="italic" fontWeight="300"
          fontSize={Math.max(12, p.radius * 0.55)}
          fill="rgba(255,255,255,0.85)"
          pointerEvents="none">
          {p.body.week}
        </text>
      )}
    </g>
  );
}

window.PondRing = PondRing;

/* global React */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ════════════════════════════════════════════════════════════════════════════
// POND BLACKHOLE — Direction E : Gargantua-style accretion disk
// Pitch-black event horizon at center, encircled by a glowing accretion disk
// gravitationally lensed so the back of the disk appears above and below
// the silhouette (the iconic "halo" loop). 108 song-bodies are embedded in
// the disk as bright pearls; they ride the disk as it spins past the camera.
// Palette: 显影 / Film Stock — Portra warm orange · cream highlight · chocolate
// shadow. The hot disk glows in golden/amber/white over deep black.
// ════════════════════════════════════════════════════════════════════════════

function hash(seed, salt) {
  return ((seed * 9301 + salt * 49297) % 233280) / 233280;
}
function importanceOf(seed) {
  return 0.32 + ((seed * 1023) % 100) / 100 * 0.63;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry
// ─────────────────────────────────────────────────────────────────────────────
// The disk lies on a plane tilted at a small angle θ from the line of sight,
// so we see it nearly edge-on (Gargantua look).
const DISK_TILT = 0.18;   // sin(θ) — very flat
const DISK_INNER = 1.20;  // ISCO-ish, just outside the photon ring
const DISK_OUTER = 2.20;
const HORIZON_R = 0.78;   // event horizon radius (in same units)
const PHOTON_R = 0.92;    // photon ring (lensed Einstein ring)
const CAM_Z = 5.2;
const ORBIT_PERIOD = 90;  // disk completes a turn every 90s (faster — these are hot, infalling)

function buildBodies(tracks) {
  return tracks.map((trk, i) => {
    const r1 = hash(trk.seed + 1, 11);
    const r2 = hash(trk.seed + 1, 23);
    const r3 = hash(trk.seed + 1, 37);
    const r4 = hash(trk.seed + 1, 53);
    const r5 = hash(trk.seed + 1, 71);

    // angle distribution — even with mild jitter so disk is densely populated
    const baseAngle = (i / tracks.length) * Math.PI * 2;
    const jitter = (r1 - 0.5) * (Math.PI * 2 / tracks.length) * 1.4;
    const angle = baseAngle + jitter;

    // Inner orbits are faster, outer slower (Keplerian feel — fake)
    const radial = 0.5 + (r2 - 0.5) * 0.85;
    const r = DISK_INNER + radial * (DISK_OUTER - DISK_INNER);
    const orbitalScale = Math.pow(DISK_INNER / r, 0.35); // inner = faster

    // tiny vertical jitter for disk thickness
    const yJitter = (r3 - 0.5) * 0.04;

    const imp = importanceOf(trk.seed);

    return {
      ...trk,
      angleBase: angle,
      r,
      yJitter,
      orbitalScale,
      importance: imp,
      bodyR: 0.020 + imp * 0.034,
      // body color: hottest near inner edge (white), coolest at outer (deep amber)
      // we'll compute per-frame because it depends on angle (Doppler-ish brightness)
      breath: 2.6 + r4 * 2.2,
      breathPhase: r5 * Math.PI * 2,
    };
  });
}

// project (x, y, z) world to screen
function project(x, y, z, W, H, scale) {
  const viewZ = CAM_Z - z;
  if (viewZ <= 0.05) return null;
  const f = CAM_Z / viewZ;
  const sx = W / 2 + x * scale * f;
  const sy = H / 2 + y * scale * f;
  return { sx, sy, scale: f, viewZ };
}

// world position of a body on the rotating disk plane.
// The disk plane is tilted around the X axis. For a circle of radius r in
// that plane, a body at angle θ has:
//   x = r·cos(θ)
//   y_plane = r·sin(θ)
//   y_world = y_plane * sin(tilt) + yJitter
//   z_world = -y_plane * cos(tilt)  (so back of disk is at -z, behind hole)
function bodyWorldPos(body, ringAngle) {
  const a = body.angleBase + ringAngle * body.orbitalScale;
  const x = body.r * Math.cos(a);
  const yPlane = body.r * Math.sin(a);
  const cosT = Math.sqrt(1 - DISK_TILT * DISK_TILT);
  const y = yPlane * DISK_TILT + body.yJitter;
  const z = -yPlane * cosT;
  return { x, y, z, a };
}

// Body color along the disk: hot inner = white/cream, cooler outer = amber/red.
// Plus a brightness modulation that peaks at the side approaching camera (fake Doppler).
function bodyColor(body, a) {
  const t = (body.r - DISK_INNER) / (DISK_OUTER - DISK_INNER); // 0=inner, 1=outer
  // gradient stops: white -> cream -> amber -> deep amber -> umber
  const stops = [
    { t: 0.0, c: [255, 248, 224] }, // white-cream
    { t: 0.3, c: [248, 218, 152] }, // cream-amber
    { t: 0.6, c: [216, 152,  96] }, // amber
    { t: 0.85, c: [168, 100,  60] }, // deep amber
    { t: 1.0, c: [110,  64,  40] }, // umber
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const u = (t - lo.t) / (hi.t - lo.t);
  const c = [
    Math.round(lo.c[0] + (hi.c[0] - lo.c[0]) * u),
    Math.round(lo.c[1] + (hi.c[1] - lo.c[1]) * u),
    Math.round(lo.c[2] + (hi.c[2] - lo.c[2]) * u),
  ];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// "Doppler boost" — bodies moving TOWARD camera look brighter.
// Approaching side is where dx/dt is positive in screen space; for our disk,
// that's roughly cos(a) > 0 (the right side rotating into us).
// Returns a multiplier in [0.55, 1.4].
function dopplerBoost(a) {
  return 0.55 + (Math.sin(a) + 1) / 2 * 0.85;
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function PondBlackhole({ tracks, onJam }) {
  const [hoverId, setHoverId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [time, setTime] = useState(0);
  const [pulse, setPulse] = useState({});
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const wrapRef = useRef(null);
  const startedAt = useRef(performance.now());
  const offsetRef = useRef(0);

  const bodies = useMemo(() => buildBodies(tracks), [tracks]);

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
  const scale = Math.min(W, H) * 0.30;

  const ringAngle = (offsetRef.current / ORBIT_PERIOD) * Math.PI * 2;

  // Project all bodies for current frame.
  // Bodies BEHIND the hole are shown via the "lensing trick" — we push their
  // y position upward (above the silhouette) to mimic Gargantua's loop.
  const projected = useMemo(() => {
    const items = [];
    for (const body of bodies) {
      const wp = bodyWorldPos(body, ringAngle);
      const p = project(wp.x, wp.y, wp.z, W, H, scale);
      if (!p) continue;

      // Determine if body is on the BACK of the disk and would be occluded
      // by the event horizon. For Gargantua-style lensing, we render a SECOND
      // image of the body looped above the silhouette.
      const horizonScreenR = HORIZON_R * scale;
      const dx = p.sx - W / 2;
      const dy = p.sy - H / 2;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const hiddenByHorizon = wp.z < 0 && distFromCenter < horizonScreenR * 1.05;

      const breath = 1 + Math.sin(time * (Math.PI * 2 / body.breath) + body.breathPhase) * 0.06;
      const radius = body.bodyR * scale * p.scale * breath;

      // brightness depending on Doppler-fake
      const dop = dopplerBoost(wp.a);
      const color = bodyColor(body, wp.a);
      const alpha = 0.80 * dop;

      // back/front classification for paint order
      const back = wp.z < 0;

      if (!hiddenByHorizon) {
        // primary image
        items.push({ body, x: p.sx, y: p.sy, z: wp.z, viewZ: p.viewZ, radius, alpha, color, back, lensed: false });
      } else {
        // lensed image — place it above (or below) the silhouette
        // Compute a "loop" position: wrap the body up over the top of the BH.
        // Move its y coordinate to the top of the silhouette plus its
        // horizontal offset from the symmetry axis.
        const ang = Math.atan2(dy, dx);
        const newAng = -Math.abs(ang); // force into upper half (negative y)
        const loopR = horizonScreenR * 1.12 + Math.abs(dx) * 0.06;
        const lx = W / 2 + Math.cos(newAng) * loopR;
        const ly = H / 2 + Math.sin(newAng) * loopR * 0.55;
        const lensRadius = radius * 0.78;
        items.push({
          body, x: lx, y: ly, z: 0.05, viewZ: p.viewZ,
          radius: lensRadius, alpha: alpha * 0.85, color,
          back: false, lensed: true,
        });
        // also a fainter mirrored image below (the "lower lens" caustic)
        items.push({
          body, x: W - lx + W * 0, y: H - ly,
          z: 0.05, viewZ: p.viewZ,
          radius: lensRadius * 0.7, alpha: alpha * 0.45, color,
          back: false, lensed: true,
        });
      }
    }
    return items;
  }, [bodies, ringAngle, time, W, H, scale]);

  const sorted = useMemo(() => [...projected].sort((a, b) => b.viewZ - a.viewZ), [projected]);

  const hoverNode = hoverId != null ? bodies.find((c) => c.week === hoverId) : null;
  const playingNode = playingId != null ? bodies.find((c) => c.week === playingId) : null;

  const cx = W / 2, cy = H / 2;
  const horizonR = HORIZON_R * scale;
  const photonR = PHOTON_R * scale;
  const diskInnerRX = DISK_INNER * scale;
  const diskOuterRX = DISK_OUTER * scale;
  const diskInnerRY = diskInnerRX * DISK_TILT;
  const diskOuterRY = diskOuterRX * DISK_TILT;

  // Generate "swirl" streak paths on the disk for atmosphere.
  // Each streak is a partial spiral arc on the disk plane, projected.
  const streaks = useMemo(() => {
    const out = [];
    const N = 28;
    for (let i = 0; i < N; i++) {
      const r0 = DISK_INNER + (i / N) * (DISK_OUTER - DISK_INNER) + (hash(i, 17) - 0.5) * 0.05;
      const a0 = hash(i, 31) * Math.PI * 2;
      const len = 0.4 + hash(i, 43) * 1.2; // arc length in radians
      out.push({ r0, a0, len, w: 0.7 + hash(i, 53) * 1.4, op: 0.10 + hash(i, 61) * 0.18 });
    }
    return out;
  }, []);

  return (
    <div ref={wrapRef}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: 'radial-gradient(ellipse at 50% 50%, #050300 0%, #020200 50%, #000 100%)',
        color: '#e8d8b8',
        overflow: 'hidden',
        fontFamily: "'Azeret Mono', monospace",
        userSelect: 'none', cursor: 'default',
      }}>
      {/* dust / film grain */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 99,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        opacity: 0.06, mixBlendMode: 'overlay',
      }} />

      {/* HEADER */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'center', padding: '0 24px',
        borderBottom: '1px solid rgba(232,216,184,0.07)',
        zIndex: 20,
        background: 'linear-gradient(180deg, rgba(5,3,0,0.85) 0%, rgba(5,3,0,0) 100%)',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 19, fontStyle: 'italic', fontWeight: 300,
          letterSpacing: '0.05em', marginRight: 32, whiteSpace: 'nowrap',
          pointerEvents: 'auto',
        }}>
          <em style={{ fontWeight: 600 }}>奇点</em> 周遭
          <span style={{ opacity: 0.5, fontSize: 12, marginLeft: 6, letterSpacing: '0.18em', fontStyle: 'normal' }}>EVENT HORIZON</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, color: 'rgba(232,216,184,0.42)', letterSpacing: '0.18em', marginRight: 16, pointerEvents: 'auto' }}>
          108 BODIES · ACCRETION DISK · {paused ? 'PAUSED' : `${speed.toFixed(2)}×`}
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
            background: '#f8da98', color: '#0a0500',
            border: 'none', borderRadius: 3, cursor: 'pointer',
            textTransform: 'uppercase',
            boxShadow: '0 0 26px rgba(248,218,152,0.30)',
            pointerEvents: 'auto',
          }}>
          ◐ 合奏 JAM
        </button>
      </header>

      {/* CANVAS */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <filter id="bh-blur-far"><feGaussianBlur stdDeviation="3.2" /></filter>
          <filter id="bh-blur-mid"><feGaussianBlur stdDeviation="1.4" /></filter>
          <filter id="bh-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="bh-soft-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="14" />
          </filter>

          {/* Body sphere highlight */}
          <radialGradient id="body-shade-bh" cx="35%" cy="32%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Disk band gradients */}
          <radialGradient id="disk-back-grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%"   stopColor="rgba(255,248,220,0)" />
            <stop offset="35%"  stopColor="rgba(248,210,140,0)" />
            <stop offset="60%"  stopColor="rgba(248,200,128,0.55)" />
            <stop offset="78%"  stopColor="rgba(216,140, 80,0.65)" />
            <stop offset="92%"  stopColor="rgba(140, 70, 32,0.20)" />
            <stop offset="100%" stopColor="rgba(60, 25, 10,0)" />
          </radialGradient>
          <linearGradient id="disk-azimuthal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
            <stop offset="20%"  stopColor="rgba(255,240,200,0.05)" />
            <stop offset="50%"  stopColor="rgba(255,255,255,0.30)" />
            <stop offset="80%"  stopColor="rgba(255,240,200,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Photon ring rim glow */}
          <radialGradient id="photon-rim" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
            <stop offset="80%"  stopColor="rgba(0,0,0,0)" />
            <stop offset="92%"  stopColor="rgba(255,232,168,0.35)" />
            <stop offset="100%" stopColor="rgba(255,232,168,0)" />
          </radialGradient>

          {/* The lensed "vertical loop" — a thin ellipse rotated 90° */}
          <radialGradient id="loop-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(255,248,220,0)" />
            <stop offset="55%"  stopColor="rgba(255,232,168,0)" />
            <stop offset="76%"  stopColor="rgba(248,212,150,0.55)" />
            <stop offset="92%"  stopColor="rgba(216,140, 80,0.20)" />
            <stop offset="100%" stopColor="rgba(60, 25, 10,0)" />
          </radialGradient>

          {/* Disk clip — confines glow to band */}
          <clipPath id="disk-band-clip">
            <ellipse cx={cx} cy={cy} rx={diskOuterRX * 1.06} ry={diskOuterRY * 1.06} />
          </clipPath>
        </defs>

        {/* DISTANT STARS (lensed near hole) */}
        <g>
          {Array.from({ length: 110 }).map((_, i) => {
            const sr = hash(i + 7, 17);
            const sx = hash(i + 7, 29) * W;
            const sy = hash(i + 7, 41) * H;
            const dxs = sx - cx, dys = sy - cy;
            const dist = Math.sqrt(dxs * dxs + dys * dys);
            // skip stars too close to hole (they'd be lensed away)
            if (dist < horizonR * 1.6) return null;
            const r = 0.3 + sr * 1.2;
            const op = 0.35 + sr * 0.45;
            return <circle key={`star-${i}`} cx={sx} cy={sy} r={r} fill="rgba(255,248,224,1)" opacity={op} />;
          })}
        </g>

        {/* 1. DISK BACK HALF — the "far" side of the disk that's behind the hole.
            Drawn as an ellipse band, then the front half of the hole will paint
            over the bits that would be occluded.  We reduce its opacity slightly
            so it reads as more distant. */}
        <g style={{ transform: `rotate(${(ringAngle * 0.04 * 180 / Math.PI).toFixed(2)}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
          {/* outer halo */}
          <ellipse cx={cx} cy={cy} rx={diskOuterRX * 1.15} ry={diskOuterRY * 1.45}
            fill="url(#disk-back-grad)" opacity="0.55" filter="url(#bh-soft-glow)" />

          {/* main disk — drawn as an annular band by stroking an ellipse at the
              mid-radius with a stroke width = (outer - inner). */}
          <ellipse cx={cx} cy={cy}
            rx={(diskInnerRX + diskOuterRX) / 2}
            ry={(diskInnerRY + diskOuterRY) / 2}
            fill="none"
            stroke="url(#disk-back-grad)"
            strokeWidth={(diskOuterRX - diskInnerRX) * 0.95}
            opacity="0.95" />

          {/* azimuthal hot/cool variation — overlay a rotating gradient */}
          <ellipse cx={cx} cy={cy}
            rx={(diskInnerRX + diskOuterRX) / 2}
            ry={(diskInnerRY + diskOuterRY) / 2}
            fill="none"
            stroke="url(#disk-azimuthal)"
            strokeWidth={(diskOuterRX - diskInnerRX) * 0.8}
            opacity="0.55" />

          {/* swirl streaks — many faint partial-arcs */}
          <g clipPath="url(#disk-band-clip)" opacity="0.85">
            {streaks.map((s, i) => {
              const r = s.r0 * scale;
              const ry = r * DISK_TILT;
              const a0 = s.a0 + ringAngle * 0.7;
              const a1 = a0 + s.len;
              // build path along ellipse
              const N = 24;
              let d = '';
              for (let k = 0; k <= N; k++) {
                const a = a0 + (a1 - a0) * (k / N);
                const x = cx + Math.cos(a) * r;
                const y = cy + Math.sin(a) * ry;
                d += (k === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
              }
              return <path key={`streak-${i}`} d={d} fill="none"
                stroke="rgba(255,236,184,1)" strokeWidth={s.w} strokeOpacity={s.op}
                strokeLinecap="round" />;
            })}
          </g>
        </g>

        {/* 2. BODIES on the BACK of disk that are NOT occluded — paint behind hole */}
        {sorted.filter((p) => p.back && !p.lensed).map((p, idx) => renderBody(p, idx, 'b', time, pulse, hoverId, playingId, setHoverId, setPlayingId))}

        {/* 3. EVENT HORIZON — pure black sphere with subtle photon ring */}
        <g>
          {/* photon ring — thin bright Einstein ring hugging the silhouette */}
          <circle cx={cx} cy={cy} r={photonR} fill="none"
            stroke="rgba(255,236,176,0.85)" strokeWidth="1.6" filter="url(#bh-glow)" />
          <circle cx={cx} cy={cy} r={photonR + 1.2} fill="none"
            stroke="rgba(255,232,168,0.55)" strokeWidth="0.8" />
          {/* event horizon proper — pitch black */}
          <circle cx={cx} cy={cy} r={horizonR} fill="#000" />
          {/* darker inner shadow to give depth */}
          <circle cx={cx} cy={cy} r={horizonR * 0.92} fill="#000"
            stroke="rgba(0,0,0,0.95)" />
          {/* photon-ring outer halo for readability */}
          <circle cx={cx} cy={cy} r={photonR * 1.06} fill="url(#photon-rim)" />
        </g>

        {/* 4. THE LENSED "VERTICAL LOOP" — Gargantua's iconic feature.
            The back of the disk is gravitationally lifted to APPEAR ABOVE the
            silhouette as a thin vertical arc. We fake this with a thin ellipse
            rotated 90°, drawn ABOVE and BELOW the BH, with much lower vertical
            extent than the main disk. */}
        <g>
          {/* upper loop */}
          <ellipse cx={cx} cy={cy}
            rx={diskInnerRX * 0.45}
            ry={diskOuterRX * 0.95}
            fill="none"
            stroke="url(#loop-grad)"
            strokeWidth={(diskOuterRX - diskInnerRX) * 0.32}
            opacity="0.92" />
          {/* secondary thinner loop slightly outside */}
          <ellipse cx={cx} cy={cy}
            rx={diskInnerRX * 0.55}
            ry={diskOuterRX * 1.10}
            fill="none"
            stroke="url(#loop-grad)"
            strokeWidth={(diskOuterRX - diskInnerRX) * 0.18}
            opacity="0.55" />
        </g>

        {/* 5. BODIES IN FRONT — paint over the hole + loops */}
        {sorted.filter((p) => !p.back || p.lensed).map((p, idx) => renderBody(p, idx, 'f', time, pulse, hoverId, playingId, setHoverId, setPlayingId))}

        {/* 6. FRONT EDGE OF THE DISK (foreground arc swooping in front of horizon).
            This is the bottom half of the main disk band, redrawn on top of the
            horizon so it reads as "in front" of the BH. */}
        <g style={{ transform: `rotate(${(ringAngle * 0.04 * 180 / Math.PI).toFixed(2)}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
          <path
            d={ellipseHalfPath(cx, cy, (diskInnerRX + diskOuterRX) / 2, (diskInnerRY + diskOuterRY) / 2, true)}
            fill="none"
            stroke="url(#disk-back-grad)"
            strokeWidth={(diskOuterRX - diskInnerRX) * 0.95}
            opacity="0.95" />
          <path
            d={ellipseHalfPath(cx, cy, (diskInnerRX + diskOuterRX) / 2, (diskInnerRY + diskOuterRY) / 2, true)}
            fill="none"
            stroke="url(#disk-azimuthal)"
            strokeWidth={(diskOuterRX - diskInnerRX) * 0.8}
            opacity="0.55" />
        </g>
      </svg>

      {/* HOVER CARD */}
      {hoverNode && (
        <div style={{
          position: 'absolute', top: 70, left: 24, zIndex: 15,
          pointerEvents: 'none',
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic', fontWeight: 300,
          fontSize: 32, letterSpacing: '0.02em',
          color: 'rgba(255,232,184,0.96)',
          textShadow: '0 0 18px rgba(255,200,120,0.4)',
        }}>
          {hoverNode.title || `第 ${hoverNode.week} 周`}
          <div style={{
            fontFamily: "'Azeret Mono', monospace", fontStyle: 'normal',
            fontSize: 10, letterSpacing: '0.22em',
            color: 'rgba(232,216,184,0.42)', marginTop: 6,
            textShadow: 'none',
          }}>
            W{String(hoverNode.week).padStart(3, '0')} · IMP {hoverNode.importance.toFixed(2)} · r {hoverNode.r.toFixed(2)}
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
          style={{ width: 120, accentColor: '#f8da98' }} />
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
        background: 'linear-gradient(0deg, rgba(5,3,0,0.85) 0%, rgba(5,3,0,0) 100%)',
        backdropFilter: 'blur(8px)',
      }}>
        <span>⊙ 108 BODIES IN ACCRETION · ORBIT {ORBIT_PERIOD}s</span>
        <span style={{ margin: '0 16px', opacity: 0.3 }}>│</span>
        <span style={{ color: playingNode ? '#f8da98' : 'rgba(232,216,184,0.4)' }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: playingNode ? '#f8da98' : 'rgba(232,216,184,0.4)',
            marginRight: 7, verticalAlign: 'middle',
            animation: playingNode ? 'blink 1.4s ease-in-out infinite' : 'none',
          }} />
          {playingNode
            ? <>NOW PLAYING <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 12, letterSpacing: '0.04em', marginLeft: 6 }}>{playingNode.title || `第 ${playingNode.week} 周`}</span> <span style={{ opacity: 0.5, marginLeft: 6 }}>W{String(playingNode.week).padStart(3, '0')}</span></>
            : 'SPACE = PAUSE · A–Z = JAM PULSE · CLICK A BODY'}
        </span>
        <span style={{ marginLeft: 'auto' }}>显影 / GARGANTUA</span>
      </footer>
    </div>
  );
}

// path that draws only the FRONT (bottom) half of an ellipse — used for the
// "front arc" overlay that occludes the silhouette properly.
function ellipseHalfPath(cx, cy, rx, ry, frontHalf) {
  if (frontHalf) {
    // bottom half: from (cx-rx, cy) sweeping down to (cx+rx, cy)
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
  } else {
    // top half
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;
  }
}

// shared body renderer
function renderBody(p, idx, layer, time, pulse, hoverId, playingId, setHoverId, setPlayingId) {
  const isHover = hoverId === p.body.week;
  const isPlaying = playingId === p.body.week;
  const pulseStart = pulse[p.body.week];
  let pulseT = 0;
  if (pulseStart) {
    const dt = (performance.now() - pulseStart) / 1000;
    if (dt < 1.4) pulseT = 1 - dt / 1.4;
  }
  const filter = (isHover || isPlaying) ? 'url(#bh-glow)' : null;

  return (
    <g key={`${layer}-${idx}-${p.body.week}-${p.lensed ? 'L' : 'P'}`}
       transform={`translate(${p.x},${p.y})`}
       style={{ cursor: 'pointer' }}
       onMouseEnter={() => setHoverId(p.body.week)}
       onMouseLeave={() => setHoverId((cur) => (cur === p.body.week ? null : cur))}
       onClick={(e) => { e.stopPropagation(); setPlayingId((cur) => cur === p.body.week ? null : p.body.week); }}
    >
      {/* pulse ring (jam strike) */}
      {pulseT > 0 && (
        <>
          <circle r={p.radius * (1 + (1 - pulseT) * 4)} fill="none"
            stroke={p.color} strokeOpacity={pulseT * 0.85} strokeWidth="1.3" />
          <circle r={p.radius * (1 + (1 - pulseT) * 7)} fill="none"
            stroke={p.color} strokeOpacity={pulseT * 0.4} strokeWidth="0.6" />
        </>
      )}
      {/* outer halo — soft glow */}
      <circle r={p.radius * 2.2}
        fill={p.color} fillOpacity={p.alpha * 0.18}
        filter="url(#bh-soft-glow)" />
      {/* body */}
      <circle r={p.radius * (1 + pulseT * 0.35)}
        fill={p.color}
        fillOpacity={p.alpha}
        filter={filter} />
      {/* shading highlight */}
      {p.radius > 4 && (
        <circle r={p.radius} fill="url(#body-shade-bh)" />
      )}
      {/* hover overlay */}
      {(isHover || isPlaying) && (
        <>
          <circle r="14" fill="rgba(0,0,0,0.55)" stroke="rgba(255,232,184,0.5)" strokeWidth="1" />
          {isPlaying ? (
            <>
              <rect x="-5" y="-7" width="3.5" height="14" fill="#f8da98" />
              <rect x="1.5" y="-7" width="3.5" height="14" fill="#f8da98" />
            </>
          ) : (
            <path d="M-4,-7 L7,0 L-4,7 Z" fill="#f8da98" />
          )}
        </>
      )}
      {/* track number on near bodies */}
      {p.radius > 22 && !p.lensed && (
        <text textAnchor="middle" dy="4"
          fontFamily="'Cormorant Garamond', serif"
          fontStyle="italic" fontWeight="300"
          fontSize={Math.max(12, p.radius * 0.55)}
          fill="rgba(255,255,255,0.92)"
          pointerEvents="none">
          {p.body.week}
        </text>
      )}
    </g>
  );
}

window.PondBlackhole = PondBlackhole;

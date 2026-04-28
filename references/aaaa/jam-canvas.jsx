/* global React */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ════════════════════════════════════════════════════════════════════════════
// JAM CANVAS — full-bleed Patatap-style keyboard jam
// • Auto-records on first keystroke
// • "Pure" mode hides all UI (just the visual)
// • Palette swappable (real Patatap palettes, not project palettes)
// • A–Z triggers SVG animation + WebAudio tone
// ════════════════════════════════════════════════════════════════════════════

// Refined audio: per-letter frequencies + per-letter wave + slight reverb tail.
// Replaces the simpler shared.jsx version when used inside JamCanvas.
let _audioCtx = null;
let _master = null;
let _convolver = null;
function getJamAudio() {
  if (_audioCtx) return _audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  _audioCtx = new Ctx();
  _master = _audioCtx.createGain();
  _master.gain.value = 0.7;
  _master.connect(_audioCtx.destination);
  // Tiny synthetic reverb (impulse from white noise w/ exponential decay)
  _convolver = _audioCtx.createConvolver();
  const len = _audioCtx.sampleRate * 1.6;
  const buf = _audioCtx.createBuffer(2, len, _audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
  }
  _convolver.buffer = buf;
  const wet = _audioCtx.createGain();
  wet.gain.value = 0.15;
  _convolver.connect(wet);
  wet.connect(_audioCtx.destination);
  return _audioCtx;
}

function playJamTone(key, paletteKey = 'purple') {
  const ctx = getJamAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const i = key.charCodeAt(0) - 97;
  // Pentatonic minor — feels less wrong on collisions
  const scale = [0, 3, 5, 7, 10];
  const note = scale[i % 5] + Math.floor(i / 5) * 5 - 12;
  const freq = 261.63 * Math.pow(2, note / 12);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  // Wave varies by row of the keyboard
  const row = Math.floor(i / 9);
  o.type = ['sine', 'triangle', 'sawtooth'][row % 3];
  o.frequency.value = freq;
  g.gain.value = 0;
  // light filter
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2200;
  f.Q.value = 1.2;
  o.connect(f);
  f.connect(g);
  g.connect(_master);
  if (_convolver) f.connect(_convolver);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  o.start(t);
  o.stop(t + 1.5);
}

// ──────────────────────────────────────────────
// Subtle background ambience (chord pad)
// ──────────────────────────────────────────────
let _ambient = null;
function startAmbient() {
  const ctx = getJamAudio();
  if (!ctx || _ambient) return;
  if (ctx.state === 'suspended') ctx.resume();
  const notes = [55, 65.4, 82.4, 98]; // A1, C2, E2, G2 — Am9
  const oscs = [];
  const masterG = ctx.createGain();
  masterG.gain.value = 0.0;
  masterG.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 3);
  masterG.connect(ctx.destination);
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 1 / notes.length;
    // slow LFO on gain for movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + i * 0.04;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    o.connect(g);
    g.connect(masterG);
    o.start();
    lfo.start();
    oscs.push(o, lfo);
  });
  _ambient = { oscs, masterG };
}
function stopAmbient() {
  if (!_ambient) return;
  const ctx = getJamAudio();
  if (!ctx) return;
  const { oscs, masterG } = _ambient;
  masterG.gain.cancelScheduledValues(ctx.currentTime);
  masterG.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
  setTimeout(() => oscs.forEach((o) => { try { o.stop(); } catch {} }), 1300);
  _ambient = null;
}

// ════════════════════════════════════════════════════════════════════════════
// JAM CANVAS COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function JamCanvas({ paletteKey: initialPalette = 'purple', onExit, embedded = false }) {
  const [paletteKey, setPaletteKey] = useState(initialPalette);
  const [pure, setPure] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recStart, setRecStart] = useState(null);
  const [notes, setNotes] = useState([]);  // [{key, t}]
  const [keyHits, setKeyHits] = useState([]); // recent flashes
  const [tick, setTick] = useState(0); // re-render for time
  const [armed, setArmed] = useState(false); // first interaction → resume audio
  const svgRef = useRef(null);
  const palette = window.PATATAP_PALETTES[paletteKey];

  // Resize observer
  const [size, setSize] = useState({ w: 1280, h: 800 });
  const wrapRef = useRef(null);
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

  // Tick for recording timer (only while recording)
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [recording]);

  // Ambient pad — start on first arm (key press)
  useEffect(() => {
    if (armed && !pure) {
      // optional: could play ambient. Commented out by default to avoid surprise.
    }
  }, [armed, pure]);

  // Trigger one key (called by keyboard + click-to-jam fallback)
  const fire = useCallback((rawKey) => {
    const key = String(rawKey).toLowerCase();
    if (!/^[a-z]$/.test(key)) return;
    setArmed(true);
    if (svgRef.current) {
      window.triggerKey({
        svg: svgRef.current,
        w: size.w, h: size.h,
        paletteKey, key, animKey: key,
      });
    }
    playJamTone(key, paletteKey);

    // Auto-start recording on first keystroke
    if (!recording) {
      setRecording(true);
      const start = performance.now();
      setRecStart(start);
      setNotes([{ key, t: 0 }]);
    } else {
      setNotes((n) => [...n, { key, t: performance.now() - recStart }]);
    }

    // Visual key flash on the bottom strip
    const id = Math.random();
    setKeyHits((h) => [...h, { id, key, t: performance.now() }]);
    setTimeout(() => setKeyHits((h) => h.filter((x) => x.id !== id)), 1200);
  }, [paletteKey, size, recording, recStart]);

  // Keyboard listener
  useEffect(() => {
    const down = new Set();
    const handle = (e) => {
      const k = e.key.toLowerCase();
      // Hot keys
      if (k === 'escape') { onExit?.(); return; }
      if (k === ' ' && !e.repeat) { e.preventDefault(); setPure((p) => !p); return; }
      if (k.length !== 1 || !/[a-z]/.test(k)) return;
      if (down.has(k)) return;
      down.add(k);
      fire(k);
    };
    const up = (e) => down.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handle);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', handle);
      window.removeEventListener('keyup', up);
    };
  }, [fire, onExit]);

  const stopRecording = () => {
    setRecording(false);
    setRecStart(null);
  };
  const clearRecording = () => {
    setNotes([]);
    setRecording(false);
    setRecStart(null);
  };

  const elapsed = recording && recStart ? (performance.now() - recStart) / 1000 : (notes.length ? notes[notes.length - 1].t / 1000 : 0);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s * 10) % 10))}`;

  // The 26 letters arranged like a keyboard
  const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

  return (
    <div ref={wrapRef} style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: palette.background,
      overflow: 'hidden',
      fontFamily: '"Inter", system-ui, sans-serif',
      color: palette.isDark ? palette.white : palette.black,
      cursor: pure ? 'none' : 'default',
    }}>
      {/* SVG canvas */}
      <svg ref={svgRef} width={size.w} height={size.h}
           viewBox={`0 0 ${size.w} ${size.h}`}
           style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      </svg>

      {/* Click-anywhere fallback (mobile / no keyboard) */}
      {!pure && (
        <div
          onPointerDown={(e) => {
            // pick a letter from x-position
            const r = wrapRef.current.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const idx = Math.max(0, Math.min(25, Math.floor(px * 26)));
            fire(String.fromCharCode(97 + idx));
          }}
          style={{
            position: 'absolute', inset: 0, zIndex: 1,
            cursor: 'crosshair',
          }}
        />
      )}

      {/* Header — top bar */}
      {!pure && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
          padding: '20px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: palette.isDark ? palette.white : palette.black,
          opacity: 0.92,
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, pointerEvents: 'auto' }}>
            <div style={{
              fontSize: 22, fontFamily: '"Noto Serif SC", serif',
              fontWeight: 300, letterSpacing: '0.04em',
            }}>
              池中涟漪 <span style={{ fontStyle: 'italic', opacity: 0.7, fontSize: 16, marginLeft: 6 }}>Ripples</span>
            </div>
            <div style={{
              fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
              opacity: 0.55,
            }}>
              JAM · A–Z · ESC EXIT · SPACE PURE
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, pointerEvents: 'auto' }}>
            {/* Palette dots */}
            {window.PALETTE_KEYS.map((k) => {
              const pal = window.PATATAP_PALETTES[k];
              const active = paletteKey === k;
              return (
                <button
                  key={k}
                  onClick={() => setPaletteKey(k)}
                  title={pal.label}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: pal.background,
                    border: active ? `2px solid ${pal.isDark ? pal.white : pal.black}` : `1px solid ${palette.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: active ? '0 0 0 3px rgba(0,0,0,0.04)' : 'none',
                    outline: 'none',
                  }}
                />
              );
            })}
            <div style={{ width: 1, background: palette.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', margin: '0 6px' }} />
            <button onClick={() => setPure(true)} style={ghostBtn(palette)}>纯享 Pure</button>
            <button onClick={() => onExit?.()} style={ghostBtn(palette)}>群岛 Map</button>
          </div>
        </div>
      )}

      {/* Center prompt — only before first hit */}
      {!recording && notes.length === 0 && !pure && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          color: palette.isDark ? palette.white : palette.black,
        }}>
          <div style={{
            fontSize: 12, letterSpacing: '0.4em', opacity: 0.55, marginBottom: 28,
            textTransform: 'uppercase',
          }}>Press any letter to begin</div>
          <div style={{
            fontFamily: '"Noto Serif SC", serif',
            fontSize: 96, fontWeight: 200,
            letterSpacing: '0.18em',
            opacity: 0.18,
          }}>A — Z</div>
          <div style={{
            marginTop: 36, fontSize: 11, letterSpacing: '0.3em', opacity: 0.4,
          }}>按下键盘 · 自动开始录制</div>
        </div>
      )}

      {/* Bottom — recording HUD */}
      {!pure && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5,
          padding: '0 32px 22px',
          display: 'flex', flexDirection: 'column', gap: 12,
          color: palette.isDark ? palette.white : palette.black,
          pointerEvents: 'none',
        }}>
          {/* Keyboard strip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', pointerEvents: 'auto' }}>
            {KB_ROWS.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 5, marginLeft: ri * 16 }}>
                {row.split('').map((k) => {
                  const hit = keyHits.find((h) => h.key === k);
                  const animName = window.ANIM_BY_KEY[k]?.name || '';
                  return (
                    <div
                      key={k}
                      onPointerDown={(e) => { e.stopPropagation(); fire(k); }}
                      style={{
                        position: 'relative',
                        width: 36, height: 36,
                        borderRadius: 6,
                        border: `1px solid ${palette.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'}`,
                        background: hit ? (palette.isDark ? palette.white : palette.black) : 'transparent',
                        color: hit ? (palette.isDark ? palette.black : palette.white) : (palette.isDark ? palette.white : palette.black),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 500, letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: hit ? 'none' : 'background 0.4s, color 0.4s',
                        opacity: 0.85,
                      }}
                      title={animName}
                    >
                      {k}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Recording row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 8, pointerEvents: 'auto',
            fontSize: 11, letterSpacing: '0.2em',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: recording || notes.length ? 1 : 0.4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: recording ? '#e54040' : (palette.isDark ? palette.white : palette.black),
                opacity: recording ? 1 : 0.4,
                animation: recording ? 'blink 1.2s infinite' : 'none',
                display: 'inline-block',
              }} />
              <span style={{ textTransform: 'uppercase', opacity: 0.85 }}>
                {recording ? '录制中 RECORDING' : (notes.length ? '已录制 RECORDED' : '待录制 STANDBY')}
              </span>
              <span style={{ opacity: 0.55, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                {fmt(elapsed)}
              </span>
              <span style={{ opacity: 0.55 }}>
                {notes.length} 音符
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {recording && <button onClick={stopRecording} style={ghostBtn(palette)}>■ STOP</button>}
              {notes.length > 0 && !recording && <button onClick={() => alert('回放原型 / replay prototype')} style={ghostBtn(palette)}>▶ 回放 REPLAY</button>}
              {notes.length > 0 && !recording && <button onClick={() => alert('铸造原型 / mint prototype')} style={primaryBtn(palette)}>↑ 铸造乐谱 MINT</button>}
              {notes.length > 0 && <button onClick={clearRecording} style={ghostBtn(palette)}>✕ 清除</button>}
            </div>
          </div>
        </div>
      )}

      {/* Pure mode exit hint (top right corner) */}
      {pure && (
        <div style={{
          position: 'absolute', top: 16, right: 20, zIndex: 5,
          fontSize: 9, letterSpacing: '0.3em', opacity: 0.35,
          textTransform: 'uppercase',
          color: palette.isDark ? palette.white : palette.black,
        }}>
          SPACE · 返回 EXIT PURE
        </div>
      )}
    </div>
  );
}

function ghostBtn(palette) {
  return {
    background: 'transparent',
    color: palette.isDark ? palette.white : palette.black,
    border: `1px solid ${palette.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
    padding: '6px 12px',
    fontSize: 10,
    fontFamily: 'inherit',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    borderRadius: 3,
    cursor: 'pointer',
    transition: 'background 0.15s',
  };
}
function primaryBtn(palette) {
  return {
    background: palette.isDark ? palette.white : palette.black,
    color: palette.isDark ? palette.black : palette.white,
    border: 'none',
    padding: '7px 14px',
    fontSize: 10,
    fontFamily: 'inherit',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    borderRadius: 3,
    cursor: 'pointer',
    fontWeight: 500,
  };
}

window.JamCanvas = JamCanvas;
window.playJamTone = playJamTone;

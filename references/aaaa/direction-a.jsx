/* global React */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ═════════════════════════════════════════════════════════════════════════════
//  DIRECTION A — POND
//  108 islands floating on a water surface, paginated 4 pages × 27 islands.
//  Drag connections between islands to "jam" them. Keyboard A-Z drops ripples.
// ═════════════════════════════════════════════════════════════════════════════
function DirectionA({ tracks, palette }) {
  const { t } = window.useLang();
  const [page, setPage] = useState(0);
  const [activeTrack, setActiveTrack] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [ripples, setRipples] = useState([]);
  const [jamMode, setJamMode] = useState(false);
  const containerRef = useRef(null);
  const rippleId = useRef(0);

  const PAGE_SIZE = 27;
  const totalPages = Math.ceil(tracks.length / PAGE_SIZE);
  const pageTracks = tracks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stable positions per track (poisson-ish hash)
  const positions = useMemo(() => {
    return pageTracks.map((trk, idx) => {
      const cols = 7;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const jitterX = ((trk.seed * 731 + idx * 53) % 100) / 100 - 0.5;
      const jitterY = ((trk.seed * 911 + idx * 29) % 100) / 100 - 0.5;
      return {
        x: (col + 0.5) / cols * 100 + jitterX * 6,
        y: 12 + row * 14 + jitterY * 5,
      };
    });
  }, [pageTracks]);

  // Keyboard ripple events
  const dropRipple = useCallback((key, x, y) => {
    const id = ++rippleId.current;
    const color = window.keyToColor(key, palette);
    setRipples((r) => [...r, { id, x, y, color, key, born: Date.now() }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 1800);
  }, [palette]);

  window.useJamKeys({
    enabled: jamMode,
    onKey: (key) => {
      window.playKeyTone(key);
      const x = 10 + Math.random() * 80;
      const y = 15 + Math.random() * 70;
      dropRipple(key, x, y);
    },
    palette,
  });

  const pal = window.PALETTES[palette];

  return (
    <div ref={containerRef} style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: pal.inkBg,
      color: pal.fg,
      fontFamily: '"Noto Serif SC", "Songti SC", serif',
      overflow: 'hidden',
    }}>
      {/* Water-surface background */}
      <PondSurface palette={palette} jamMode={jamMode} />

      {/* Header chrome */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '24px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        zIndex: 5, pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.4em', opacity: 0.4, marginBottom: 4 }}>
            CH. 01 · 池中
          </div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 300,
            letterSpacing: '0.3em',
          }}>{t.productName}</h1>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', opacity: 0.3, marginTop: 4 }}>
            {COPY.zh.productNameEn}
          </div>
        </div>
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          <button onClick={() => setJamMode(!jamMode)} style={{
            background: jamMode ? pal.fg : 'transparent',
            color: jamMode ? pal.bg : pal.fg,
            border: `1px solid ${pal.fg}`,
            padding: '6px 16px', fontSize: 11, letterSpacing: '0.3em',
            cursor: 'pointer', borderRadius: 0, fontFamily: 'inherit',
          }}>
            {jamMode ? '● ' : '○ '}{t.jam}
          </button>
          <span style={{ fontSize: 11, letterSpacing: '0.3em', opacity: 0.5 }}>0xA1…7B</span>
          <span style={{ fontSize: 11, letterSpacing: '0.3em', opacity: 0.4 }}>{t.logout}</span>
        </div>
      </header>

      {/* Side meta */}
      <aside style={{
        position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, zIndex: 4,
      }}>
        <div style={{ width: 1, height: 60, background: pal.line }} />
        <span style={{
          writingMode: 'vertical-rl', letterSpacing: '0.6em', fontSize: 10, opacity: 0.5,
        }}>第 {['一', '二', '三', '四'][page]} 页 · {String(page * PAGE_SIZE + 1).padStart(3, '0')}—{String(Math.min((page + 1) * PAGE_SIZE, 108)).padStart(3, '0')}</span>
        <div style={{ width: 1, height: 60, background: pal.line }} />
      </aside>

      {/* Island archipelago */}
      <main style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'relative',
          width: '70%', height: '70%',
        }}>
          {pageTracks.map((trk, i) => (
            <Island
              key={trk.id}
              track={trk}
              pos={positions[i]}
              palette={palette}
              isActive={activeTrack?.id === trk.id}
              isFavorite={favoriteIds.has(trk.id)}
              onClick={() => {
                setActiveTrack(activeTrack?.id === trk.id ? null : trk);
                window.playKeyTone(String.fromCharCode(97 + (trk.week % 26)));
              }}
              onFavorite={(e) => {
                e.stopPropagation();
                setFavoriteIds((s) => new Set([...s, trk.id]));
              }}
            />
          ))}
        </div>
      </main>

      {/* Pagination */}
      <footer style={{
        position: 'absolute', bottom: 24, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, zIndex: 5,
      }}>
        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
          style={{
            background: 'transparent', border: 'none',
            color: page === 0 ? pal.fgFaint : pal.fg,
            cursor: page === 0 ? 'default' : 'pointer',
            fontSize: 11, letterSpacing: '0.3em', fontFamily: 'inherit',
          }}>← {t.prev}</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)} style={{
              width: 28, height: 28, border: 'none', background: 'transparent',
              color: i === page ? pal.fg : pal.fgFaint, cursor: 'pointer',
              fontSize: 11, letterSpacing: '0.2em', fontFamily: 'inherit',
              borderBottom: `1px solid ${i === page ? pal.fg : 'transparent'}`,
              padding: 4,
            }}>{['一', '二', '三', '四'][i]}</button>
          ))}
        </div>
        <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1}
          style={{
            background: 'transparent', border: 'none',
            color: page === totalPages - 1 ? pal.fgFaint : pal.fg,
            cursor: page === totalPages - 1 ? 'default' : 'pointer',
            fontSize: 11, letterSpacing: '0.3em', fontFamily: 'inherit',
          }}>{t.next} →</button>
      </footer>

      {/* Now playing card */}
      {activeTrack && (
        <NowPlayingCard track={activeTrack} palette={palette}
          onClose={() => setActiveTrack(null)}
          onFavorite={() => setFavoriteIds((s) => new Set([...s, activeTrack.id]))}
          isFavorite={favoriteIds.has(activeTrack.id)}
        />
      )}

      {/* Jam mode overlay (Patatap-style) */}
      {jamMode && <JamOverlay ripples={ripples} palette={palette} dropRipple={dropRipple} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function PondSurface({ palette, jamMode }) {
  // Subtle parallel wave lines across the whole bg, breathing slowly
  const pal = window.PALETTES[palette];
  const lines = 12;
  return (
    <svg style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      pointerEvents: 'none', opacity: jamMode ? 0.15 : 0.35, transition: 'opacity 0.6s',
    }} preserveAspectRatio="none" viewBox="0 0 1000 700">
      {Array.from({ length: lines }).map((_, i) => {
        const y = 50 + (i / lines) * 600;
        const amp = 8 + (i % 3) * 4;
        const phase = i * 0.7;
        const points = [];
        for (let x = 0; x <= 1000; x += 20) {
          points.push(`${x === 0 ? 'M' : 'L'} ${x} ${(y + Math.sin((x / 60) + phase) * amp).toFixed(1)}`);
        }
        return (
          <path key={i} d={points.join(' ')}
            stroke={pal.accents[i % pal.accents.length]}
            strokeWidth="0.6" fill="none" opacity={0.25 + (i % 3) * 0.15}>
            <animate attributeName="stroke-dashoffset" from="0" to="-200" dur={`${20 + i * 2}s`} repeatCount="indefinite" />
          </path>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Island({ track, pos, palette, isActive, isFavorite, onClick, onFavorite }) {
  const pal = window.PALETTES[palette];
  const color = palette === 'mono' ? pal.fg : pal.accents[track.week % pal.accents.length];
  const size = 36 + (track.seed * 24);
  return (
    <div style={{
      position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
      transform: 'translate(-50%, -50%)',
      cursor: 'pointer',
    }} onClick={onClick}>
      {/* Halos */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: size * 2.4, height: size * 2.4, borderRadius: '50%',
        border: `1px solid ${color}`, opacity: isActive ? 0.5 : 0.12,
        animation: isActive ? 'ripple-out 1.4s ease-out infinite' : 'none',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: size * 1.6, height: size * 1.6, borderRadius: '50%',
        border: `1px solid ${color}`, opacity: isActive ? 0.7 : 0.2,
      }} />
      {/* Core */}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${color}, ${color}33)`,
        boxShadow: isActive ? `0 0 ${size * 1.2}px ${color}` : `0 0 ${size * 0.6}px ${color}55`,
        transition: 'box-shadow 0.4s',
      }} />
      {/* Label */}
      <div style={{
        position: 'absolute', top: size + 8, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', whiteSpace: 'nowrap',
        fontFamily: '"Noto Serif SC", serif',
      }}>
        <div style={{ fontSize: 13, letterSpacing: '0.15em', color: pal.fg, opacity: isActive ? 1 : 0.7 }}>{track.title}</div>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: pal.fgFaint, marginTop: 2 }}>
          #{String(track.week).padStart(3, '0')}
        </div>
      </div>
      {/* Heart */}
      <button onClick={onFavorite} style={{
        position: 'absolute', top: -8, right: -8,
        width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer',
        color: isFavorite ? '#ff7a8a' : pal.fgFaint, fontSize: 14, padding: 0,
      }}>{isFavorite ? '♥' : '♡'}</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function NowPlayingCard({ track, palette, onClose, onFavorite, isFavorite }) {
  const pal = window.PALETTES[palette];
  const { t } = window.useLang();
  return (
    <div style={{
      position: 'absolute', bottom: 64, right: 32, zIndex: 10,
      width: 280, padding: 16, background: `${pal.bg}cc`,
      border: `1px solid ${pal.line}`, backdropFilter: 'blur(12px)',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      fontFamily: '"Noto Serif SC", serif',
    }}>
      <div style={{ width: 64, height: 64, flexShrink: 0 }}>
        <window.GenCover track={track} size={64} lines={6} palette={palette} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.4em', opacity: 0.4, marginBottom: 4 }}>
          {t.week} {String(track.week).padStart(3, '0')} · {t.notes} {track.noteCount}
        </div>
        <div style={{ fontSize: 16, color: pal.fg, marginBottom: 4 }}>{track.title}</div>
        <ProgressBar palette={palette} />
        <div style={{ marginTop: 10, display: 'flex', gap: 8, fontSize: 10, letterSpacing: '0.3em' }}>
          <button onClick={onFavorite} style={{
            background: 'transparent', border: `1px solid ${pal.line}`,
            color: isFavorite ? '#ff7a8a' : pal.fg,
            padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
          }}>{isFavorite ? '♥ ' + t.favorited : '♡ ' + t.favorite}</button>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${pal.line}`,
            color: pal.fgDim, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.stop}</button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ palette }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setProgress((p) => (p + 0.02) % 1), 200);
    return () => clearInterval(id);
  }, []);
  const pal = window.PALETTES[palette];
  return (
    <div style={{ height: 1, background: pal.line, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 1, width: `${progress * 100}%`, background: pal.fg }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function JamOverlay({ ripples, palette, dropRipple }) {
  const pal = window.PALETTES[palette];
  const { t } = window.useLang();
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        {ripples.map((r) => (
          <RippleVisual key={r.id} ripple={r} palette={palette} />
        ))}
      </div>
      {/* Jam HUD */}
      <div style={{
        position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.4em', color: pal.fgDim,
          marginBottom: 8,
        }}>● {t.recording}</div>
        <div style={{
          fontSize: 13, letterSpacing: '0.3em', color: pal.fg,
          fontFamily: '"Noto Serif SC", serif',
        }}>{t.pressKeyboard}</div>
      </div>
    </>
  );
}

function RippleVisual({ ripple, palette }) {
  // Three styles cycle: ring expand, lotus burst, line streak
  const style = ripple.id % 3;
  if (style === 0) {
    return (
      <div style={{
        position: 'absolute', left: `${ripple.x}%`, top: `${ripple.y}%`,
        width: 0, height: 0,
        animation: 'ripple-grow 1.6s ease-out forwards',
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 240, height: 240, borderRadius: '50%',
          border: `1.5px solid ${ripple.color}`,
          animation: 'ripple-fade 1.6s ease-out forwards',
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 360, height: 360, borderRadius: '50%',
          border: `1px solid ${ripple.color}`,
          animation: 'ripple-fade 1.6s ease-out 0.2s forwards', opacity: 0,
        }} />
      </div>
    );
  } else if (style === 1) {
    // Lotus: 8 petals
    return (
      <div style={{
        position: 'absolute', left: `${ripple.x}%`, top: `${ripple.y}%`,
        width: 0, height: 0,
      }}>
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * 360;
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-80px)`,
              width: 4, height: 80, background: ripple.color,
              borderRadius: 2, opacity: 0,
              animation: `petal-burst 1.4s ease-out forwards`,
            }} />
          );
        })}
      </div>
    );
  } else {
    // Streaks
    return (
      <div style={{
        position: 'absolute', left: `${ripple.x}%`, top: `${ripple.y}%`,
        width: 0, height: 0,
      }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const angle = (i / 5) * 360 + ripple.id * 30;
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%',
              transformOrigin: '0% 50%',
              transform: `rotate(${angle}deg)`,
              width: 0, height: 1.5, background: ripple.color,
              animation: 'streak-grow 1.4s ease-out forwards',
            }} />
          );
        })}
      </div>
    );
  }
}

window.DirectionA = DirectionA;

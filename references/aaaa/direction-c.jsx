/* global React */
const { useState, useEffect, useRef, useMemo } = React;

// ═════════════════════════════════════════════════════════════════════════════
//  DIRECTION C — SCORE STRATA
//  108 weeks visualized as horizontal wave-line ribbons stacked vertically.
//  Each row IS the cover artwork; click to hear, hover to inspect.
//  Paginated 27 per page (4 pages of strata).
// ═════════════════════════════════════════════════════════════════════════════
function DirectionC({ tracks, palette }) {
  const { t } = window.useLang();
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState(null);
  const [active, setActive] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [keyEvents, setKeyEvents] = useState([]);
  const evtId = useRef(0);

  const PAGE_SIZE = 27;
  const totalPages = Math.ceil(tracks.length / PAGE_SIZE);
  const pageTracks = tracks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  window.useJamKeys({
    enabled: true,
    onKey: (key) => {
      window.playKeyTone(key);
      const id = ++evtId.current;
      setKeyEvents((es) => [...es, { id, key, color: window.keyToColor(key, palette), x: Math.random() * 100, y: Math.random() * 100 }]);
      setTimeout(() => setKeyEvents((es) => es.filter((e) => e.id !== id)), 1400);
    },
    palette,
  });

  const pal = window.PALETTES[palette];

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: pal.bg, color: pal.fg, overflow: 'hidden',
      fontFamily: '"Noto Serif SC", "Songti SC", serif',
    }}>
      {/* Header */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '24px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        zIndex: 5, borderBottom: `1px solid ${pal.line}`, background: `${pal.bg}f0`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: '0.4em' }}>{t.productName}</span>
          <span style={{ fontSize: 9, letterSpacing: '0.4em', opacity: 0.4, fontFamily: 'sans-serif' }}>
            STRATA · 第{['一', '二', '三', '四'][page]}卷
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 10, letterSpacing: '0.4em', fontFamily: 'sans-serif' }}>
          <span style={{ opacity: 0.4 }}>群岛</span>
          <span style={{ opacity: 0.7, borderBottom: `1px solid ${pal.fg}`, paddingBottom: 2 }}>书页</span>
          <span style={{ opacity: 0.4 }}>收藏</span>
          <span style={{ opacity: 0.6, marginLeft: 16 }}>0xA1…7B</span>
        </div>
      </header>

      {/* Strata */}
      <main style={{
        position: 'absolute', top: 70, bottom: 60, left: 0, right: 0,
        overflow: 'auto', padding: '12px 40px',
      }}>
        {pageTracks.map((trk, i) => {
          const isHover = hover === i;
          const isActive = active === i;
          const isFav = favorites.has(trk.id);
          return (
            <Stratum
              key={trk.id}
              track={trk}
              palette={palette}
              isHover={isHover}
              isActive={isActive}
              isFavorite={isFav}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                setActive(active === i ? null : i);
                window.playKeyTone(String.fromCharCode(97 + (trk.week % 26)));
              }}
              onFavorite={(e) => {
                e.stopPropagation();
                setFavorites((s) => new Set([...s, trk.id]));
              }}
            />
          );
        })}
      </main>

      {/* Keyboard ripple events overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 7, overflow: 'hidden' }}>
        {keyEvents.map((e) => (
          <div key={e.id} style={{
            position: 'absolute', left: `${e.x}%`, top: `${e.y}%`,
            transform: 'translate(-50%, -50%)',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: e.color,
              animation: 'ripple-grow 1.4s ease-out forwards',
            }} />
            <span style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              fontFamily: 'monospace', fontSize: 18, color: e.color, fontWeight: 600,
              animation: 'fade-up 1.2s ease-out forwards',
            }}>{e.key.toUpperCase()}</span>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5,
        borderTop: `1px solid ${pal.line}`, background: pal.bg, fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.4em', opacity: 0.4 }}>
          {t.pressKeyboard} · A–Z
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)} style={{
              width: 36, height: 24, border: 'none', cursor: 'pointer',
              background: i === page ? pal.fg : 'transparent',
              color: i === page ? pal.bg : pal.fgDim,
              fontSize: 10, letterSpacing: '0.3em',
            }}>
              {String(i + 1).padStart(2, '0')}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, letterSpacing: '0.4em', opacity: 0.4 }}>
          {String(page * PAGE_SIZE + 1).padStart(3, '0')} — {String(Math.min((page + 1) * PAGE_SIZE, 108)).padStart(3, '0')}
        </div>
      </footer>
    </div>
  );
}

function Stratum({ track, palette, isHover, isActive, isFavorite, onMouseEnter, onMouseLeave, onClick, onFavorite }) {
  const pal = window.PALETTES[palette];
  const color = palette === 'mono' ? pal.fg : pal.accents[track.week % pal.accents.length];
  const height = isActive ? 64 : isHover ? 36 : 24;

  // wave path that fills the entire row width
  const phase = track.seed * 6.28;
  const amp = 6 + track.seed * 8;
  const points = [];
  for (let x = 0; x <= 1000; x += 16) {
    const y = 12 + Math.sin(x * 0.012 + phase) * amp;
    points.push(`${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)}`);
  }

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '4px 0', cursor: 'pointer',
        height,
        transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        borderBottom: `1px solid ${pal.line}`,
      }}>
      {/* Index */}
      <span style={{
        fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em',
        color: isActive || isHover ? color : pal.fgFaint, width: 48, flexShrink: 0,
      }}>#{String(track.week).padStart(3, '0')}</span>

      {/* Title */}
      <span style={{
        fontSize: isActive ? 22 : 14, fontWeight: 300, letterSpacing: '0.15em',
        color: pal.fg, opacity: isActive ? 1 : isHover ? 0.9 : 0.7,
        width: 130, flexShrink: 0,
        transition: 'all 0.3s',
      }}>{track.title}</span>

      {/* Wave */}
      <svg viewBox="0 0 1000 24" preserveAspectRatio="none"
        style={{ flex: 1, height: isActive ? 48 : 24, transition: 'height 0.4s' }}>
        <path d={points.join(' ')}
          stroke={color}
          strokeWidth={isActive ? 2 : 1}
          opacity={isActive ? 1 : isHover ? 0.7 : 0.45}
          fill="none" strokeLinecap="round" />
        {isActive && (
          <path d={points.join(' ')}
            stroke={color} strokeWidth="0.5" opacity="0.4" fill="none"
            transform="translate(0, 4)" />
        )}
      </svg>

      {/* Meta */}
      <span style={{
        fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em',
        color: pal.fgFaint, width: 90, flexShrink: 0, textAlign: 'right',
      }}>{track.noteCount} 音符</span>

      {/* Heart */}
      <button onClick={onFavorite} style={{
        width: 28, height: 28, border: 'none', background: 'transparent',
        cursor: 'pointer', flexShrink: 0,
        color: isFavorite ? '#ff7a8a' : pal.fgFaint, fontSize: 16,
      }}>{isFavorite ? '♥' : '♡'}</button>
    </div>
  );
}

window.DirectionC = DirectionC;

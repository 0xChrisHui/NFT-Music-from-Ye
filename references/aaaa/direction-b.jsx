/* global React */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ═════════════════════════════════════════════════════════════════════════════
//  DIRECTION B — CONSTELLATION
//  108 islands as nodes in a force-directed graph. Lines connect adjacent weeks.
//  Drag from one node to another to "jam" them (play in sequence).
// ═════════════════════════════════════════════════════════════════════════════
function DirectionB({ tracks, palette }) {
  const { t } = window.useLang();
  const [page, setPage] = useState(0);
  const [hoverNode, setHoverNode] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [keyEvents, setKeyEvents] = useState([]);
  const evtId = useRef(0);
  const svgRef = useRef(null);

  const PAGE_SIZE = 27;
  const totalPages = Math.ceil(tracks.length / PAGE_SIZE);
  const pageTracks = tracks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stable pseudo-random positions seeded by week
  const nodes = useMemo(() => {
    return pageTracks.map((trk, i) => {
      const a = (trk.seed * 9301 + i * 137) % 1;
      const b = (trk.seed * 49297 + i * 211) % 1;
      return {
        ...trk,
        x: 100 + (a * 800),
        y: 80 + (b * 540),
      };
    });
  }, [pageTracks]);

  // Connections: adjacent weeks + a couple "ripple lineage" links
  const edges = useMemo(() => {
    const out = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      out.push([i, i + 1, 'sequence']);
    }
    for (let i = 0; i < nodes.length; i += 7) {
      const j = (i + 4) % nodes.length;
      if (i !== j) out.push([i, j, 'echo']);
    }
    return out;
  }, [nodes]);

  window.useJamKeys({
    enabled: true,
    onKey: (key) => {
      window.playKeyTone(key);
      const id = ++evtId.current;
      const color = window.keyToColor(key, palette);
      setKeyEvents((es) => [...es, { id, key, color, x: 50 + Math.random() * 900, y: 50 + Math.random() * 600 }]);
      setTimeout(() => setKeyEvents((es) => es.filter((e) => e.id !== id)), 1500);
    },
    palette,
  });

  const pal = window.PALETTES[palette];

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: palette === 'mono' ? '#000' : pal.bg,
      color: pal.fg, overflow: 'hidden',
      fontFamily: '"Inter", "Helvetica Neue", -apple-system, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '24px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 5, mixBlendMode: palette === 'mono' ? 'normal' : 'screen',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.5em', opacity: 0.5 }}>RIPPLES / 涟漪</span>
          <span style={{ fontSize: 9, letterSpacing: '0.4em', opacity: 0.3 }}>v.0.108 — CONSTELLATION</span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 10, letterSpacing: '0.4em' }}>
          <span style={{ opacity: 0.7 }}>群岛</span>
          <span style={{ opacity: 0.3 }}>合奏</span>
          <span style={{ opacity: 0.3 }}>收藏</span>
          <span style={{ opacity: 0.5, marginLeft: 24, padding: '2px 10px', border: `1px solid ${pal.line}` }}>0xA1…7B</span>
        </div>
      </header>

      {/* Section title - vertical */}
      <div style={{
        position: 'absolute', top: 80, left: 24, zIndex: 4,
      }}>
        <div style={{
          fontSize: 64, fontWeight: 200, letterSpacing: '-0.02em',
          fontFamily: '"Noto Serif SC", serif', lineHeight: 1, opacity: 0.95,
        }}>第{['一', '二', '三', '四'][page]}群</div>
        <div style={{ fontSize: 10, letterSpacing: '0.4em', opacity: 0.4, marginTop: 8 }}>
          ARCHIPELAGO {page + 1}/{totalPages}
        </div>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', opacity: 0.3, marginTop: 4 }}>
          {String(page * PAGE_SIZE + 1).padStart(3, '0')} → {String(Math.min((page + 1) * PAGE_SIZE, 108)).padStart(3, '0')}
        </div>
      </div>

      {/* Right meta */}
      <aside style={{
        position: 'absolute', top: 80, right: 32, zIndex: 4,
        textAlign: 'right',
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.4em', opacity: 0.5, marginBottom: 6 }}>{t.archipelago}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
          <span><span style={{ opacity: 0.4 }}>共</span> 108 <span style={{ opacity: 0.4 }}>首</span></span>
          <span><span style={{ opacity: 0.4 }}>已收藏</span> {favorites.size}</span>
          <span><span style={{ opacity: 0.4 }}>本页</span> {pageTracks.length}</span>
        </div>
      </aside>

      {/* The graph */}
      <svg ref={svgRef}
        viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2 }}>
        {/* Edges */}
        {edges.map(([a, b, kind], idx) => {
          const A = nodes[a], B = nodes[b];
          const dim = !hoverNode || hoverNode === a || hoverNode === b ? 1 : 0.2;
          return (
            <line key={idx}
              x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke={pal.fg}
              strokeWidth={kind === 'sequence' ? 0.4 : 0.25}
              strokeDasharray={kind === 'echo' ? '2 4' : 'none'}
              opacity={(kind === 'sequence' ? 0.25 : 0.12) * dim}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const isHover = hoverNode === i;
          const isActive = activeNode === i;
          const isFav = favorites.has(n.id);
          const r = isActive ? 14 : isHover ? 11 : 6 + n.seed * 5;
          const color = palette === 'mono' ? pal.fg : pal.accents[n.week % pal.accents.length];
          return (
            <g key={n.id}
              onMouseEnter={() => setHoverNode(i)}
              onMouseLeave={() => setHoverNode(null)}
              onClick={() => {
                setActiveNode(i);
                window.playKeyTone(String.fromCharCode(97 + (n.week % 26)));
              }}
              style={{ cursor: 'pointer' }}>
              {isActive && (
                <>
                  <circle cx={n.x} cy={n.y} r={r * 3} fill="none" stroke={color} strokeWidth="0.5" opacity="0.4">
                    <animate attributeName="r" from={r} to={r * 4} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={n.x} cy={n.y} r={r * 2} fill="none" stroke={color} strokeWidth="0.4" opacity="0.5" />
                </>
              )}
              <circle cx={n.x} cy={n.y} r={r}
                fill={color} opacity={isActive || isHover ? 1 : 0.85}
                style={{ transition: 'r 0.3s' }} />
              {(isHover || isActive) && (
                <g>
                  <text x={n.x} y={n.y - r - 10}
                    fill={pal.fg} fontSize="11" textAnchor="middle"
                    style={{ fontFamily: '"Noto Serif SC", serif', letterSpacing: '0.1em' }}>{n.title}</text>
                  <text x={n.x} y={n.y + r + 14}
                    fill={pal.fgDim} fontSize="8" textAnchor="middle"
                    style={{ letterSpacing: '0.3em' }}>#{String(n.week).padStart(3, '0')}</text>
                </g>
              )}
              {isFav && (
                <text x={n.x + r + 4} y={n.y - r - 2} fill="#ff7a8a" fontSize="10">♥</text>
              )}
            </g>
          );
        })}

        {/* Keyboard ripples in graph space */}
        {keyEvents.map((e) => (
          <g key={e.id}>
            <circle cx={e.x} cy={e.y} r="2" fill={e.color}>
              <animate attributeName="r" from="2" to="80" dur="1.5s" />
              <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" />
            </circle>
            <text x={e.x} y={e.y + 4} textAnchor="middle" fill={e.color} fontSize="14" fontWeight="600"
              style={{ fontFamily: 'monospace' }}>
              {e.key.toUpperCase()}
              <animate attributeName="opacity" from="1" to="0" dur="1s" />
            </text>
          </g>
        ))}
      </svg>

      {/* Active node detail panel */}
      {activeNode != null && nodes[activeNode] && (
        <NodeDetail node={nodes[activeNode]} palette={palette}
          onClose={() => setActiveNode(null)}
          onFavorite={() => setFavorites((s) => new Set([...s, nodes[activeNode].id]))}
          isFavorite={favorites.has(nodes[activeNode].id)} />
      )}

      {/* Pagination + jam hint */}
      <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5,
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.4em', opacity: 0.4 }}>
          {t.pressKeyboard} · A–Z
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button onClick={() => setPage(Math.max(0, page - 1))} style={{
            background: 'none', border: 'none', color: pal.fg, cursor: 'pointer',
            fontSize: 11, letterSpacing: '0.3em', opacity: page === 0 ? 0.2 : 0.7,
          }}>←</button>
          <span style={{ fontSize: 11, letterSpacing: '0.3em', opacity: 0.5 }}>
            {String(page + 1).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
          </span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} style={{
            background: 'none', border: 'none', color: pal.fg, cursor: 'pointer',
            fontSize: 11, letterSpacing: '0.3em', opacity: page === totalPages - 1 ? 0.2 : 0.7,
          }}>→</button>
        </div>
      </footer>
    </div>
  );
}

function NodeDetail({ node, palette, onClose, onFavorite, isFavorite }) {
  const pal = window.PALETTES[palette];
  const { t } = window.useLang();
  return (
    <div style={{
      position: 'absolute', left: 32, bottom: 60, zIndex: 8,
      width: 360, padding: 20, background: `${pal.bg}e0`,
      border: `1px solid ${pal.line}`, backdropFilter: 'blur(8px)',
      display: 'flex', gap: 16,
    }}>
      <div style={{ width: 96, height: 96, flexShrink: 0 }}>
        <window.GenCover track={node} size={96} lines={6} palette={palette} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.5em', opacity: 0.4 }}>
          WEEK {String(node.week).padStart(3, '0')}
        </div>
        <div style={{ fontSize: 22, marginTop: 4, marginBottom: 6,
          fontFamily: '"Noto Serif SC", serif' }}>{node.title}</div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', opacity: 0.5, marginBottom: 12 }}>
          {node.duration}s · {node.noteCount} {t.notes}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onFavorite} style={{
            background: 'transparent',
            border: `1px solid ${isFavorite ? '#ff7a8a' : pal.fg}`,
            color: isFavorite ? '#ff7a8a' : pal.fg,
            padding: '6px 14px', fontSize: 10, letterSpacing: '0.3em',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{isFavorite ? '♥ ' + t.favorited : '♡ ' + t.favorite}</button>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${pal.line}`,
            color: pal.fgDim, padding: '6px 14px',
            fontSize: 10, letterSpacing: '0.3em', cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.stop}</button>
        </div>
      </div>
    </div>
  );
}

window.DirectionB = DirectionB;

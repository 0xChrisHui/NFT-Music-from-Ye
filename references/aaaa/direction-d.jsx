/* global React */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ═════════════════════════════════════════════════════════════════════════════
//  DIRECTION D — KEYBOARD JAM (Patatap moment, full-bleed)
//  When jam mode is on, this is what the user sees: a clean black field
//  responsive only to keystrokes. Each letter triggers a unique large-format
//  visual + tone. The recorded ripples build into a "score" at the bottom.
// ═════════════════════════════════════════════════════════════════════════════
function DirectionD({ palette }) {
  const { t } = window.useLang();
  const [events, setEvents] = useState([]);
  const [recordedKeys, setRecordedKeys] = useState([]);
  const [recording, setRecording] = useState(true);
  const [showMint, setShowMint] = useState(false);
  const evtId = useRef(0);
  const startTime = useRef(Date.now());

  window.useJamKeys({
    enabled: true,
    onKey: (key) => {
      window.playKeyTone(key);
      const id = ++evtId.current;
      const t = Date.now() - startTime.current;
      const x = 8 + Math.random() * 84;
      const y = 12 + Math.random() * 72;
      const color = window.keyToColor(key, palette);
      const motif = key.charCodeAt(0) % 5;
      setEvents((es) => [...es, { id, key, color, x, y, motif, born: Date.now() }]);
      setTimeout(() => setEvents((es) => es.filter((e) => e.id !== id)), 2400);
      if (recording) setRecordedKeys((rk) => [...rk, { key, color, t }]);
    },
    palette,
  });

  const pal = window.PALETTES[palette];

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: palette === 'mono' ? '#000' : pal.bg,
      color: pal.fg, overflow: 'hidden',
      fontFamily: '"Inter", -apple-system, sans-serif',
    }}>
      {/* Top chrome */}
      <div style={{
        position: 'absolute', top: 24, left: 32, right: 32, zIndex: 10,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.5em', opacity: 0.5 }}>JAM MODE</div>
          <div style={{ fontSize: 14, letterSpacing: '0.3em', opacity: 0.85, marginTop: 4,
            fontFamily: '"Noto Serif SC", serif' }}>{t.pressKeyboard}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{
            fontSize: 10, letterSpacing: '0.4em',
            color: recording ? '#ff5f6d' : pal.fgDim,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: recording ? '#ff5f6d' : pal.fgDim,
              animation: recording ? 'blink 1s infinite' : 'none',
            }} />
            {recording ? t.recording : 'PAUSED'}
          </span>
          <span style={{ fontSize: 10, letterSpacing: '0.3em', opacity: 0.4 }}>
            {recordedKeys.length} {t.notes}
          </span>
        </div>
      </div>

      {/* Visual events */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden' }}>
        {events.map((e) => <PatatapEvent key={e.id} event={e} />)}
      </div>

      {/* Center prompt when no events yet */}
      {events.length === 0 && recordedKeys.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 24, pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', gap: 4, opacity: 0.3 }}>
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => (
              <span key={c} style={{
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.1em',
              }}>{c}</span>
            ))}
          </div>
          <div style={{
            fontSize: 64, fontWeight: 200, letterSpacing: '0.05em',
            fontFamily: '"Noto Serif SC", serif', opacity: 0.4,
          }}>合奏</div>
          <div style={{ fontSize: 11, letterSpacing: '0.4em', opacity: 0.3 }}>
            JAM WITH THE ARTIST
          </div>
        </div>
      )}

      {/* Score timeline */}
      {recordedKeys.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 80, left: 32, right: 32, zIndex: 10,
        }}>
          <div style={{ fontSize: 9, letterSpacing: '0.4em', opacity: 0.4, marginBottom: 8 }}>
            YOUR SCORE / 你的乐谱 · #{Math.floor(Math.random() * 9000) + 1000}
          </div>
          <div style={{
            height: 48, background: `${pal.fg}08`, border: `1px solid ${pal.line}`,
            position: 'relative', overflow: 'hidden',
          }}>
            {recordedKeys.map((k, i) => {
              const totalT = recordedKeys[recordedKeys.length - 1].t || 1;
              const x = totalT > 0 ? (k.t / totalT) * 100 : i * 2;
              return (
                <div key={i} style={{
                  position: 'absolute', left: `${x}%`, top: 4, bottom: 4,
                  width: 3, background: k.color, opacity: 0.85, borderRadius: 1.5,
                }} />
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div style={{
        position: 'absolute', bottom: 24, left: 32, right: 32, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { setRecording(!recording); }} style={btnStyle(pal)}>
            {recording ? '■ 停止' : '● 录制'}
          </button>
          <button onClick={() => { setRecordedKeys([]); setEvents([]); startTime.current = Date.now(); }}
            style={btnStyle(pal)}>↺ 重来</button>
        </div>
        <button onClick={() => setShowMint(true)}
          disabled={recordedKeys.length === 0}
          style={{
            ...btnStyle(pal),
            background: recordedKeys.length === 0 ? 'transparent' : pal.fg,
            color: recordedKeys.length === 0 ? pal.fgFaint : pal.bg,
            border: `1px solid ${recordedKeys.length === 0 ? pal.line : pal.fg}`,
          }}>
          铸造成乐谱 NFT →
        </button>
      </div>

      {showMint && <MintFlow onClose={() => setShowMint(false)} palette={palette} keys={recordedKeys} />}
    </div>
  );
}

function btnStyle(pal) {
  return {
    background: 'transparent', border: `1px solid ${pal.line}`,
    color: pal.fg, padding: '8px 16px', fontSize: 11, letterSpacing: '0.3em',
    cursor: 'pointer', fontFamily: 'inherit',
  };
}

function PatatapEvent({ event }) {
  const { x, y, color, motif, key } = event;
  if (motif === 0) {
    // Concentric rings
    return (
      <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%` }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 0, height: 0, borderRadius: '50%',
            border: `${2 - i * 0.5}px solid ${color}`,
            animation: `ring-${i} 1.8s cubic-bezier(0.2, 0.6, 0.2, 1) forwards`,
          }} />
        ))}
      </div>
    );
  }
  if (motif === 1) {
    // Vertical bar
    return (
      <div style={{
        position: 'absolute', left: `${x}%`, top: 0, bottom: 0,
        width: 4, background: color, transform: 'translateX(-50%)',
        animation: 'bar-shoot 1.2s ease-out forwards', transformOrigin: 'top',
      }} />
    );
  }
  if (motif === 2) {
    // Petal burst
    return (
      <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%` }}>
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * 360;
          return (
            <div key={i} style={{
              position: 'absolute', left: 0, top: 0,
              transform: `rotate(${angle}deg) translateY(0)`,
              transformOrigin: '0 0',
              animation: `petal-burst 1.6s ease-out forwards`,
              width: 6, height: 80, background: color,
              borderRadius: 3, opacity: 0,
            }} />
          );
        })}
      </div>
    );
  }
  if (motif === 3) {
    // Big floating letter
    return (
      <div style={{
        position: 'absolute', left: `${x}%`, top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: 280, color, fontFamily: '"Noto Serif SC", serif', fontWeight: 200,
        animation: 'letter-fade 1.8s ease-out forwards',
        textShadow: `0 0 60px ${color}`,
      }}>{key.toUpperCase()}</div>
    );
  }
  // motif 4 — squiggle wave
  return (
    <svg style={{
      position: 'absolute', left: `${x - 20}%`, top: `${y}%`, width: '40%', height: 80,
      animation: 'squiggle-fade 1.6s ease-out forwards',
    }} viewBox="0 0 400 80" preserveAspectRatio="none">
      <path d="M 0 40 Q 50 0, 100 40 T 200 40 T 300 40 T 400 40"
        stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MINT FLOW
// ═════════════════════════════════════════════════════════════════════════════
function MintFlow({ onClose, palette, keys }) {
  const pal = window.PALETTES[palette];
  const [stage, setStage] = useState('preview'); // preview → minting → done
  useEffect(() => {
    if (stage === 'minting') {
      const t = setTimeout(() => setStage('done'), 2600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const tokenId = useMemo(() => Math.floor(Math.random() * 9000) + 1000, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 420, padding: 32, background: pal.bg,
        border: `1px solid ${pal.line}`,
        fontFamily: '"Noto Serif SC", serif', textAlign: 'center',
      }}>
        {stage === 'preview' && (
          <>
            <div style={{ fontSize: 9, letterSpacing: '0.5em', opacity: 0.4, marginBottom: 12, fontFamily: 'sans-serif' }}>
              PREVIEW · 预览
            </div>
            <div style={{ width: 280, height: 280, margin: '0 auto 20px', position: 'relative' }}>
              <window.GenCover track={{ week: tokenId, seed: (tokenId * 0.001) % 1, hue: (tokenId * 7) % 360 }}
                size={280} lines={8} palette={palette} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 300, marginBottom: 6 }}>Ripples #{tokenId}</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 24, fontFamily: 'sans-serif', letterSpacing: '0.2em' }}>
              {keys.length} 音符 · 不可复制 · 永久上链
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', fontFamily: 'sans-serif' }}>
              <button onClick={onClose} style={btnStyle(pal)}>取消</button>
              <button onClick={() => setStage('minting')}
                style={{ ...btnStyle(pal), background: pal.fg, color: pal.bg, border: `1px solid ${pal.fg}` }}>
                铸造 0.001 ETH
              </button>
            </div>
          </>
        )}
        {stage === 'minting' && (
          <>
            <div style={{ width: 80, height: 80, margin: '40px auto', position: 'relative' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 80, height: 80, borderRadius: '50%',
                  border: `1px solid ${pal.fg}`,
                  animation: `mint-pulse 2s ease-out infinite ${i * 0.6}s`,
                }} />
              ))}
            </div>
            <div style={{ fontSize: 18, fontWeight: 300 }}>正在写入区块链…</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8, letterSpacing: '0.3em', fontFamily: 'sans-serif' }}>
              MINTING ON OP
            </div>
          </>
        )}
        {stage === 'done' && (
          <>
            <div style={{ width: 200, height: 200, margin: '20px auto' }}>
              <window.GenCover track={{ week: tokenId, seed: (tokenId * 0.001) % 1, hue: (tokenId * 7) % 360 }}
                size={200} lines={8} palette={palette} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 300, marginBottom: 6 }}>已上链</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 20, fontFamily: 'monospace' }}>
              0x7a3c…a2f9
            </div>
            <button onClick={onClose} style={{ ...btnStyle(pal), background: pal.fg, color: pal.bg, fontFamily: 'sans-serif' }}>
              查看收藏 →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

window.DirectionD = DirectionD;
window.MintFlow = MintFlow;

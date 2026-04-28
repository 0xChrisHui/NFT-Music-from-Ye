/* global React */
const { useState, useEffect, useRef, useMemo } = React;

// ═════════════════════════════════════════════════════════════════════════════
//  /ME — MY COLLECTION (avant-garde, austere)
// ═════════════════════════════════════════════════════════════════════════════
function MePage({ tracks, palette }) {
  const { t } = window.useLang();
  const pal = window.PALETTES[palette];

  // Pretend the user owns these
  const owned = useMemo(() => tracks.filter((_, i) => [2, 7, 14, 22, 35].includes(i)), [tracks]);
  const scores = useMemo(() => [
    { tokenId: 1287, trackTitle: '潮汐', noteCount: 47, mintedAt: '2026.04.12', track: tracks[2] },
    { tokenId: 2104, trackTitle: '深渊', noteCount: 92, mintedAt: '2026.04.18', track: tracks[7] },
  ], [tracks]);
  const drafts = useMemo(() => [
    { id: 'd1', title: '创作 #03', noteCount: 31, expiresIn: '21h 4m', track: tracks[14] },
    { id: 'd2', title: '创作 #04', noteCount: 58, expiresIn: '8h 12m', track: tracks[22], urgent: true },
  ], [tracks]);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: pal.bg, color: pal.fg, overflow: 'auto',
      fontFamily: '"Noto Serif SC", serif',
    }}>
      <header style={{
        padding: '32px 40px 24px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', borderBottom: `1px solid ${pal.line}`,
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.5em', opacity: 0.4, fontFamily: 'sans-serif' }}>
            COLLECTION · 0xA1…7B
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 300, letterSpacing: '0.2em' }}>
            我的收藏
          </h1>
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.4em', opacity: 0.5, fontFamily: 'sans-serif' }}>
          ← 返回池塘
        </div>
      </header>

      {/* Stats strip */}
      <div style={{
        padding: '20px 40px', display: 'flex', gap: 60,
        borderBottom: `1px solid ${pal.line}`,
        fontFamily: 'sans-serif',
      }}>
        {[
          ['素材', owned.length, 'MATERIALS'],
          ['乐谱', scores.length, 'SCORES'],
          ['草稿', drafts.length, 'DRAFTS'],
          ['总数', owned.length + scores.length, 'TOTAL'],
        ].map(([zh, n, en]) => (
          <div key={zh}>
            <div style={{ fontSize: 32, fontWeight: 200 }}>{n}</div>
            <div style={{ fontSize: 9, letterSpacing: '0.4em', opacity: 0.4, marginTop: 2 }}>
              {zh} / {en}
            </div>
          </div>
        ))}
      </div>

      {/* Scores grid */}
      <Section title="我的乐谱" subtitle="MY SCORES" palette={palette}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {scores.map((s) => (
            <ScoreCard key={s.tokenId} score={s} palette={palette} />
          ))}
        </div>
      </Section>

      {/* Materials list */}
      <Section title="素材收藏" subtitle="MATERIALS" palette={palette}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {owned.map((trk) => (
            <MaterialRow key={trk.id} track={trk} palette={palette} />
          ))}
        </div>
      </Section>

      {/* Drafts */}
      <Section title="我的创作" subtitle="DRAFTS" palette={palette}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drafts.map((d) => (
            <DraftRow key={d.id} draft={d} palette={palette} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, palette, children }) {
  const pal = window.PALETTES[palette];
  return (
    <section style={{ padding: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 300, letterSpacing: '0.2em' }}>{title}</h2>
        <span style={{ fontSize: 9, letterSpacing: '0.4em', opacity: 0.4, fontFamily: 'sans-serif' }}>{subtitle}</span>
        <span style={{ flex: 1, height: 1, background: pal.line }} />
      </div>
      {children}
    </section>
  );
}

function ScoreCard({ score, palette }) {
  const pal = window.PALETTES[palette];
  return (
    <div style={{
      border: `1px solid ${pal.line}`, padding: 16,
      transition: 'border-color 0.3s', cursor: 'pointer',
    }}>
      <div style={{ width: '100%', aspectRatio: '1', marginBottom: 12 }}>
        <window.GenCover track={score.track} size={300} lines={7} palette={palette} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: '0.15em' }}>Ripples #{score.tokenId}</div>
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, letterSpacing: '0.2em', fontFamily: 'sans-serif' }}>
            {score.trackTitle} · {score.noteCount} 音符
          </div>
        </div>
        <div style={{ fontSize: 9, opacity: 0.3, letterSpacing: '0.3em', fontFamily: 'monospace' }}>
          {score.mintedAt}
        </div>
      </div>
    </div>
  );
}

function MaterialRow({ track, palette }) {
  const pal = window.PALETTES[palette];
  const color = palette === 'mono' ? pal.fg : pal.accents[track.week % pal.accents.length];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20, padding: '14px 0',
      borderBottom: `1px solid ${pal.line}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${color}, ${color}33)`,
        boxShadow: `0 0 16px ${color}55`, flexShrink: 0,
      }} />
      <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.5, letterSpacing: '0.3em', width: 60 }}>
        #{String(track.week).padStart(3, '0')}
      </span>
      <span style={{ fontSize: 16, fontWeight: 300, letterSpacing: '0.15em', flex: 1 }}>{track.title}</span>
      <span style={{ fontSize: 10, opacity: 0.4, letterSpacing: '0.3em', fontFamily: 'sans-serif' }}>
        2026.0{(track.week % 9) + 1}.{String(track.week * 3 % 28 + 1).padStart(2, '0')}
      </span>
      <span style={{ fontSize: 10, opacity: 0.3, fontFamily: 'monospace' }}>0x{(track.seed * 1e16).toString(16).slice(0, 6)}…</span>
    </div>
  );
}

function DraftRow({ draft, palette }) {
  const pal = window.PALETTES[palette];
  return (
    <div style={{
      border: `1px solid ${pal.line}`, padding: '16px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'sans-serif',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 300, letterSpacing: '0.15em',
          fontFamily: '"Noto Serif SC", serif' }}>{draft.title}</div>
        <div style={{ fontSize: 10, letterSpacing: '0.3em', opacity: 0.4, marginTop: 4 }}>
          {draft.noteCount} 音符 · 剩余 <span style={{ color: draft.urgent ? '#f5b06b' : 'inherit' }}>{draft.expiresIn}</span>
        </div>
      </div>
      <button style={{
        background: 'transparent', border: `1px solid #ff5f6d80`, color: '#ff8a96',
        padding: '8px 16px', fontSize: 10, letterSpacing: '0.3em', cursor: 'pointer',
      }}>
        铸造成乐谱 →
      </button>
    </div>
  );
}

window.MePage = MePage;

// ═════════════════════════════════════════════════════════════════════════════
//  /SCORE/[tokenId] — single score detail + replay
// ═════════════════════════════════════════════════════════════════════════════
function ScoreDetail({ tracks, palette }) {
  const pal = window.PALETTES[palette];
  const track = tracks[2]; // 潮汐
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Fake notes
  const notes = useMemo(() => Array.from({ length: 47 }, (_, i) => ({
    key: 'abcdefghijklmnopqrstuvwxyz'[i % 26],
    t: i / 47,
    color: window.keyToColor('abcdefghijklmnopqrstuvwxyz'[i % 26], palette),
  })), [palette]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress((p) => {
      if (p >= 1) { setPlaying(false); return 1; }
      return p + 0.005;
    }), 50);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: pal.bg, color: pal.fg, overflow: 'hidden',
      fontFamily: '"Noto Serif SC", serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ padding: '24px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${pal.line}` }}>
        <span style={{ fontSize: 11, letterSpacing: '0.4em', opacity: 0.5, fontFamily: 'sans-serif' }}>
          ← 我的收藏
        </span>
        <span style={{ fontSize: 11, letterSpacing: '0.4em', opacity: 0.5, fontFamily: 'sans-serif' }}>
          分享 · SHARE
        </span>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* Cover side */}
        <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: palette === 'mono' ? '#050505' : pal.bgSoft, borderRight: `1px solid ${pal.line}` }}>
          <div style={{ width: '90%', aspectRatio: '1', maxWidth: 480, position: 'relative' }}>
            <window.GenCover track={track} size={480} lines={8} palette={palette} />
            {playing && (
              <div style={{
                position: 'absolute', inset: 0, border: `1px solid ${pal.fg}`,
                animation: 'breathe 2s ease-in-out infinite',
              }} />
            )}
          </div>
        </div>

        {/* Info side */}
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 24, overflow: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.5em', opacity: 0.4, fontFamily: 'sans-serif' }}>
              SCORE NFT · 乐谱
            </div>
            <h1 style={{ margin: '8px 0 4px', fontSize: 48, fontWeight: 200, letterSpacing: '0.05em' }}>
              Ripples #1287
            </h1>
            <div style={{ fontSize: 16, opacity: 0.6, letterSpacing: '0.2em' }}>{track.title}</div>
          </div>

          <Stat label="WEEK / 周次" value={`#${String(track.week).padStart(3, '0')}`} pal={pal} />
          <Stat label="NOTES / 音符" value="47" pal={pal} />
          <Stat label="DURATION / 时长" value="1:23" pal={pal} />
          <Stat label="MINTED / 铸造时间" value="2026.04.12 · 03:47" pal={pal} />
          <Stat label="OWNER / 拥有者" value="0xA1F2…cD7B" pal={pal} mono />
          <Stat label="TX / 交易" value="0x7a3c…a2f9" pal={pal} mono />

          {/* Notes timeline */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.5em', opacity: 0.4, marginBottom: 8, fontFamily: 'sans-serif' }}>
              SCORE / 乐谱回放
            </div>
            <div style={{ height: 80, position: 'relative', border: `1px solid ${pal.line}`, padding: 6 }}>
              {notes.map((n, i) => (
                <div key={i} style={{
                  position: 'absolute', left: `${4 + n.t * 92}%`, top: 6, bottom: 6,
                  width: 3, background: n.color,
                  opacity: progress >= n.t ? 1 : 0.25,
                  transition: 'opacity 0.3s', borderRadius: 1.5,
                }} />
              ))}
              <div style={{
                position: 'absolute', left: `${4 + progress * 92}%`, top: 0, bottom: 0,
                width: 1, background: pal.fg, opacity: 0.6,
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { setPlaying(!playing); if (!playing && progress >= 1) setProgress(0); }}
              style={{
                background: pal.fg, color: pal.bg, border: `1px solid ${pal.fg}`,
                padding: '12px 24px', fontSize: 11, letterSpacing: '0.4em', cursor: 'pointer',
                fontFamily: 'sans-serif',
              }}>
              {playing ? '■ 停止回放' : '▶ 播放回放'}
            </button>
            <button style={{
              background: 'transparent', border: `1px solid ${pal.line}`, color: pal.fg,
              padding: '12px 20px', fontSize: 11, letterSpacing: '0.4em', cursor: 'pointer',
              fontFamily: 'sans-serif',
            }}>
              下载封面
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, pal, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      borderBottom: `1px solid ${pal.line}`, padding: '8px 0' }}>
      <span style={{ fontSize: 9, letterSpacing: '0.5em', opacity: 0.4, fontFamily: 'sans-serif' }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', letterSpacing: '0.1em' }}>{value}</span>
    </div>
  );
}

window.ScoreDetail = ScoreDetail;

// ═════════════════════════════════════════════════════════════════════════════
//  ONBOARDING
// ═════════════════════════════════════════════════════════════════════════════
function Onboarding({ palette }) {
  const pal = window.PALETTES[palette];
  const { t } = window.useLang();
  const [step, setStep] = useState(0);
  const [ripples, setRipples] = useState([]);

  // ambient ripples
  useEffect(() => {
    const id = setInterval(() => {
      const r = { id: Date.now(), x: Math.random() * 100, y: Math.random() * 100, color: pal.accents[Math.floor(Math.random() * pal.accents.length)] };
      setRipples((rs) => [...rs.slice(-3), r]);
      setTimeout(() => setRipples((rs) => rs.filter((rr) => rr.id !== r.id)), 4000);
    }, 1400);
    return () => clearInterval(id);
  }, [palette]);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: pal.bg, color: pal.fg, overflow: 'hidden',
      fontFamily: '"Noto Serif SC", serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Ambient ripples */}
      {ripples.map((r) => (
        <div key={r.id} style={{
          position: 'absolute', left: `${r.x}%`, top: `${r.y}%`,
          transform: 'translate(-50%, -50%)',
          width: 120, height: 120, borderRadius: '50%',
          border: `1px solid ${r.color}`, opacity: 0,
          animation: 'breathe-out 4s ease-out forwards',
        }} />
      ))}

      {/* Skip */}
      <button style={{
        position: 'absolute', top: 24, right: 32,
        background: 'transparent', border: 'none', color: pal.fgDim,
        fontSize: 11, letterSpacing: '0.4em', cursor: 'pointer', fontFamily: 'sans-serif',
      }}>{t.skip} →</button>

      <div style={{ textAlign: 'center', maxWidth: 600, padding: 40, zIndex: 5 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.6em', opacity: 0.4, marginBottom: 24, fontFamily: 'sans-serif' }}>
          0{step + 1} / 0{t.onboardingTitles.length}
        </div>
        <h1 style={{
          margin: '0 0 24px', fontSize: 56, fontWeight: 200, letterSpacing: '0.1em',
          lineHeight: 1.2,
        }}>{t.onboardingTitles[step]}</h1>
        <p style={{
          fontSize: 16, lineHeight: 1.8, opacity: 0.65,
          letterSpacing: '0.1em', maxWidth: 480, margin: '0 auto',
        }}>
          {t.onboardingBodies[step]}
        </p>

        <div style={{ marginTop: 48, display: 'flex', gap: 8, justifyContent: 'center' }}>
          {t.onboardingTitles.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} style={{
              width: i === step ? 32 : 12, height: 2,
              background: i === step ? pal.fg : pal.line,
              border: 'none', cursor: 'pointer', transition: 'all 0.3s',
            }} />
          ))}
        </div>

        <button
          onClick={() => setStep((s) => Math.min(t.onboardingTitles.length - 1, s + 1))}
          style={{
            marginTop: 32,
            background: step === t.onboardingTitles.length - 1 ? pal.fg : 'transparent',
            color: step === t.onboardingTitles.length - 1 ? pal.bg : pal.fg,
            border: `1px solid ${pal.fg}`,
            padding: '14px 32px', fontSize: 11, letterSpacing: '0.5em',
            cursor: 'pointer', fontFamily: 'sans-serif',
          }}>
          {step === t.onboardingTitles.length - 1 ? t.onboardingCta + ' →' : '继续 →'}
        </button>
      </div>
    </div>
  );
}

window.Onboarding = Onboarding;

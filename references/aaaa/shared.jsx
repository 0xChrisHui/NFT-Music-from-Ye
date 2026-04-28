/* global React */
const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;

// ─────────────────────────────────────────────────────────────────────────────
// COPY (zh primary, en secondary — toggleable via Tweaks)
// ─────────────────────────────────────────────────────────────────────────────
const COPY = {
  zh: {
    productName: '池中涟漪',
    productNameEn: 'Ripples in the Pond',
    tagline: '一位艺术家用两年时间，将 108 首音乐刻进区块链',
    subtagline: '与艺术家合奏，将你的涟漪永久收藏',
    play: '聆听',
    stop: '停止',
    favorite: '收藏',
    favorited: '已收藏',
    mint: '铸造',
    minting: '铸造中',
    minted: '已上链',
    archipelago: '群岛',
    jam: '合奏',
    myCollection: '我的收藏',
    myScores: '我的乐谱',
    myMaterials: '素材收藏',
    myDrafts: '我的创作',
    login: '登录',
    logout: '登出',
    home: '首页',
    pressKeyboard: '按下键盘 A–Z 演奏',
    recording: '录制中',
    week: '周',
    notes: '音符',
    replay: '回放',
    share: '分享',
    drafts: '草稿',
    expiresIn: '剩余',
    mintScore: '铸造成乐谱 NFT',
    expired: '已过期',
    next: '下一页',
    prev: '上一页',
    of: '/',
    onboardingTitles: ['这是一片池塘', '每一座岛是一首音乐', '按下键盘，与之合奏', '你的涟漪，永久收藏'],
    onboardingBodies: [
      '108 首音乐，将在两年内逐周浮出水面',
      '点击岛屿聆听，长按生成涟漪连接',
      'A–Z 二十六个键，对应二十六种声响',
      '链上铸造，唯一编号，不可复制',
    ],
    onboardingCta: '进入池塘',
    skip: '跳过',
  },
  en: {
    productName: 'Ripples in the Pond',
    productNameEn: 'Ripples in the Pond',
    tagline: 'An artist carving 108 songs into the chain, week by week, for two years',
    subtagline: 'Jam with the artist. Keep your ripples forever.',
    play: 'Play',
    stop: 'Stop',
    favorite: 'Collect',
    favorited: 'Collected',
    mint: 'Mint',
    minting: 'Minting',
    minted: 'On chain',
    archipelago: 'Archipelago',
    jam: 'Jam',
    myCollection: 'My Collection',
    myScores: 'My Scores',
    myMaterials: 'Materials',
    myDrafts: 'Drafts',
    login: 'Sign in',
    logout: 'Sign out',
    home: 'Home',
    pressKeyboard: 'Press A–Z to play',
    recording: 'Recording',
    week: 'Week',
    notes: 'notes',
    replay: 'Replay',
    share: 'Share',
    drafts: 'Drafts',
    expiresIn: 'left',
    mintScore: 'Mint as Score NFT',
    expired: 'Expired',
    next: 'Next',
    prev: 'Prev',
    of: '/',
    onboardingTitles: ['This is a pond', 'Each island is a song', 'Press a key. Jam with it.', 'Your ripples, forever yours'],
    onboardingBodies: [
      '108 songs will surface, one each week, over two years',
      'Tap an island to listen. Hold to draw a ripple between them.',
      'Twenty-six keys, A–Z, twenty-six voices',
      'Minted on chain. Numbered. Yours alone.',
    ],
    onboardingCta: 'Enter the pond',
    skip: 'Skip',
  },
};
window.COPY = COPY;

// ─────────────────────────────────────────────────────────────────────────────
// PALETTES — three distinct moods
// ─────────────────────────────────────────────────────────────────────────────
const PALETTES = {
  cool: {
    name: '冷池',
    bg: '#05070a',
    bgSoft: '#0b1018',
    fg: '#e8edf3',
    fgDim: 'rgba(232,237,243,0.55)',
    fgFaint: 'rgba(232,237,243,0.25)',
    line: 'rgba(232,237,243,0.12)',
    accents: ['#8ec5ff', '#7be8d4', '#a097ff', '#5db4ff', '#9fffe5', '#c9bfff', '#6dd9ff', '#7da7ff'],
    inkBg: 'linear-gradient(180deg, #05070a 0%, #0b1422 100%)',
  },
  warm: {
    name: '暖池',
    bg: '#0d0807',
    bgSoft: '#170d0a',
    fg: '#f4ece2',
    fgDim: 'rgba(244,236,226,0.55)',
    fgFaint: 'rgba(244,236,226,0.22)',
    line: 'rgba(244,236,226,0.12)',
    accents: ['#ffb98a', '#ffd58a', '#ff9a7d', '#f4d488', '#e89567', '#ffc7a3', '#f5b06b', '#e87f5d'],
    inkBg: 'linear-gradient(180deg, #0d0807 0%, #1a0e09 100%)',
  },
  mono: {
    name: '墨池',
    bg: '#000000',
    bgSoft: '#0a0a0a',
    fg: '#ffffff',
    fgDim: 'rgba(255,255,255,0.55)',
    fgFaint: 'rgba(255,255,255,0.22)',
    line: 'rgba(255,255,255,0.12)',
    accents: ['#ffffff', '#dddddd', '#bbbbbb', '#888888', '#eeeeee', '#cccccc', '#aaaaaa', '#999999'],
    inkBg: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 80%)',
  },
};
window.PALETTES = PALETTES;

// 26-letter rainbow for keyboard mappings (Patatap-style)
function keyToColor(key, palette) {
  const i = (key.toLowerCase().charCodeAt(0) - 97 + 26) % 26;
  if (palette === 'mono') {
    return `hsl(0, 0%, ${30 + (i / 25) * 70}%)`;
  }
  if (palette === 'warm') {
    const hue = 10 + (i / 25) * 50; // 10–60
    return `hsl(${hue}, 80%, 65%)`;
  }
  // cool
  const hue = 180 + (i / 25) * 120; // 180–300
  return `hsl(${hue}, 70%, 68%)`;
}
window.keyToColor = keyToColor;

// ─────────────────────────────────────────────────────────────────────────────
// 108 mock tracks — chinese poetic titles, paged 4×27 or 5×22
// ─────────────────────────────────────────────────────────────────────────────
const TITLE_POOL = [
  '潮汐', '晨雾', '星尘', '深渊', '回声', '落雨', '初雪', '远山',
  '近月', '萤火', '静水', '余烬', '微风', '雨后', '暮色', '夜行',
  '春信', '夏蝉', '秋分', '冬至', '断桥', '空山', '故园', '归路',
  '南行', '北望', '东渡', '西窗', '青苔', '白鹭', '红梅', '黑松',
  '金石', '玉台', '木叶', '水镜', '云间', '雾里', '雪原', '霜降',
  '惊蛰', '小满', '寒露', '立秋', '雨水', '清明', '芒种', '处暑',
  '残雪', '初霁', '晴朗', '阴翳', '虚室', '空谷', '幽兰', '苦竹',
  '茶烟', '酒痕', '砚池', '墨色', '纸鸢', '帆影', '舟楫', '渔火',
  '寒江', '远帆', '孤鹜', '落霞', '长河', '广陌', '深巷', '高台',
  '柴门', '茅屋', '竹篱', '石阶', '木桥', '小径', '草堂', '书斋',
  '抚琴', '听箫', '观棋', '论道', '吟诗', '品茶', '看花', '赏月',
  '读雪', '听雨', '观云', '望山', '行歌', '坐忘', '入梦', '醒觉',
  '初心', '回响', '余音', '绕梁', '弦断', '曲终', '人散', '月落',
  '潮起', '潮落', '风起', '云涌',
];

function generateTracks() {
  return Array.from({ length: 108 }, (_, i) => {
    const week = i + 1;
    const title = TITLE_POOL[i] || `第${week}周`;
    // Hue progresses around the wheel as weeks go
    const hue = (i / 108) * 360;
    return {
      id: `track-${String(week).padStart(3, '0')}`,
      week,
      title,
      hue,
      // pseudo-random but stable
      seed: ((week * 9301 + 49297) % 233280) / 233280,
      // duration / mood
      duration: 45 + ((week * 17) % 90),
      noteCount: 30 + ((week * 13) % 80),
    };
  });
}
window.generateTracks = generateTracks;

// ─────────────────────────────────────────────────────────────────────────────
// Generative cover (matches the SVG aesthetic — flowing wave lines)
// ─────────────────────────────────────────────────────────────────────────────
function GenCover({ track, size = 180, lines = 7, palette = 'cool' }) {
  const seed = track.seed;
  const baseHue = track.hue;
  const colors = useMemo(() => {
    return Array.from({ length: lines }, (_, i) => {
      const h = (baseHue + i * 47) % 360;
      const l = palette === 'mono' ? 70 + i * 3 : 60 + (i % 3) * 8;
      const s = palette === 'mono' ? 0 : 65;
      return `hsl(${h}, ${s}%, ${l}%)`;
    });
  }, [baseHue, lines, palette]);

  const paths = useMemo(() => {
    return Array.from({ length: lines }, (_, i) => {
      const yBase = 200 + (((seed * 1000 + i * 137) % 600));
      const amp = 60 + ((i * 53 + seed * 200) % 180);
      const freq = 0.005 + ((i * 7 + seed * 100) % 12) * 0.002;
      const phase = (i * 1.7 + seed * 6.28) % 6.28;
      const points = [];
      for (let x = 0; x <= 1000; x += 20) {
        const y = yBase + Math.sin(x * freq + phase) * amp;
        points.push(`${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)}`);
      }
      return points.join(' ');
    });
  }, [seed, lines]);

  const bgGradId = `gen-bg-${track.week}`;

  let bgStops;
  if (palette === 'mono') {
    bgStops = ['#080808', '#1a1a1a'];
  } else if (palette === 'warm') {
    bgStops = [`hsl(${(baseHue + 20) % 60 + 10}, 50%, 6%)`, `hsl(${(baseHue + 40) % 60 + 10}, 60%, 12%)`];
  } else {
    bgStops = [`hsl(${(baseHue + 200) % 360}, 50%, 5%)`, `hsl(${(baseHue + 240) % 360}, 60%, 12%)`];
  }

  return (
    <svg width={size} height={size} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bgStops[0]} />
          <stop offset="100%" stopColor={bgStops[1]} />
        </linearGradient>
      </defs>
      <rect width="1000" height="1000" fill={`url(#${bgGradId})`} />
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={colors[i]}
          strokeWidth={2 + (i % 4) * 0.6}
          fill="none"
          opacity={0.5 + (i % 5) * 0.1}
          strokeLinecap="round"
        />
      ))}
      <text x="960" y="970" fontSize="34" fontWeight="300" fill="#ffffff" textAnchor="end" opacity="0.85"
            style={{ fontFamily: 'system-ui, sans-serif' }}>
        Ripples #{String(track.week).padStart(3, '0')}
      </text>
    </svg>
  );
}
window.GenCover = GenCover;

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard event hook + ripple visual layer (Patatap-style)
// ─────────────────────────────────────────────────────────────────────────────
function useJamKeys({ enabled = true, onKey, palette = 'cool' }) {
  useEffect(() => {
    if (!enabled) return;
    const down = new Set();
    const handleDown = (e) => {
      const key = e.key.toLowerCase();
      if (key.length !== 1 || !/[a-z]/.test(key)) return;
      if (down.has(key)) return;
      down.add(key);
      onKey?.(key);
    };
    const handleUp = (e) => {
      down.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [enabled, onKey, palette]);
}
window.useJamKeys = useJamKeys;

// Plays a beep using WebAudio — no external samples. Each letter maps to a pitch / wave.
let audioCtx = null;
function getAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  return audioCtx;
}
function playKeyTone(key) {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const i = key.charCodeAt(0) - 97;
  const scale = [0, 2, 4, 5, 7, 9, 11]; // major
  const note = scale[i % 7] + Math.floor(i / 7) * 12;
  const freq = 220 * Math.pow(2, note / 12);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const types = ['sine', 'triangle', 'sine', 'triangle'];
  o.type = types[i % types.length];
  o.frequency.value = freq;
  g.gain.value = 0;
  o.connect(g);
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.start(t);
  o.stop(t + 1.7);
}
window.playKeyTone = playKeyTone;

// ─────────────────────────────────────────────────────────────────────────────
// Core layout primitives (chinese-leaning typography rules)
// ─────────────────────────────────────────────────────────────────────────────
function useLang() {
  const lang = window.__tweaks?.language || 'zh';
  return { lang, t: COPY[lang] };
}
window.useLang = useLang;

function VerticalLabel({ children, color, opacity = 0.5 }) {
  return (
    <span style={{
      writingMode: 'vertical-rl',
      letterSpacing: '0.5em',
      fontSize: 11,
      color: color || 'currentColor',
      opacity,
    }}>{children}</span>
  );
}
window.VerticalLabel = VerticalLabel;

function CrossMark({ size = 8, color = 'currentColor', opacity = 0.4 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ opacity }}>
      <line x1="0" y1="4" x2="8" y2="4" stroke={color} strokeWidth="0.5" />
      <line x1="4" y1="0" x2="4" y2="8" stroke={color} strokeWidth="0.5" />
    </svg>
  );
}
window.CrossMark = CrossMark;

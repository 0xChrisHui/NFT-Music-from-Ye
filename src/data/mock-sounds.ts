import type { Sound } from '@/src/types/jam';

/**
 * 假音效数据 — 26 个键盘键各对应一个音效
 * Track B 开发阶段用，Track C 集成后由 API 返回真实数据
 */

const KEYS = 'abcdefghijklmnopqrstuvwxyz';

const SOUND_DEFS: { name: string; category: Sound['category'] }[] = [
  { name: 'Bubbles', category: 'effect' },
  { name: 'Clay', category: 'percussion' },
  { name: 'Confetti', category: 'effect' },
  { name: 'Corona', category: 'effect' },
  { name: 'Dotted Spiral', category: 'effect' },
  { name: 'Flash 1', category: 'percussion' },
  { name: 'Flash 2', category: 'percussion' },
  { name: 'Flash 3', category: 'percussion' },
  { name: 'Glimmer', category: 'melody' },
  { name: 'Moon', category: 'melody' },
  { name: 'Pinwheel', category: 'melody' },
  { name: 'Piston 1', category: 'percussion' },
  { name: 'Piston 2', category: 'percussion' },
  { name: 'Piston 3', category: 'percussion' },
  { name: 'Prism 1', category: 'melody' },
  { name: 'Prism 2', category: 'melody' },
  { name: 'Prism 3', category: 'melody' },
  { name: 'Splits', category: 'percussion' },
  { name: 'Squiggle', category: 'effect' },
  { name: 'Strike', category: 'percussion' },
  { name: 'Suspension', category: 'melody' },
  { name: 'Timer', category: 'effect' },
  { name: 'UFO', category: 'effect' },
  { name: 'Veil', category: 'melody' },
  { name: 'Wipe', category: 'effect' },
  { name: 'Zig Zag', category: 'effect' },
];

export const MOCK_SOUNDS: Sound[] = SOUND_DEFS.map((def, i) => ({
  id: `sound-${String(i + 1).padStart(3, '0')}`,
  token_id: 109 + i,
  name: def.name,
  audio_url: `/sounds/${KEYS[i]}.mp3`,
  duration_ms: 500,
  category: def.category,
  key: KEYS[i],
}));

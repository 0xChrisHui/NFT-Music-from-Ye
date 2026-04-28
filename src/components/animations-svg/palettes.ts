/**
 * Phase 6 B2 - patatap 6 调色板（移植 references/aaaa/patatap-engine.jsx）
 */

export interface Palette {
  background: string;
  middleground: string;
  foreground: string;
  highlight: string;
  accent: string;
  white: string;
  black: string;
  isDark: boolean;
  label: string;
}

export const PALETTES: Record<string, Palette> = {
  grey: {
    background: 'rgb(181,181,181)',
    middleground: 'rgb(141,164,170)',
    foreground: 'rgb(227,79,12)',
    highlight: 'rgb(163,141,116)',
    accent: 'rgb(255,197,215)',
    white: 'rgb(255,255,255)',
    black: 'rgb(0,0,0)',
    isDark: false,
    label: 'Grey',
  },
  white: {
    background: 'rgb(255,230,255)',
    middleground: 'rgb(151,41,164)',
    foreground: 'rgb(1,120,186)',
    highlight: 'rgb(255,255,0)',
    accent: 'rgb(255,51,148)',
    white: 'rgb(255,255,255)',
    black: 'rgb(255,255,255)',
    isDark: false,
    label: 'White',
  },
  orange: {
    background: 'rgb(217,82,31)',
    middleground: 'rgb(143,74,45)',
    foreground: 'rgb(255,108,87)',
    highlight: 'rgb(255,126,138)',
    accent: 'rgb(227,190,141)',
    white: 'rgb(255,255,255)',
    black: 'rgb(0,0,0)',
    isDark: false,
    label: 'Orange',
  },
  blue: {
    background: 'rgb(57,109,193)',
    middleground: 'rgb(186,60,223)',
    foreground: 'rgb(213,255,93)',
    highlight: 'rgb(213,160,255)',
    accent: 'rgb(36,221,165)',
    white: 'rgb(215,236,255)',
    black: 'rgb(0,0,0)',
    isDark: true,
    label: 'Blue',
  },
  cream: {
    background: 'rgb(255,244,211)',
    middleground: 'rgb(207,145,79)',
    foreground: 'rgb(38,83,122)',
    highlight: 'rgb(178,87,53)',
    accent: 'rgb(235,192,92)',
    white: 'rgb(226,82,87)',
    black: 'rgb(0,0,0)',
    isDark: false,
    label: 'Cream',
  },
  purple: {
    background: 'rgb(39,6,54)',
    middleground: 'rgb(69,26,87)',
    foreground: 'rgb(252,25,246)',
    highlight: 'rgb(52,255,253)',
    accent: 'rgb(133,102,193)',
    white: 'rgb(253,228,252)',
    black: 'rgb(255,255,255)',
    isDark: true,
    label: 'Purple',
  },
};

export const PALETTE_KEYS = ['grey', 'white', 'orange', 'blue', 'cream', 'purple'] as const;
export type PaletteKey = typeof PALETTE_KEYS[number];

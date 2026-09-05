window.POND_ECHO = Object.freeze({
  wallet: '0x19da4b170dF5CcA47414b04f04a24f67E2E6bA54',
  recipe: 'ER81BTKWSDL7QAXTPCV28IGGYFVPSTIERCMR',
  charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  crossfadeMs: 60,
  longDurationMs: 7555.5625,
  shortDurationMs: 7555.541667,
  shortKeys: 'BEHKNQTWZ258',
  sourceRoot: '../../../public/the36/',
  durationFor(key) {
    return this.shortKeys.includes(key) ? this.shortDurationMs : this.longDurationMs;
  },
});

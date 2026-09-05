(function () {
  const spec = window.POND_ECHO;
  const uniqueKeys = [...new Set(spec.recipe)];
  let context = null;
  let buffers = new Map();
  let sources = [];
  let startedAt = 0;
  let pausedAt = 0;
  let raf = 0;
  let state = 'idle';
  const listeners = new Set();

  const segmentStarts = [];
  let cursor = 0;
  [...spec.recipe].forEach((key, index) => {
    segmentStarts.push(cursor);
    cursor += spec.durationFor(key) - (index < spec.recipe.length - 1 ? spec.crossfadeMs : 0);
  });
  const durationMs = cursor;

  function currentIndex(positionMs) {
    const next = segmentStarts.findIndex((start) => start > positionMs);
    let index = next === -1 ? segmentStarts.length - 1 : next - 1;
    if (index < 0) index = positionMs >= segmentStarts[0] ? 0 : -1;
    return Math.min(index, spec.recipe.length - 1);
  }

  function snapshot() {
    const elapsed = state === 'playing' && context
      ? pausedAt + (context.currentTime - startedAt) * 1000
      : pausedAt;
    const positionMs = Math.min(durationMs, Math.max(0, elapsed));
    const index = Math.max(0, currentIndex(positionMs));
    return { state, positionMs, durationMs, currentIndex: index, currentKey: spec.recipe[index] };
  }

  function emit() {
    const value = snapshot();
    window.__pondEchoAudit = value;
    listeners.forEach((listener) => listener(value));
  }

  function stopSources() {
    sources.forEach(({ source }) => { try { source.stop(); } catch {} });
    sources = [];
    cancelAnimationFrame(raf);
  }

  async function load() {
    if (buffers.size === uniqueKeys.length) return;
    state = 'loading';
    emit();
    context ||= new AudioContext();
    window.__pondEchoAudioContext = context;
    await context.resume();
    const decoded = await Promise.all(uniqueKeys.map(async (key) => {
      const response = await fetch(`${spec.sourceRoot}${key}.mp3`);
      if (!response.ok) throw new Error(`片段 ${key} 读取失败`);
      return [key, await context.decodeAudioData(await response.arrayBuffer())];
    }));
    buffers = new Map(decoded);
    window.__pondEchoBuffers = buffers;
    state = 'ready';
    emit();
  }

  function gainCurve(starting) {
    const points = 64;
    return Float32Array.from({ length: points }, (_, i) => {
      const angle = (i / (points - 1)) * Math.PI * 0.5;
      return starting ? Math.sin(angle) : Math.cos(angle);
    });
  }

  function schedule(fromMs) {
    stopSources();
    const now = context.currentTime + 0.04;
    const startIndex = Math.max(0, currentIndex(fromMs));
    for (let index = startIndex; index < spec.recipe.length; index += 1) {
      const key = spec.recipe[index];
      const buffer = buffers.get(key);
      const clipStartMs = segmentStarts[index];
      const offsetMs = Math.max(0, fromMs - clipStartMs);
      const when = now + Math.max(0, clipStartMs - fromMs) / 1000;
      const playableMs = spec.durationFor(key) - offsetMs;
      if (playableMs <= 0) continue;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.connect(gain).connect(context.destination);
      const fadeSeconds = spec.crossfadeMs / 1000;
      if (index > 0 && offsetMs < spec.crossfadeMs) {
        gain.gain.setValueCurveAtTime(gainCurve(true), when, fadeSeconds);
      }
      if (index < spec.recipe.length - 1 && playableMs > spec.crossfadeMs) {
        gain.gain.setValueCurveAtTime(gainCurve(false), when + playableMs / 1000 - fadeSeconds, fadeSeconds);
      }
      source.start(when, offsetMs / 1000);
      sources.push({ source, gain });
    }
    startedAt = context.currentTime;
    state = 'playing';
    tick();
  }

  function tick() {
    emit();
    if (snapshot().positionMs >= durationMs) {
      pausedAt = durationMs;
      state = 'ended';
      stopSources();
      emit();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  async function play() {
    try {
      await load();
      if (state === 'ended') pausedAt = 0;
      schedule(pausedAt);
    } catch (error) {
      state = 'error';
      window.__pondEchoError = String(error);
      emit();
    }
  }

  function pause() {
    if (state !== 'playing') return;
    pausedAt = snapshot().positionMs;
    stopSources();
    state = 'paused';
    emit();
  }

  function preview(nextState) {
    stopSources();
    state = nextState;
    if (nextState === 'playing') pausedAt = segmentStarts[9] + 2900;
    if (nextState === 'ended') pausedAt = durationMs;
    emit();
  }

  window.PondEchoPlayer = {
    action() { return state === 'playing' ? pause() : play(); },
    subscribe(listener) { listeners.add(listener); emit(); },
    getSnapshot: snapshot,
    preview,
    timeline: segmentStarts.map((startMs, index) => ({ index, startMs, key: spec.recipe[index] })),
  };
})();

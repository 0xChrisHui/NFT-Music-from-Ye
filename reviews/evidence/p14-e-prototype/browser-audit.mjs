import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9334;
const pageUrl = 'http://127.0.0.1:4174/references/visual-prototypes/p14-pond-echoes/';
const profile = await mkdtemp(join(tmpdir(), 'p14-e0-edge-'));
const edge = spawn(edgePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, pageUrl,
], { stdio: 'ignore' });

async function retry(action, limit = 60) {
  let error;
  for (let index = 0; index < limit; index += 1) {
    try { return await action(); } catch (caught) { error = caught; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw error;
}

const pages = await retry(async () => {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error('Edge CDP 尚未就绪');
  const items = await response.json();
  const page = items.find((item) => item.type === 'page');
  if (!page) throw new Error('找不到页面 target');
  return page;
});

const socket = new WebSocket(pages.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let commandId = 0;
const pending = new Map();
const consoleErrors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    return message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') consoleErrors.push(message.params.entry.text);
});

function send(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 844, deviceScaleFactor: 1, mobile: true });
await retry(() => evaluate(`window.__pondEchoReady === true`).then((ready) => {
  if (!ready) throw new Error('原型尚未就绪');
}));

const initial = await evaluate(`({
  state: window.__pondEchoAudit.state,
  viewport: [innerWidth, innerHeight],
  horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
  bodyFontPx: parseFloat(getComputedStyle(document.body).fontSize),
  playTarget: (() => { const r = document.querySelector('#play').getBoundingClientRect(); return [r.width, r.height]; })(),
  autoContextCreated: Boolean(window.__pondEchoAudioContext),
  recipe: window.POND_ECHO.recipe,
  wallet: window.POND_ECHO.wallet,
  crossfadeMs: window.POND_ECHO.crossfadeMs
})`);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await evaluate(`document.querySelector('#play').click()`);
const fourthSegment = await retry(async () => {
  const value = await evaluate('window.PondEchoPlayer.getSnapshot()');
  if (value.state === 'error') throw new Error(`播放错误：${await evaluate('window.__pondEchoError')}`);
  if (value.currentIndex < 3) throw new Error(`播放尚未跨过四段：${JSON.stringify(value)}`);
  return value;
}, 130);
await evaluate(`window.PondEchoPlayer.action()`);
const boundaryAnalysis = await evaluate(`(() => {
  const recipe = window.POND_ECHO.recipe;
  const buffers = window.__pondEchoBuffers;
  const fadeSeconds = window.POND_ECHO.crossfadeMs / 1000;
  let peak = 0;
  let peakBoundary = '';
  const boundaries = [];
  for (let index = 0; index < recipe.length - 1; index += 1) {
    const left = buffers.get(recipe[index]);
    const right = buffers.get(recipe[index + 1]);
    const count = Math.floor(Math.min(left.sampleRate, right.sampleRate) * fadeSeconds);
    let localPeak = 0;
    for (let channel = 0; channel < Math.min(left.numberOfChannels, right.numberOfChannels); channel += 1) {
      const a = left.getChannelData(channel);
      const b = right.getChannelData(channel);
      for (let sample = 0; sample < count; sample += 1) {
        const angle = sample / (count - 1) * Math.PI * .5;
        const mixed = a[a.length - count + sample] * Math.cos(angle) + b[sample] * Math.sin(angle);
        localPeak = Math.max(localPeak, Math.abs(mixed));
      }
    }
    const label = recipe[index] + '→' + recipe[index + 1];
    boundaries.push({ position: index + 1, label, peak: Number(localPeak.toFixed(6)) });
    if (localPeak > peak) { peak = localPeak; peakBoundary = label; }
  }
  return { count: boundaries.length, peak: Number(peak.toFixed(6)), peakBoundary, clipped: peak >= .999, boundaries };
})()`);
const clipSignals = await evaluate(`(async () => {
  const spec = window.POND_ECHO;
  const context = window.__pondEchoAudioContext;
  const buffers = window.__pondEchoBuffers;
  for (const key of spec.charset) {
    if (buffers.has(key)) continue;
    const response = await fetch(spec.sourceRoot + key + '.mp3');
    buffers.set(key, await context.decodeAudioData(await response.arrayBuffer()));
  }
  return [...spec.charset].map((key) => {
    const buffer = buffers.get(key);
    let square = 0, peak = 0, first = buffer.length, last = -1;
    for (let frame = 0; frame < buffer.length; frame += 1) {
      let active = false;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const sample = buffer.getChannelData(channel)[frame];
        square += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
        if (Math.abs(sample) >= .001) active = true;
      }
      if (active) { first = Math.min(first, frame); last = frame; }
    }
    const rms = Math.sqrt(square / (buffer.length * buffer.numberOfChannels));
    return {
      key, durationMs: Number((buffer.length / buffer.sampleRate * 1000).toFixed(6)),
      rmsDbfs: Number((20 * Math.log10(rms)).toFixed(3)), peak: Number(peak.toFixed(6)),
      leadingSilenceMs: Number((first / buffer.sampleRate * 1000).toFixed(3)),
      trailingSilenceMs: Number(((buffer.length - 1 - last) / buffer.sampleRate * 1000).toFixed(3))
    };
  });
})()`);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await evaluate(`window.PondEchoPlayer.preview('playing')`);
const reducedMotion = await evaluate(`({
  animationName: getComputedStyle(document.querySelector('.moon')).animationName,
  stateSignal: getComputedStyle(document.querySelector('.moon')).outlineStyle
})`);
const stateContract = await evaluate(`['idle','loading','playing','paused','ended','error'].map((state) => {
  window.PondEchoPlayer.preview(state);
  return { state, rendered: document.documentElement.dataset.state, status: document.querySelector('#status').textContent };
})`);
const result = {
  passed: initial.state === 'idle' && initial.horizontalOverflow === 0 && initial.bodyFontPx >= 16
    && initial.playTarget[0] >= 44 && initial.playTarget[1] >= 44
    && initial.recipe === 'ER81BTKWSDL7QAXTPCV28IGGYFVPSTIERCMR'
    && fourthSegment.currentIndex >= 3 && !boundaryAnalysis.clipped && clipSignals.length === 36
    && reducedMotion.animationName === 'none' && reducedMotion.stateSignal !== 'none'
    && stateContract.every((item) => item.state === item.rendered && item.status.length > 0)
    && consoleErrors.length === 0,
  capturedAt: new Date().toISOString(),
  browser: '本机 Microsoft Edge headless（DOM 按钮点击，启动前保持 idle）',
  initial,
  fourthSegment,
  playedSegments: fourthSegment.currentIndex + 1,
  boundaryAnalysis,
  clipSignals,
  reducedMotion,
  stateContract,
  consoleErrors,
};
await writeFile(new URL('./browser-audit.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
await send('Browser.close').catch(() => {});
socket.close();
await new Promise((resolve) => edge.once('exit', resolve));
if (!result.passed) process.exitCode = 1;
console.log(JSON.stringify(result, null, 2));

import { equalPowerGain, type WalletRecipeSegment } from './timeline';

const CURVE_POINTS = 64;

export type ActiveAudioNode = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

function curveFor(
  segment: WalletRecipeSegment,
  fromMs: number,
  toMs: number,
): Float32Array {
  return Float32Array.from({ length: CURVE_POINTS }, (_, index) => {
    const ratio = index / (CURVE_POINTS - 1);
    return equalPowerGain(segment, fromMs + (toMs - fromMs) * ratio);
  });
}

function scheduleEnvelope(
  gain: AudioParam,
  segment: WalletRecipeSegment,
  clipOffsetMs: number,
  when: number,
): void {
  gain.cancelScheduledValues(when);
  gain.setValueAtTime(equalPowerGain(segment, clipOffsetMs), when);
  let cursorMs = clipOffsetMs;
  let cursorTime = when;
  if (segment.fadeInMs > 0 && cursorMs < segment.fadeInMs) {
    const remaining = segment.fadeInMs - cursorMs;
    gain.setValueCurveAtTime(curveFor(segment, cursorMs, segment.fadeInMs), cursorTime, remaining / 1000);
    cursorMs = segment.fadeInMs;
    cursorTime += remaining / 1000;
  }
  const fadeOutStart = segment.durationMs - segment.fadeOutMs;
  if (segment.fadeOutMs > 0 && cursorMs < fadeOutStart) {
    gain.setValueAtTime(1, when + (fadeOutStart - clipOffsetMs) / 1000);
    cursorTime = when + (fadeOutStart - clipOffsetMs) / 1000;
    cursorMs = fadeOutStart;
  }
  if (segment.fadeOutMs > 0 && cursorMs < segment.durationMs) {
    const remaining = segment.durationMs - cursorMs;
    gain.setValueCurveAtTime(curveFor(segment, cursorMs, segment.durationMs), cursorTime, remaining / 1000);
  }
}

export function scheduleAudioSegment(
  context: AudioContext,
  buffer: AudioBuffer,
  segment: WalletRecipeSegment,
  playheadMs: number,
  anchorTime: number,
  onEnded: (node: ActiveAudioNode) => void,
): ActiveAudioNode | null {
  if (segment.endMs <= playheadMs) return null;
  const clipOffsetMs = Math.max(0, playheadMs - segment.startMs);
  const when = anchorTime + Math.max(0, segment.startMs - playheadMs) / 1000;
  const source = context.createBufferSource();
  const gain = context.createGain();
  const node = { source, gain };
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(context.destination);
  scheduleEnvelope(gain.gain, segment, clipOffsetMs, when);
  source.addEventListener('ended', () => onEnded(node), { once: true });
  source.start(when, clipOffsetMs / 1000);
  return node;
}

export function stopAudioNode(node: ActiveAudioNode): void {
  try {
    node.source.stop();
  } catch {
    // source 可能已自然结束；disconnect 仍须执行，防止路由重入累积节点。
  }
  node.source.disconnect();
  node.gain.disconnect();
}

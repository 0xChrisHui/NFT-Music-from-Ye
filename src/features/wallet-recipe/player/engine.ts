import { scheduleAudioSegment, stopAudioNode, type ActiveAudioNode } from './audio-schedule';
import { decodeWalletRecipeAudio, loadWalletRecipeAudio } from './media-loader';
import {
  createWalletRecipeTimeline,
  segmentAtPosition,
  type WalletRecipeTimeline,
} from './timeline';
import {
  IDLE_WALLET_RECIPE_SNAPSHOT,
  toPlayerError,
  type WalletRecipePlayerEngineOptions,
  type PlayerError,
  type WalletRecipePlayerController,
  type WalletRecipePlayerInput,
  type WalletRecipePlayerListener,
  type WalletRecipePlayerSnapshot,
} from './types';

const START_DELAY_SECONDS = 0.06;

export class WalletRecipePlayerEngine implements WalletRecipePlayerController {
  private readonly fetcher: typeof fetch;
  private readonly createContext: () => AudioContext;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private snapshot = IDLE_WALLET_RECIPE_SNAPSHOT;
  private listeners = new Set<WalletRecipePlayerListener>();
  private input: WalletRecipePlayerInput | null = null;
  private timeline: WalletRecipeTimeline | null = null;
  private compressed = new Map<string, ArrayBuffer>();
  private decoded = new Map<string, AudioBuffer>();
  private context: AudioContext | null = null;
  private nodes = new Set<ActiveAudioNode>();
  private abortController: AbortController | null = null;
  private generation = 0;
  private frame = 0;
  private anchorTime = 0;
  private playheadMs = 0;
  private lastUiPositionMs = -Infinity;

  constructor(options: WalletRecipePlayerEngineOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.createContext = options.createAudioContext ?? (() => new AudioContext());
    this.requestFrame = options.requestFrame ?? ((callback) => window.requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => window.cancelAnimationFrame(handle));
  }

  getSnapshot = (): WalletRecipePlayerSnapshot => this.snapshot;
  getServerSnapshot = (): WalletRecipePlayerSnapshot => IDLE_WALLET_RECIPE_SNAPSHOT;
  subscribe = (listener: WalletRecipePlayerListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<WalletRecipePlayerSnapshot>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    this.listeners.forEach((listener) => listener());
  }

  async load(input: WalletRecipePlayerInput): Promise<void> {
    const generation = ++this.generation;
    this.abortController?.abort();
    await this.releaseAudio();
    this.abortController = new AbortController();
    this.input = null;
    this.timeline = null;
    this.compressed.clear();
    let timeline: WalletRecipeTimeline;
    try {
      timeline = createWalletRecipeTimeline(input);
    } catch (error) {
      this.fail(toPlayerError(error, 'invalid_input'));
      return;
    }
    this.update({ ...IDLE_WALLET_RECIPE_SNAPSHOT, state: 'loading', durationMs: timeline.durationMs,
      currentIndex: 0, currentKey: input.recipe[0], totalUniqueCount: timeline.uniqueKeys.length });
    try {
      const compressed = await loadWalletRecipeAudio(
        input, timeline, this.fetcher, this.abortController.signal,
        (loadedUniqueCount) => {
          if (generation === this.generation) this.update({ loadedUniqueCount });
        },
      );
      if (generation !== this.generation) return;
      this.compressed = compressed;
      this.input = input;
      this.timeline = timeline;
      this.update({ state: 'ready', errorKind: null, errorMessage: null });
    } catch (error) {
      if (generation !== this.generation || this.abortController.signal.aborted) return;
      this.fail(toPlayerError(error, 'network'));
    }
  }

  async play(): Promise<void> {
    if (!this.timeline || !this.input || !['ready', 'paused', 'ended', 'error'].includes(this.snapshot.state)) return;
    if (this.snapshot.state === 'ended') this.playheadMs = 0;
    const generation = this.generation;
    this.update({ state: 'loading', errorKind: null, errorMessage: null });
    try {
      // 先把“正在解码”状态交给浏览器绘制，再启动首轮批量 decode，守住 100ms 控制反馈。
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
      if (generation !== this.generation) return;
      const context = this.context ?? this.createContext();
      this.context = context;
      if (context.state !== 'running') await context.resume();
      if (this.decoded.size !== this.compressed.size) {
        this.decoded = await decodeWalletRecipeAudio(context, this.input, this.compressed);
      }
      if (generation !== this.generation) return;
      this.scheduleFrom(this.playheadMs);
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(toPlayerError(error, this.decoded.size ? 'audio' : 'decode'));
    }
  }

  private scheduleFrom(positionMs: number): void {
    const context = this.context!;
    this.stopNodes();
    this.playheadMs = positionMs;
    this.anchorTime = context.currentTime + START_DELAY_SECONDS;
    for (const segment of this.timeline!.segments) {
      const node = scheduleAudioSegment(
        context, this.decoded.get(segment.key)!, segment, positionMs, this.anchorTime,
        (ended) => this.releaseEndedNode(ended),
      );
      if (node) this.nodes.add(node);
    }
    this.lastUiPositionMs = -Infinity;
    this.updatePosition(positionMs, 'playing');
    this.frame = this.requestFrame(this.tick);
  }

  private currentPositionMs(): number {
    if (!this.context || !this.timeline) return this.playheadMs;
    const elapsedMs = Math.max(0, (this.context.currentTime - this.anchorTime) * 1000);
    return Math.min(this.timeline.durationMs, this.playheadMs + elapsedMs);
  }

  private tick = (): void => {
    const positionMs = this.currentPositionMs();
    if (positionMs - this.lastUiPositionMs >= 50 || positionMs >= this.timeline!.durationMs) {
      this.updatePosition(positionMs, positionMs >= this.timeline!.durationMs ? 'ended' : 'playing');
      this.lastUiPositionMs = positionMs;
    }
    if (positionMs >= this.timeline!.durationMs) {
      this.playheadMs = this.timeline!.durationMs;
      this.stopNodes();
      return;
    }
    this.frame = this.requestFrame(this.tick);
  };

  private updatePosition(positionMs: number, state: 'playing' | 'paused' | 'ended'): void {
    const segment = segmentAtPosition(this.timeline!, positionMs);
    this.update({ state, positionMs, currentIndex: segment?.index ?? null,
      currentKey: segment?.key ?? null, errorKind: null, errorMessage: null });
  }

  pause(): void {
    if (this.snapshot.state !== 'playing') return;
    this.playheadMs = this.currentPositionMs();
    this.stopNodes();
    this.updatePosition(this.playheadMs, 'paused');
  }

  async resume(): Promise<void> {
    if (this.snapshot.state === 'paused') await this.play();
  }

  async replay(): Promise<void> {
    if (!this.timeline) return;
    this.playheadMs = 0;
    this.stopNodes();
    this.updatePosition(0, 'paused');
    await this.play();
  }

  private fail(error: PlayerError): void {
    this.stopNodes();
    this.update({ state: 'error', errorKind: error.kind, errorMessage: error.message });
  }

  private releaseEndedNode(node: ActiveAudioNode): void {
    this.nodes.delete(node);
    node.source.disconnect();
    node.gain.disconnect();
  }

  private stopNodes(): void {
    if (this.frame) this.cancelFrame(this.frame);
    this.frame = 0;
    this.nodes.forEach(stopAudioNode);
    this.nodes.clear();
  }

  private async releaseAudio(): Promise<void> {
    this.stopNodes();
    const context = this.context;
    this.context = null;
    this.decoded.clear();
    if (context && context.state !== 'closed') await context.close();
  }

  async destroy(): Promise<void> {
    ++this.generation;
    this.abortController?.abort();
    this.abortController = null;
    this.input = null;
    this.timeline = null;
    this.compressed.clear();
    await this.releaseAudio();
    this.playheadMs = 0;
    this.update({ ...IDLE_WALLET_RECIPE_SNAPSHOT });
  }
}

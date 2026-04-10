'use client';

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Track } from '@/src/types/tracks';

/** 播放生命周期回调（B2 录制用） */
export interface PlayerLifecycle {
  onPlayStart?: (track: Track) => void;
  onPlayEnd?: () => void;
}

interface PlayerState {
  playing: boolean;
  currentTrack: Track | null;
  toggle: (track: Track) => Promise<void>;
  stop: () => void;
  /** 注册播放生命周期回调，返回注销函数 */
  subscribe: (lifecycle: PlayerLifecycle) => () => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

/**
 * PlayerProvider — 全局音频状态
 * 包在 Providers 里，任何组件都能通过 usePlayer() 共享同一个播放状态
 * 💭 为什么不直接用 useAudioPlayer：多个 Island 各自调用会创建独立状态，无法共享
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const listenersRef = useRef<Set<PlayerLifecycle>>(new Set());

  const subscribe = useCallback((lifecycle: PlayerLifecycle) => {
    listenersRef.current.add(lifecycle);
    return () => { listenersRef.current.delete(lifecycle); };
  }, []);

  const notifyStart = useCallback((track: Track) => {
    listenersRef.current.forEach((l) => l.onPlayStart?.(track));
  }, []);

  const notifyEnd = useCallback(() => {
    listenersRef.current.forEach((l) => l.onPlayEnd?.());
  }, []);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback(async (track: Track) => {
    const ctx = getContext();

    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
      notifyEnd();
    }

    const res = await fetch(track.audio_url);
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setPlaying(false);
      setCurrentTrack(null);
      notifyEnd();
    };
    source.start();

    sourceRef.current = source;
    setCurrentTrack(track);
    setPlaying(true);
    notifyStart(track);
  }, [getContext, notifyStart, notifyEnd]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setCurrentTrack(null);
    setPlaying(false);
    notifyEnd();
  }, [notifyEnd]);

  const toggle = useCallback(async (track: Track) => {
    if (playing && currentTrack?.id === track.id) {
      stop();
    } else {
      await play(track);
    }
  }, [playing, currentTrack, play, stop]);

  return (
    <PlayerContext value={{ playing, currentTrack, toggle, stop, subscribe }}>
      {children}
    </PlayerContext>
  );
}

/** 消费全局播放状态的 hook */
export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer 必须在 PlayerProvider 内使用');
  }
  return ctx;
}

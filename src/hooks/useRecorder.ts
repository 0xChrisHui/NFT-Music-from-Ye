'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import type { KeyEvent } from '@/src/types/jam';

/** 录制上限 */
const MAX_DURATION_MS = 60_000;
const MAX_EVENTS = 500;

interface UseRecorderOptions {
  /** 录制完成时的回调 */
  onComplete?: (result: RecordingResult) => void;
}

interface UseRecorderReturn {
  /** 当前是否在录制 */
  recording: boolean;
  /** 记录一次按键（传给 useKeyboard 的 onKeyDown） */
  recordKeyDown: (key: string) => void;
  /** 记录按键抬起（传给 useKeyboard 的 onKeyUp） */
  recordKeyUp: (key: string) => void;
}

export interface RecordingResult {
  trackId: string;
  events: KeyEvent[];
}

/**
 * 录制 hook — 绑定 PlayerProvider 生命周期
 *
 * 播放开始 → 自动开始录制
 * 播放结束 / 超时 / 超事件数 → 自动停止录制
 * 没播放时按键 → 不录制
 *
 * 时间基准：背景曲 AudioContext.currentTime（秒→毫秒）
 * 单一时钟源，录制回放与背景曲进度完全对齐
 */
export function useRecorder(options: UseRecorderOptions = {}): UseRecorderReturn {
  const { subscribe, getCurrentTime } = usePlayer();
  const [recording, setRecording] = useState(false);

  // 录制开始时的 AudioContext.currentTime（秒），作为时间零点
  const audioStartRef = useRef(0);
  const eventsRef = useRef<KeyEvent[]>([]);
  // pending 按键：key → 按下时的音频时间（毫秒，相对于录制开始）
  const pendingRef = useRef<Map<string, number>>(new Map());
  const trackIdRef = useRef('');
  const recordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(options.onComplete);
  useEffect(() => { onCompleteRef.current = options.onComplete; }, [options.onComplete]);

  /** 当前音频时间相对于录制开始的偏移（毫秒） */
  const audioElapsed = useCallback(() => {
    return Math.round((getCurrentTime() - audioStartRef.current) * 1000);
  }, [getCurrentTime]);

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 把还没抬起的键强制结束
    const nowMs = audioElapsed();
    pendingRef.current.forEach((downTimeMs, key) => {
      eventsRef.current.push({
        key,
        time: downTimeMs,
        duration: Math.max(0, nowMs - downTimeMs),
      });
    });
    pendingRef.current.clear();

    const result: RecordingResult = {
      trackId: trackIdRef.current,
      events: [...eventsRef.current],
    };

    console.log(
      `[recorder] 录制结束：${result.events.length} 个事件`,
      result.events,
    );
    onCompleteRef.current?.(result);
  }, [audioElapsed]);

  const startRecording = useCallback((trackId: string) => {
    eventsRef.current = [];
    pendingRef.current.clear();
    audioStartRef.current = getCurrentTime();
    trackIdRef.current = trackId;
    recordingRef.current = true;
    setRecording(true);

    // 60 秒超时自动停止
    timerRef.current = setTimeout(stopRecording, MAX_DURATION_MS);
    console.log('[recorder] 录制开始');
  }, [stopRecording, getCurrentTime]);

  // 订阅播放生命周期
  useEffect(() => {
    const unsub = subscribe({
      onPlayStart: (track) => startRecording(track.id),
      onPlayEnd: () => stopRecording(),
    });
    return unsub;
  }, [subscribe, startRecording, stopRecording]);

  const recordKeyDown = useCallback((key: string) => {
    if (!recordingRef.current) return;
    if (eventsRef.current.length >= MAX_EVENTS) {
      stopRecording();
      return;
    }
    pendingRef.current.set(key, audioElapsed());
  }, [stopRecording, audioElapsed]);

  const recordKeyUp = useCallback((key: string) => {
    if (!recordingRef.current) return;
    const downTimeMs = pendingRef.current.get(key);
    if (downTimeMs === undefined) return;
    pendingRef.current.delete(key);

    const nowMs = audioElapsed();
    eventsRef.current.push({
      key,
      time: downTimeMs,
      duration: Math.max(0, nowMs - downTimeMs),
    });
  }, [audioElapsed]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { recording, recordKeyDown, recordKeyUp };
}

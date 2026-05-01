'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { BgWave } from '../sphere-sim-setup';

/**
 * 监听 'bg-ripple:wave' 事件，把涟漪 spawn 数据 push 到 wavesRef。
 * SphereCanvas 的 sim tick 读这个 ref，调 pushSpheresByWaves 让球被推。
 */
export function useWaveEvents(): RefObject<BgWave[]> {
  const wavesRef = useRef<BgWave[]>([]);
  useEffect(() => {
    const onWave = (e: Event) => {
      const ce = e as CustomEvent<{ x: number; y: number; size: number; duration: number }>;
      wavesRef.current.push({
        x: ce.detail.x,
        y: ce.detail.y,
        size: ce.detail.size,
        spawnTime: performance.now(),
        duration: ce.detail.duration * 1000,
      });
    };
    window.addEventListener('bg-ripple:wave', onWave);
    return () => window.removeEventListener('bg-ripple:wave', onWave);
  }, []);
  return wavesRef;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { PaletteKey } from './palettes';
import { PALETTE_KEYS } from './palettes';

interface Props {
  paletteKey?: PaletteKey;
}

/**
 * Phase 6 B2 - SVG 动画层（移植 references/aaaa）
 *
 * 全屏 svg overlay（fixed inset-0 + pointer-events:none），监听 keydown 触发动画。
 * 与 patatap Two.js 版本独立，目前仅 /test 页用。
 */
export default function SvgAnimationLayer({ paletteKey = 'grey' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [registered, setRegistered] = useState<string[]>([]);
  const [activePalette, setActivePalette] = useState<PaletteKey>(paletteKey);

  useEffect(() => {
    if (!svgRef.current) return;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { trigger, getRegisteredKeys } = await import('./engine');
      setRegistered([...getRegisteredKeys()]);

      const onKey = (e: KeyboardEvent) => {
        if (e.repeat) return;
        const key = e.key.toLowerCase();
        if (key.length !== 1 || !/[a-z]/.test(key)) return;
        if (svgRef.current) trigger(svgRef.current, key, activePalette);
      };
      window.addEventListener('keydown', onKey);
      cleanup = () => window.removeEventListener('keydown', onKey);
    })();

    return () => cleanup?.();
  }, [activePalette]);

  return (
    <>
      <svg
        ref={svgRef}
        className="pointer-events-none fixed inset-0 z-40 h-full w-full"
        aria-hidden="true"
      />
      {registered.length > 0 && (
        <div className="pointer-events-auto fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded bg-black/40 px-2 py-1 text-[10px] tracking-widest text-white/60">
          <span>svg:{registered.length}键</span>
          <select
            value={activePalette}
            onChange={(e) => setActivePalette(e.target.value as PaletteKey)}
            className="bg-transparent text-white/80 outline-none"
          >
            {PALETTE_KEYS.map((k) => (
              <option key={k} value={k} className="text-black">{k}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

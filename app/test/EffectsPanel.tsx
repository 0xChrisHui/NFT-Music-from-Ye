'use client';

import { useState } from 'react';
import {
  EFFECTS_META,
  type EffectsConfig,
} from '@/src/components/archipelago/effects-config';

interface Props {
  effects: EffectsConfig;
  onChange: (next: EffectsConfig) => void;
}

/**
 * v39 — 右下角浮动 effects 控制面板。默认折叠（仅显示 FX 计数按钮），
 * hover 或 click 展开 14 个复选框。每个 effect 切换后立即同步到 URL。
 */
export default function EffectsPanel({ effects, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const enabledCount = Object.values(effects).filter(Boolean).length;

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      <button
        type="button"
        className="rounded bg-black/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/70 transition hover:text-white"
        onClick={() => setOpen((o) => !o)}
      >
        FX · {enabledCount}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded border border-white/10 bg-black/85 p-3 backdrop-blur-sm">
          <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-white/40">
            effects · 实时切换 · URL 同步
          </div>
          {EFFECTS_META.map((m) => (
            <label
              key={m.key}
              className="flex cursor-pointer items-center gap-2 py-1 text-[11px] text-white/70 hover:text-white"
            >
              <input
                type="checkbox"
                checked={effects[m.key]}
                onChange={(e) =>
                  onChange({ ...effects, [m.key]: e.target.checked })
                }
                className="h-3 w-3 cursor-pointer"
              />
              <span className="w-10 text-[8.5px] uppercase tracking-[0.1em] text-white/30">
                {m.group}
              </span>
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

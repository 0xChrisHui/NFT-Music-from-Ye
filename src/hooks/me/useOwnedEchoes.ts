'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyEchoes } from '@/src/data/echo/client';
import type { EchoArchiveItem } from '@/src/data/echo/types';

type EchoSlice = {
  items: EchoArchiveItem[];
  phase: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  warning: string | null;
};

const EMPTY: EchoSlice = { items: [], phase: 'idle', error: null, warning: null };

export function useOwnedEchoes(input: {
  authenticated: boolean;
  evmAddress: string | null;
  getAccessToken: () => Promise<string | null>;
}) {
  const [slice, setSlice] = useState<EchoSlice>(EMPTY);
  const [refresh, setRefresh] = useState(0);
  const tokenRef = useRef(input.getAccessToken);
  useEffect(() => { tokenRef.current = input.getAccessToken; });

  useEffect(() => {
    let cancelled = false;
    if (!input.authenticated || !input.evmAddress) {
      setSlice(EMPTY);
      return () => { cancelled = true; };
    }
    setSlice((current) => ({ ...current, phase: 'loading', error: null }));
    async function execute() {
      try {
        const token = await tokenRef.current();
        if (!token) throw new Error('登录凭证暂不可用，请重新登录');
        const result = await fetchMyEchoes(token);
        if (cancelled) return;
        const warnings = [
          result.truncated ? `链上持有超过 ${result.echoes.length} 枚，仅显示前一部分` : null,
          result.originStatusUnavailable ? '来源状态暂不可用；当前持有列表仍以链上为准' : null,
        ].filter(Boolean);
        setSlice({ items: result.echoes, phase: 'ready', error: null, warning: warnings.join('；') || null });
      } catch (error) {
        if (cancelled) return;
        setSlice((current) => ({ ...current, phase: 'error',
          error: error instanceof Error ? error.message : '池中回声读取失败' }));
      }
    }
    void execute();
    return () => { cancelled = true; };
  }, [input.authenticated, input.evmAddress, refresh]);

  const retry = useCallback(() => setRefresh((value) => value + 1), []);
  return { ...slice, retry };
}

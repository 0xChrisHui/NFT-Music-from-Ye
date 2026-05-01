'use client';

import { useSyncExternalStore } from 'react';
import {
  DESKTOP_EFFECTS,
  MOBILE_EFFECTS,
  type EffectsConfig,
} from '../effects-config';

/**
 * v87 — 响应式 effects 默认值
 *
 * 视口宽 ≤ 767px（iPad 768 之下）→ MOBILE_EFFECTS（仅 comet/stars/aurora/bgRipples）
 * 否则                          → DESKTOP_EFFECTS（10 个全开）
 *
 * SSR / hydration：
 *   - 服务端 + 首次 client render 都返回 DESKTOP（getServerSnapshot 锁定）
 *   - 客户端 mount 后 matchMedia 命中手机即 re-render 切 MOBILE
 *   - 这正是 useSyncExternalStore 设计的外部状态订阅模式，React 18 不会 hydration warning
 *
 * 视口跨阈值（横竖屏切换 / 浏览器 resize）会自动重算，由 mq.change 事件驱动。
 */
const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useResponsiveDefaultEffects(): EffectsConfig {
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return isMobile ? MOBILE_EFFECTS : DESKTOP_EFFECTS;
}

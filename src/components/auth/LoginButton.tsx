'use client';

import { useAuth } from '@/src/hooks/useAuth';

/**
 * 登录按钮 — 未登录显示"登录"，已登录显示地址缩写
 */
export default function LoginButton() {
  const { ready, authenticated, evmAddress, login, logout } = useAuth();

  if (!ready) return null;

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
      >
        登录
      </button>
    );
  }

  // 已登录：打印完整地址到 console，显示缩写
  if (evmAddress) {
    console.log('evm_address:', evmAddress);
  }

  const short = evmAddress
    ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`
    : '已登录';

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
    >
      {short}
    </button>
  );
}

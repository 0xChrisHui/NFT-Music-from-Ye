import Archipelago from '@/src/components/archipelago/Archipelago';
import LoginButton from '@/src/components/auth/LoginButton';
import HomeJam from '@/src/components/jam/HomeJam';

/**
 * /test — 独立沙箱页，用于试验新前端方案（Phase 6 B2 探索阶段）。
 * 内容初始与 / 一致；本路由失败不影响主页。
 */
export default function TestPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-12 bg-black">
      <div className="absolute right-6 top-6">
        <LoginButton />
      </div>

      <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
        Ripples in the Pond <span className="text-white/30">— /test sandbox</span>
      </h1>

      <Archipelago />

      <HomeJam />
    </main>
  );
}

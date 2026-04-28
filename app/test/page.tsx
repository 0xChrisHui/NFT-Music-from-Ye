import Archipelago from '@/src/components/archipelago/Archipelago';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';

/**
 * /test - 独立沙箱页（Phase 6 B2 探索阶段）。
 *
 * 当前配置：
 * - 关闭 HomeJam 旧的 useKeyVisual 动画 → 改用 TestJam（仅音效 + 录制）
 * - 不挂 patatap Two.js AnimationLayer（搁置不删）
 * - 加 SvgAnimationLayer（移植 references/aaaa 的 12 个 SVG 动画，26 键映射）
 *
 * 主页 / 不受影响。
 */
export default function TestPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-12 bg-black">
      <div className="absolute right-6 top-6">
        <LoginButton />
      </div>

      <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
        Ripples in the Pond <span className="text-white/30">— /test sandbox · SVG 动画</span>
      </h1>

      <Archipelago />

      <TestJam />

      <SvgAnimationLayer paletteKey="grey" />
    </main>
  );
}

'use client';

/**
 * 极光漫流 (E18)
 * v86 — 出现频率再降：周期 50-80s，静默 ~70%（之前 18-30s/30% 静默）
 *       4 块独立 animation-delay 错开出场，避免齐步显隐
 */

export default function AuroraBackground() {
  return (
    <>
      <style>{`
        @keyframes aurora-drift-a {
          0%   { transform: translate(-28%, -18%) scale(1.0) rotate(0deg);  opacity: 0; }
          30%  { opacity: 1; }
          40%  { transform: translate( 22%,  10%) scale(1.4) rotate(15deg); opacity: 1; }
          55%  { transform: translate( 14%, -22%) scale(1.1) rotate(-12deg); opacity: 1; }
          70%  { opacity: 0; }
          100% { transform: translate(-28%, -18%) scale(1.0) rotate(0deg);  opacity: 0; }
        }
        @keyframes aurora-drift-b {
          0%   { transform: translate( 18%, 24%) scale(1.2) rotate(0deg);   opacity: 0; }
          32%  { opacity: 1; }
          42%  { transform: translate(-20%, -14%) scale(0.85) rotate(-18deg); opacity: 1; }
          55%  { transform: translate(-8%,  16%) scale(1.3) rotate(10deg);  opacity: 1; }
          68%  { opacity: 0; }
          100% { transform: translate( 18%, 24%) scale(1.2) rotate(0deg);   opacity: 0; }
        }
        @keyframes aurora-drift-c {
          0%   { transform: translate(-14%,  8%) scale(1.05) rotate(0deg);  opacity: 0; }
          30%  { opacity: 1; }
          50%  { transform: translate( 20%, -20%) scale(1.4) rotate(20deg); opacity: 1; }
          70%  { opacity: 0; }
          100% { transform: translate(-14%,  8%) scale(1.05) rotate(0deg);  opacity: 0; }
        }
        @keyframes aurora-drift-d {
          0%   { transform: translate( 0%, -22%) scale(1.15) rotate(0deg);  opacity: 0; }
          32%  { opacity: 1; }
          50%  { transform: translate( 16%, 18%) scale(0.9) rotate(-22deg); opacity: 1; }
          68%  { opacity: 0; }
          100% { transform: translate( 0%, -22%) scale(1.15) rotate(0deg);  opacity: 0; }
        }
      `}</style>
      <div
        className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 30% 35%, rgba(90,53,137,0.30) 0%, rgba(90,53,137,0) 70%)',
            animation: 'aurora-drift-a 50s ease-in-out infinite',
            animationDelay: '0s',
            willChange: 'transform, opacity',
            opacity: 0,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 45% at 72% 65%, rgba(47,110,90,0.27) 0%, rgba(47,110,90,0) 70%)',
            animation: 'aurora-drift-b 60s ease-in-out infinite',
            animationDelay: '-22s',
            willChange: 'transform, opacity',
            opacity: 0,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(50% 40% at 60% 30%, rgba(50,90,140,0.24) 0%, rgba(50,90,140,0) 70%)',
            animation: 'aurora-drift-c 70s ease-in-out infinite',
            animationDelay: '-45s',
            willChange: 'transform, opacity',
            opacity: 0,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(50% 40% at 40% 75%, rgba(140,55,100,0.22) 0%, rgba(140,55,100,0) 70%)',
            animation: 'aurora-drift-d 80s ease-in-out infinite',
            animationDelay: '-65s',
            willChange: 'transform, opacity',
            opacity: 0,
          }}
        />
      </div>
    </>
  );
}

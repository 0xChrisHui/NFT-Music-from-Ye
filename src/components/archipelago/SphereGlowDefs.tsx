/**
 * SVG glow filters（feGaussianBlur）— 抽出复用，避免 SphereCanvas 超 200 行
 * 来自 sound-spheres line 295-303
 */
export default function SphereGlowDefs() {
  return (
    <defs>
      <filter id="glow-soft" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation={5} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-strong" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation={10} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

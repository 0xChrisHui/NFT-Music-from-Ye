'use client';

import { useEffect, useMemo, useRef } from 'react';
import { type Simulation } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { Track } from '@/src/types/tracks';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import SphereNode from './SphereNode';
import {
  computeNodeAttrs,
  getGroupTracks,
  type GroupId,
  type SimNode,
  type SimLink,
} from './sphere-config';
import { setupSimulation, attachDrag } from './sphere-sim-setup';

/**
 * Phase 6 B2.1 v3 — sound-spheres 完整复刻
 *
 * 新增 vs v2：
 * - <defs> glow-soft / glow-strong feGaussianBlur filter（节点发光感）
 * - currentGroupId prop 按 group 过滤节点（A/B/C 各 36 首切换显示）
 * - <g zoom-g> 包裹内容支持 d3.zoom（滚轮缩放 + 双击 reset + Escape reset）
 *
 * 物理 / drag / "永远可拖" 同 v2 不变（严格按 sound-spheres）；
 * D3 simulation + drag 抽到 ./sphere-sim-setup.ts（220 行硬线）
 */

interface Props {
  tracks: Track[];
  currentGroupId: GroupId;
  mintedIds: Set<number>;
  onMinted: (tokenId: number) => void;
}

export default function SphereCanvas({
  tracks,
  currentGroupId,
  mintedIds,
  onMinted,
}: Props) {
  const { playing, currentTrack, toggle } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;

  // 当前 group 的 36 个 tracks → SimNode（带 group/importance/radius/color）
  const simNodes = useMemo<SimNode[]>(
    () =>
      getGroupTracks(currentGroupId, tracks).map((t) => ({
        id: t.id,
        track: t,
        ...computeNodeAttrs(t, currentGroupId),
      })),
    [tracks, currentGroupId],
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGRef = useRef<SVGGElement | null>(null);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);

  // ── D3 force simulation + drag（每次 currentGroupId 变化重新构建）──
  useEffect(() => {
    if (!svgRef.current || simNodes.length === 0) return;

    const W = svgRef.current.clientWidth || 800;
    const H = svgRef.current.clientHeight || 600;

    const sim = setupSimulation(simNodes, W, H, () => {
      simNodes.forEach((n, i) => {
        const el = nodeRefs.current[i];
        if (el && n.x != null && n.y != null) {
          el.setAttribute('transform', `translate(${n.x},${n.y})`);
        }
      });
    });

    simRef.current = sim;
    attachDrag(nodeRefs.current, simNodes, sim);

    return () => {
      sim.stop();
    };
  }, [simNodes]);

  // ── d3.zoom（滚轮缩放 + 双击 reset + Escape reset）──
  useEffect(() => {
    if (!svgRef.current || !zoomGRef.current) return;
    const svgSel = select(svgRef.current);
    const zoomG = select(zoomGRef.current);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (e) => {
        zoomG.attr('transform', e.transform.toString());
      });

    svgSel.call(zoomBehavior);
    // 双击 reset zoom（不装 d3-transition，instant reset；CSS transform transition 由浏览器接管）
    svgSel.on('dblclick.zoom', null).on('dblclick', () => {
      svgSel.call(zoomBehavior.transform, zoomIdentity);
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        svgSel.call(zoomBehavior.transform, zoomIdentity);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing">
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
      <g ref={zoomGRef}>
        {simNodes.map((n, i) => {
          const dimmed = playingId !== null && playingId !== n.track.id;
          const isPlaying = playingId === n.track.id;
          return (
            <g
              key={n.id}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              style={{
                opacity: dimmed ? 0 : 1,
                transition: 'opacity 0.5s ease',
              }}
            >
              <SphereNode
                track={n.track}
                importance={n.importance}
                radius={n.radius}
                color={n.color}
                isPlaying={isPlaying}
                alreadyMinted={mintedIds.has(n.track.week)}
                onMinted={onMinted}
                onTogglePlay={() => {
                  if (n._dragged) return;
                  toggle(n.track);
                }}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

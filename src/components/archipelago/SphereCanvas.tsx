'use client';

import { useEffect, useMemo, useRef } from 'react';
import { type Simulation } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { Track } from '@/src/types/tracks';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import SphereNode from './SphereNode';
import SphereGlowDefs from './SphereGlowDefs';
import {
  computeNodeAttrs,
  generateLinks,
  getGroupTracks,
  padTracksToTarget,
  type GroupId,
  type SimNode,
  type SimLink,
} from './sphere-config';
import { setupSimulation, attachDrag } from './sphere-sim-setup';

/**
 * Phase 6 B2.1 v4 — sound-spheres 完整复刻 + DB 数据稀少时 padding 测试视觉
 *
 * v4 修复:
 * - DB 只 5 首 tracks → padding 到 36（循环复用，week 改 1-36 让颜色/大小各异）
 * - 飞出屏幕 → sphere-sim-setup 加 forceX/Y + center.strength 0.1 + tick clamp
 * - 加可见连接线（sound-spheres line 122-127 + 590-599 完整复刻）
 *
 * 物理 / drag / glow / hover / zoom 同 v3 不变
 */

const TARGET_NODE_COUNT = 36;

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

  // 当前 group 的 tracks → padding 到 36（DB 仅 5 首样本时复用真实数据）
  const tracksToShow = useMemo<Track[]>(
    () => padTracksToTarget(getGroupTracks(currentGroupId, tracks), TARGET_NODE_COUNT),
    [tracks, currentGroupId],
  );

  const simNodes = useMemo<SimNode[]>(
    () =>
      tracksToShow.map((t) => ({
        id: t.id,
        track: t,
        ...computeNodeAttrs(t, currentGroupId),
      })),
    [tracksToShow, currentGroupId],
  );

  const simLinks = useMemo<SimLink[]>(() => generateLinks(simNodes), [simNodes]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGRef = useRef<SVGGElement | null>(null);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);

  // ── D3 force simulation + drag + line tick（每次 currentGroupId 变化重建）──
  useEffect(() => {
    if (!svgRef.current || simNodes.length === 0) return;

    const W = svgRef.current.clientWidth || 800;
    const H = svgRef.current.clientHeight || 600;

    const sim = setupSimulation(simNodes, simLinks, W, H, () => {
      // 节点 transform
      simNodes.forEach((n, i) => {
        const el = nodeRefs.current[i];
        if (el && n.x != null && n.y != null) {
          el.setAttribute('transform', `translate(${n.x},${n.y})`);
        }
      });
      // 连接线 x1/y1/x2/y2（forceLink 已把 source/target string 替换为 SimNode 引用）
      simLinks.forEach((l, i) => {
        const lineEl = lineRefs.current[i];
        const src = l.source as SimNode;
        const tgt = l.target as SimNode;
        if (lineEl && src.x != null && src.y != null && tgt.x != null && tgt.y != null) {
          lineEl.setAttribute('x1', String(src.x));
          lineEl.setAttribute('y1', String(src.y));
          lineEl.setAttribute('x2', String(tgt.x));
          lineEl.setAttribute('y2', String(tgt.y));
        }
      });
    });

    simRef.current = sim;
    attachDrag(nodeRefs.current, simNodes, sim);

    return () => {
      sim.stop();
    };
  }, [simNodes, simLinks]);

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
      <SphereGlowDefs />
      <g ref={zoomGRef}>
        {/* 连接线层（在节点下面，避免遮挡）*/}
        <g>
          {simLinks.map((l, i) => {
            const src = simNodes.find((n) => n.id === (typeof l.source === 'string' ? l.source : (l.source as SimNode).id));
            const strokeColor = src?.color ?? '#888';
            return (
              <line
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                stroke={strokeColor}
                strokeWidth={0.4 + l.correlation * 1.4}
                strokeOpacity={0.05 + l.correlation * 0.13}
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })}
        </g>
        {/* 节点层 */}
        <g>
          {simNodes.map((n, i) => {
            const dimmed = playingId !== null && playingId !== n.track.id;
            const isPlaying = playingId === n.track.id;
            return (
              <g
                key={n.id}
                ref={(el) => { nodeRefs.current[i] = el; }}
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
      </g>
    </svg>
  );
}

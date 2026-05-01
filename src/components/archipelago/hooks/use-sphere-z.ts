'use client';

import { useMemo } from 'react';
import { halton, hashStr, type SimNode } from '../sphere-config';

/**
 * v36 — 假 3D z 计算：每 cluster 一个 baseZ（halton 0-1 均匀），
 * v49 — 每球在 baseZ ± 0.3 范围内 deterministic jitter，让聚落内球也有前后层级
 *       一个 cluster 可同时出现 z=0.2 / 0.8 / 0.75 等跨度大的球
 *
 * 渲染时按 sortedNodes 顺序（z 升序），远先画近后画 — 自动 painter z-order。
 */
export function useSphereZ(
  simNodes: SimNode[],
  assignment: Map<string, number>,
  clusterCount: number,
): { zMap: Map<string, number>; sortedNodes: SimNode[] } {
  const clusterZ = useMemo(
    () => Array.from({ length: clusterCount }, (_, i) => halton(i + 1, 5)),
    [clusterCount],
  );
  const zMap = useMemo(() => {
    const m = new Map<string, number>();
    simNodes.forEach((n) => {
      const baseZ = clusterZ[assignment.get(n.id) ?? 0] ?? 0.5;
      const h = hashStr(n.id);
      // ±0.3 jitter（deterministic by id），让同 cluster 球 z 跨度可达 0.6
      const jitter = ((h % 601) / 1000) - 0.3;
      m.set(n.id, Math.max(0, Math.min(1, baseZ + jitter)));
    });
    return m;
  }, [simNodes, assignment, clusterZ]);
  const sortedNodes = useMemo(
    () => [...simNodes].sort((a, b) => (zMap.get(a.id) ?? 0.5) - (zMap.get(b.id) ?? 0.5)),
    [simNodes, zMap],
  );
  return { zMap, sortedNodes };
}

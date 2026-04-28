import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceLink,
  type Simulation,
} from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import { CFG, generateLinks, type SimNode, type SimLink } from './sphere-config';

/**
 * Phase 6 B2.1 — D3 force simulation + drag 的纯函数 setup
 * 从 SphereCanvas 抽出（220 行硬线）— 不是 hook，仅函数提取，行为完全不变
 *
 * setupSimulation: 构建 sim + 绑 tick 回调；返回 instance 给 useEffect cleanup
 * attachDrag: 把 sound-spheres 风格的 drag 行为应用到所有 node group
 */

export function setupSimulation(
  simNodes: SimNode[],
  width: number,
  height: number,
  onTick: () => void,
): Simulation<SimNode, SimLink> {
  const cx = width / 2;
  const cy = height / 2;

  // 初始位置：圆心附近随机散开
  simNodes.forEach((n) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 100;
    n.x = cx + Math.cos(angle) * dist;
    n.y = cy + Math.sin(angle) * dist;
    n.vx = 0;
    n.vy = 0;
    delete n.fx;
    delete n.fy;
  });

  const links = generateLinks(simNodes);

  return forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance((d) => CFG.linkBaseDist + (1 - d.correlation) * CFG.linkVariance)
        .strength((d) => d.correlation * 0.30),
    )
    .force(
      'charge',
      forceManyBody<SimNode>().strength(
        (d) => -(CFG.charge * (0.6 + d.importance * 0.8)),
      ),
    )
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius((d) => d.radius * 1.06 + 8)
        .strength(0.85)
        .iterations(4),
    )
    .force('center', forceCenter(cx, cy).strength(0.05))
    .alphaDecay(0.016)
    .velocityDecay(0.4)
    .on('tick', onTick);
}

/**
 * Drag 行为照抄 sound-spheres line 661-679：
 * - drag start 不重启 sim（避免单击触发抖动）
 * - 实际 mousemove 才标 _dragged + alphaTarget(0.08).restart()
 * - drag end alphaTarget(0) 让 sim 衰减回稳定（"永远可拖" 通过下次 drag 重启实现）
 */
export function attachDrag(
  els: (SVGGElement | null)[],
  nodes: SimNode[],
  sim: Simulation<SimNode, SimLink>,
): void {
  const dragBehavior = drag<SVGGElement, SimNode>()
    .on('start', (e, d) => {
      d._dragged = false;
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (e, d) => {
      if (!d._dragged) {
        d._dragged = true;
        if (!e.active) sim.alphaTarget(0.08).restart();
      }
      d.fx = e.x;
      d.fy = e.y;
    })
    .on('end', (e, d) => {
      if (!e.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });

  els.forEach((el, i) => {
    if (el) {
      select<SVGGElement, SimNode>(el).datum(nodes[i]).call(dragBehavior);
    }
  });
}

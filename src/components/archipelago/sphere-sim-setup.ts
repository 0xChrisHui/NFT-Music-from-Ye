import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceLink,
  forceX,
  forceY,
  type Simulation,
} from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import { CFG, type SimNode, type SimLink } from './sphere-config';

/**
 * Phase 6 B2.1 — D3 force simulation + drag 的纯函数 setup
 * 从 SphereCanvas 抽出（220 行硬线）— 不是 hook，仅函数提取，行为完全不变
 *
 * v3 修复（2026-04-27）：
 * - 加 forceX + forceY 0.06 strength（柔和朝中心拉，不依赖 forceCenter 单点）
 * - center.strength 0.05 → 0.1（更强收敛）
 * - tick 内 clamp x/y 到画布边界（最后保险，不会飞出屏幕）
 * - setupSimulation 接 links 参数（外部 generate，方便和渲染层共享）
 */

const PAD = 60; // 节点距画布边界保留空间

export function setupSimulation(
  simNodes: SimNode[],
  links: SimLink[],
  width: number,
  height: number,
  onTick: () => void,
): Simulation<SimNode, SimLink> {
  const cx = width / 2;
  const cy = height / 2;

  // 初始位置：圆心附近更大范围扩散（避免开局拥挤剧烈抖动）
  simNodes.forEach((n) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 200;
    n.x = cx + Math.cos(angle) * dist;
    n.y = cy + Math.sin(angle) * dist;
    n.vx = 0;
    n.vy = 0;
    delete n.fx;
    delete n.fy;
  });

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
      // charge 280 → 180（减弱排斥力，进入时不那么剧烈）
      forceManyBody<SimNode>().strength(
        (d) => -(180 * (0.6 + d.importance * 0.8)),
      ),
    )
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius((d) => d.radius * 1.06 + 8)
        .strength(0.85)
        .iterations(4),
    )
    .force('center', forceCenter(cx, cy).strength(0.1))
    .force('x', forceX(cx).strength(0.06))
    .force('y', forceY(cy).strength(0.06))
    .alphaDecay(0.016)
    .velocityDecay(0.4)
    // 持续保持流动 — 极弱的 alpha 让节点缓慢漂浮，不固化
    .alphaTarget(0.02)
    .on('tick', () => {
      // clamp x/y 到画布内（防极端 charge 把节点推飞）
      simNodes.forEach((n) => {
        if (n.x != null) n.x = Math.max(PAD, Math.min(width - PAD, n.x));
        if (n.y != null) n.y = Math.max(PAD, Math.min(height - PAD, n.y));
      });
      onTick();
    });
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

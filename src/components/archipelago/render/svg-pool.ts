/**
 * v87 K 方案 — SVG element 对象池
 *
 * 高频重建的元素改为复用：每帧 reset 计数，请求时从池里拿（满了才 createElementNS），
 * 用完元素自动 display:none，下帧 get 时 removeAttribute('display') 复活。
 *
 * 用法：
 *   const pool = makePool(layer, 'circle', (el) => el.setAttribute('fill', 'white'));
 *   // 每帧:
 *   pool.reset();           // 隐藏上帧未用的，计数归零
 *   const el = pool.get();  // 拿下一个（复用 or 新建）
 *   el.setAttribute('cx', ...);
 *
 * 池子只增不减——单次 spike 后保留容量。SVG 元素 ~300 个内存负担可忽略。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SvgPool<T extends SVGElement> {
  get(): T;
  reset(): void;
}

export function makePool<T extends SVGElement>(
  layer: SVGGElement,
  tagName: string,
  init?: (el: T) => void,
): SvgPool<T> {
  const items: T[] = [];
  let used = 0;
  return {
    get(): T {
      let el: T;
      if (used >= items.length) {
        el = document.createElementNS(SVG_NS, tagName) as T;
        if (init) init(el);
        layer.appendChild(el);
        items.push(el);
      } else {
        el = items[used];
        if (el.getAttribute('display')) el.removeAttribute('display');
      }
      used++;
      return el;
    },
    reset(): void {
      for (let i = used; i < items.length; i++) {
        items[i].setAttribute('display', 'none');
      }
      used = 0;
    },
  };
}

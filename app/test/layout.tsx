import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * /test sandbox — D2 决策：长期保留作为 FX 试验场，但不应被搜索引擎收录。
 * 同步部署到 .xyz/test 但不放任何外部入口链接。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TestLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

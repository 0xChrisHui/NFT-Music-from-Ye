import 'server-only';
// Arweave 运行时入口：带 server-only 守护，防止客户端组件误引入。
// scripts/ 下的一次性脚本请改为 import '../src/lib/arweave/core'（绕开本守护）。

export {
  ARWEAVE_GATEWAYS,
  resolveArUrl,
  fetchFromArweave,
  uploadBuffer,
} from './core';
export type { ArweaveGateway, UploadResult } from './core';

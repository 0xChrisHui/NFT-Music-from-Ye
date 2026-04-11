// Arweave 多网关 CORS 实测 —— Phase 3 S0 硬门槛
// 用法：
//   npx tsx scripts/arweave/verify-arweave-cors.ts           # 用 /info 端点测网关活性 + CORS
//   npx tsx scripts/arweave/verify-arweave-cors.ts <txId>    # 用真实文件测（S0.b 后跑）
// 判定：ARWEAVE_GATEWAYS 中至少 2 个网关满足 {status ok + Access-Control-Allow-Origin 合规}

import '../_env';
import { ARWEAVE_GATEWAYS } from '../../src/lib/arweave/core';

const MOCK_ORIGIN = 'https://ripples-in-the-pond.example';
const MIN_PASS = 2;

type Result = {
  gateway: string;
  ok: boolean;
  status: number;
  cors: string | null;
  error?: string;
};

async function probe(gateway: string, path: string): Promise<Result> {
  try {
    const res = await fetch(`${gateway}${path}`, {
      method: 'GET',
      headers: { Origin: MOCK_ORIGIN },
    });
    return {
      gateway,
      ok: res.ok,
      status: res.status,
      cors: res.headers.get('access-control-allow-origin'),
    };
  } catch (e) {
    return {
      gateway,
      ok: false,
      status: 0,
      cors: null,
      error: (e as Error).message,
    };
  }
}

function corsOk(header: string | null): boolean {
  if (!header) return false;
  return header === '*' || header === MOCK_ORIGIN;
}

async function main() {
  const txId = process.argv[2];
  const path = txId ? `/${txId}` : '/info';
  console.log('── Arweave CORS 实测 ──');
  console.log(`路径    : ${path}`);
  console.log(`Origin  : ${MOCK_ORIGIN}`);
  console.log(`网关数  : ${ARWEAVE_GATEWAYS.length}\n`);

  const results = await Promise.all(
    ARWEAVE_GATEWAYS.map((gw) => probe(gw, path)),
  );

  let passCount = 0;
  for (const r of results) {
    const pass = r.ok && corsOk(r.cors);
    const mark = pass ? '✅' : '❌';
    const corsText = r.cors ?? '(none)';
    const errText = r.error ? ` err=${r.error}` : '';
    console.log(
      `${mark} ${r.gateway.padEnd(28)} status=${String(r.status).padStart(3)} CORS=${corsText}${errText}`,
    );
    if (pass) passCount++;
  }

  console.log(`\n通过：${passCount}/${ARWEAVE_GATEWAYS.length}  (要求 ≥ ${MIN_PASS})`);
  if (passCount < MIN_PASS) {
    console.error('❌ 硬门槛未达成');
    process.exit(1);
  }
  console.log('✅ 硬门槛达成');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

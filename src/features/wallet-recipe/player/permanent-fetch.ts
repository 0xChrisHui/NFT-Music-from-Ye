import type { PlayerError, WalletRecipePlayerErrorKind } from './types';

const TX_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const GATEWAYS = ['https://arweave.net', 'https://ario.permagate.io'] as const;
const TIMEOUT_MS = 12_000;

function playerError(kind: WalletRecipePlayerErrorKind, message: string): PlayerError {
  return Object.assign(new Error(message), { kind });
}

function txIdFromUri(uri: string): string {
  if (!uri.startsWith('ar://') || !TX_ID_PATTERN.test(uri.slice(5))) {
    throw playerError('invalid_input', '音频必须使用合法的 ar:// 永久引用');
  }
  return uri.slice(5);
}

async function fetchAttempt(
  url: string,
  fetcher: typeof fetch,
  parentSignal: AbortSignal,
): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const relayAbort = () => controller.abort(parentSignal.reason);
  parentSignal.addEventListener('abort', relayAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort('timeout'), TIMEOUT_MS);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.arrayBuffer();
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal.removeEventListener('abort', relayAbort);
  }
}

export async function fetchPermanentAudio(
  uri: string,
  expectedSha256: string,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const txId = txIdFromUri(uri);
  if (!SHA256_PATTERN.test(expectedSha256)) {
    throw playerError('invalid_input', '音频 SHA-256 格式无效');
  }
  const errors: string[] = [];
  let integrityFailed = false;
  for (const gateway of GATEWAYS) {
    try {
      const bytes = await fetchAttempt(`${gateway}/${txId}`, fetcher, signal);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const actual = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      if (actual !== expectedSha256) {
        throw playerError('integrity', '音频 SHA-256 与永久 metadata 不一致');
      }
      return bytes;
    } catch (error) {
      if (signal.aborted) throw error;
      if ((error as Partial<PlayerError>).kind === 'integrity') integrityFailed = true;
      errors.push(`${new URL(gateway).host} 失败`);
    }
  }
  if (integrityFailed) {
    throw playerError('integrity', '两个永久网关返回的音频均未通过 SHA-256 校验');
  }
  throw playerError('network', `两个永久网关均不可用（${errors.join('；')}）`);
}

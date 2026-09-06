import { createHash } from 'node:crypto';
import { ARWEAVE_GATEWAYS } from '../../../src/lib/arweave/core';

const REQUEST_ORIGIN = 'https://pond-ripple.xyz';

export type GatewayEvidence = {
  gateway: string;
  status: number | null;
  bytes: number | null;
  sha256: string | null;
  contentType: string | null;
  cors: string | null;
  ok: boolean;
  error: string | null;
};

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function verifyAssetOnGateways(input: {
  txId: string;
  expectedBytes: number;
  expectedSha256: string;
  expectedContentType: string;
}): Promise<GatewayEvidence[]> {
  return Promise.all(ARWEAVE_GATEWAYS.map(async (gateway): Promise<GatewayEvidence> => {
    try {
      const response = await fetch(`${gateway}/${input.txId}`, {
        headers: { Origin: REQUEST_ORIGIN },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        return {
          gateway, status: response.status, bytes: null, sha256: null,
          contentType: response.headers.get('content-type'),
          cors: response.headers.get('access-control-allow-origin'), ok: false, error: null,
        };
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const digest = sha256(buffer);
      const contentType = response.headers.get('content-type');
      const cors = response.headers.get('access-control-allow-origin');
      const corsOk = cors === '*' || cors === REQUEST_ORIGIN;
      const typeOk = contentType?.toLowerCase().startsWith(
        input.expectedContentType.toLowerCase(),
      ) ?? false;
      return {
        gateway, status: response.status, bytes: buffer.length, sha256: digest,
        contentType, cors, ok: buffer.length === input.expectedBytes
          && digest === input.expectedSha256 && typeOk && corsOk,
        error: null,
      };
    } catch (error) {
      return {
        gateway, status: null, bytes: null, sha256: null, contentType: null,
        cors: null, ok: false, error: error instanceof Error ? error.message : 'unknown',
      };
    }
  }));
}

import {
  ARWEAVE_TX_ID_PATTERN,
  POND_ECHO_COLLECTION_DESCRIPTION,
  POND_ECHO_COLLECTION_EXTERNAL_LINK,
} from './constants';

export type PondEchoCollectionMetadataV1 = {
  name: 'Pond Echoes';
  description: string;
  image: `ar://${string}`;
  external_link: string;
};

function assertExactKeys(value: Record<string, unknown>): void {
  const actual = Object.keys(value).sort();
  const expected = ['name', 'description', 'image', 'external_link'].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('collection metadata 字段合同不一致');
  }
}

export function buildPondEchoCollectionMetadataV1(
  imageTxId: string,
): PondEchoCollectionMetadataV1 {
  if (!ARWEAVE_TX_ID_PATTERN.test(imageTxId)) {
    throw new Error('collection image 必须是 43 位 Arweave txid');
  }
  return {
    name: 'Pond Echoes',
    description: POND_ECHO_COLLECTION_DESCRIPTION,
    image: `ar://${imageTxId}`,
    external_link: POND_ECHO_COLLECTION_EXTERNAL_LINK,
  };
}

export function serializePondEchoCollectionMetadataV1(imageTxId: string): string {
  return JSON.stringify(buildPondEchoCollectionMetadataV1(imageTxId));
}

export function parsePondEchoCollectionMetadataV1(
  value: unknown,
): PondEchoCollectionMetadataV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('collection metadata 必须是 JSON object');
  }
  const input = value as Record<string, unknown>;
  assertExactKeys(input);
  if (typeof input.image !== 'string' || !input.image.startsWith('ar://')) {
    throw new Error('collection image 必须是 ar:// URI');
  }
  const expected = buildPondEchoCollectionMetadataV1(input.image.slice(5));
  if (JSON.stringify(input) !== JSON.stringify(expected)) {
    throw new Error('collection metadata 内容合同不一致');
  }
  return expected;
}

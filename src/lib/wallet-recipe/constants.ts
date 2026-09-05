export const RECIPE_VERSION_V1 = 1 as const;
export const RECIPE_DOMAIN_V1 = 'RIPPLES_WALLET_RECIPE_V1';
export const RECIPE_CHARSET_V1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const RECIPE_LENGTH_V1 = 36;
export const RECIPE_REJECTION_LIMIT_V1 = 252;

export const CLIP_MANIFEST_COUNT_V1 = 36 as const;
export const WALLET_RECIPE_METADATA_MAX_BYTES = 32 * 1024;
export const POND_ECHO_EXTERNAL_ORIGIN_BASE_URL =
  'https://pond-ripple.xyz/echo/origin';
export const POND_ECHO_TOKEN_DESCRIPTION =
  'A deterministic 36-part score born from its origin wallet and triggered by the wallet\'s first ScoreNFT mint in Ripples in the Pond. It makes no promise of financial returns, price appreciation, or scarcity.';

export const ARWEAVE_TX_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export type RecipeV1 = string & { readonly __recipeV1: unique symbol };

export type P14ClipV1 = {
  key: string;
  fileName: string;
  bytes: number;
  mimeType: 'audio/mpeg';
  sha256: string;
  sampleRate: number;
  channels: number;
  frameCount: number;
  durationMs: number;
  arweaveTxId: string | null;
};

export type ClipManifestV1 = {
  version: 1;
  charset: string;
  count: 36;
  generatedAt: string;
  clips: P14ClipV1[];
  manifestSha256: string;
};

export type WalletRecipeMetadataClipV1 = {
  uri: `ar://${string}`;
  sha256: string;
  durationMs: number;
};

export type WalletRecipeMetadataV1 = {
  name: string;
  description: string;
  image: `ar://${string}`;
  animation_url: `ar://${string}`;
  external_url: string;
  attributes: [];
  properties: {
    recipeVersion: 1;
    recipe: RecipeV1;
    originWallet: `0x${string}`;
    sourceScoreTokenId: number;
    clipManifest: `ar://${string}`;
    clipManifestSha256: string;
    durationMs: number;
    clips: Record<string, WalletRecipeMetadataClipV1>;
  };
};

export type WalletRecipeEligibility = 'excluded_prelaunch' | 'eligible';

export type WalletRecipeQueueStatus =
  | 'excluded_prelaunch'
  | 'pending'
  | 'preparing_media'
  | 'uploading_metadata'
  | 'minting_onchain'
  | 'confirming_onchain'
  | 'safe_retry'
  | 'manual_review'
  | 'success';

export type WalletRecipeFailureKind =
  | 'transient'
  | 'safe_retry'
  | 'manual_review'
  | 'contract_rejected'
  | 'permanent_input';

export type WalletRecipeMetadataUploadState =
  | 'none'
  | 'uploading'
  | 'uploaded'
  | 'verified'
  | 'upload_result_unknown';

export type ArweaveUploadLedgerState = Exclude<
  WalletRecipeMetadataUploadState,
  'none'
>;

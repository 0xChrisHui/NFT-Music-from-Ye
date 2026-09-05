import { createHash } from 'node:crypto';
import { uploadBuffer } from '@/src/lib/arweave';
import { getWalletRecipePermanentConfig } from '@/src/lib/chain/wallet-recipe-contract';
import { CLIP_MANIFEST_V1 } from '@/src/features/wallet-recipe/clip-manifest';
import { decideUploadAction } from '@/src/features/wallet-recipe/pipeline-policy';
import {
  buildWalletRecipeMetadataJsonV1,
} from '@/src/lib/wallet-recipe/metadata';
import { supabaseAdmin } from '@/src/lib/supabase';
import { verifyPermanentObject } from './steps-media';
import { PipelineStepError, type PipelineStepResult, type WalletRecipeQueueRow } from './shared';

type UploadClaim = {
  ledger_id: string;
  upload_state: 'uploading' | 'uploaded' | 'verified' | 'upload_result_unknown';
  arweave_tx_id: string | null;
  claimed: boolean;
};

async function advanceUpload(input: {
  ledgerId: string;
  row: WalletRecipeQueueRow;
  leaseOwner: string;
  state: 'uploaded' | 'verified' | 'upload_result_unknown';
  txId?: string;
  error?: string;
}): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc('advance_wallet_recipe_metadata_upload', {
    p_ledger_id: input.ledgerId,
    p_queue_id: input.row.id,
    p_owner: input.leaseOwner,
    p_next_state: input.state,
    p_arweave_tx_id: input.txId ?? null,
    p_last_error: input.error?.slice(0, 2000) ?? null,
  });
  if (error) throw error;
  if (!data || data.length !== 1) {
    throw new PipelineStepError('metadata upload 推进时 lease 已丢失', 'manual_review');
  }
}

function buildStableMetadata(row: WalletRecipeQueueRow): { bytes: Buffer; sha256: string } {
  const config = getWalletRecipePermanentConfig();
  if (!config || row.image_ar_tx_id !== config.imageTxId) {
    throw new PipelineStepError('永久 metadata 输入未配置或封面身份漂移', 'permanent_input');
  }
  const json = buildWalletRecipeMetadataJsonV1({
    originWallet: row.origin_wallet,
    sourceScoreTokenId: row.source_score_token_id,
    imageTxId: config.imageTxId,
    decoderTxId: config.decoderTxId,
    clipManifestTxId: config.clipManifestTxId,
    clipManifest: CLIP_MANIFEST_V1,
  });
  const bytes = Buffer.from(json, 'utf8');
  const parsed = JSON.parse(json) as { properties?: { recipe?: string } };
  if (parsed.properties?.recipe !== row.recipe) {
    throw new PipelineStepError('队列 recipe 与 origin 派生结果不一致', 'permanent_input');
  }
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function stepUploadMetadata(
  row: WalletRecipeQueueRow,
  leaseOwner: string,
  deadlineAt: number,
): Promise<PipelineStepResult> {
  let built: ReturnType<typeof buildStableMetadata>;
  try {
    built = buildStableMetadata(row);
  } catch (error) {
    if (error instanceof PipelineStepError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new PipelineStepError(`metadata 永久输入无效：${message}`, 'permanent_input');
  }
  if (row.metadata_sha256 && row.metadata_sha256 !== built.sha256) {
    throw new PipelineStepError('metadata bytes hash 在重试中发生漂移', 'manual_review');
  }
  const { data, error } = await supabaseAdmin.rpc('claim_wallet_recipe_metadata_upload', {
    p_queue_id: row.id,
    p_owner: leaseOwner,
    p_content_sha256: built.sha256,
  });
  if (error) throw error;
  const claim = (data?.[0] ?? null) as UploadClaim | null;
  if (!claim) throw new PipelineStepError('metadata upload claim 被拒绝', 'manual_review');
  const action = decideUploadAction({
    state: claim.upload_state,
    claimed: claim.claimed,
    hasTxId: Boolean(claim.arweave_tx_id),
  });
  if (action === 'manual_review') {
    throw new PipelineStepError('metadata upload 结果未知，禁止自动重传', 'manual_review');
  }
  if (action === 'reuse' && claim.arweave_tx_id) {
    return { status: 'minting_onchain', detail: 'metadata_reused' };
  }
  if (action === 'verify' && claim.arweave_tx_id) {
    const downloaded = await verifyPermanentObject(claim.arweave_tx_id);
    if (downloaded.sha256 !== built.sha256) {
      throw new PipelineStepError('Arweave metadata hash 与冻结 bytes 不一致', 'permanent_input');
    }
    await advanceUpload({
      ledgerId: claim.ledger_id, row, leaseOwner, state: 'verified', txId: claim.arweave_tx_id,
    });
    return { status: 'minting_onchain', detail: 'metadata_verified' };
  }
  if (action === 'wait') {
    return { status: 'uploading_metadata', detail: 'upload_in_progress', failureKind: 'transient' };
  }

  const uploadBudgetMs = deadlineAt - Date.now() - 4_000;
  if (uploadBudgetMs <= 0) {
    return { status: 'uploading_metadata', detail: 'response_deadline', failureKind: 'transient' };
  }

  let uploaded: Awaited<ReturnType<typeof uploadBuffer>>;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      uploaded = await Promise.race([
        uploadBuffer(built.bytes, 'application/json'),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('上传在响应预算内未返回')),
            uploadBudgetMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await advanceUpload({
      ledgerId: claim.ledger_id,
      row,
      leaseOwner,
      state: 'upload_result_unknown',
      error: message,
    });
    throw new PipelineStepError(
      `metadata upload_result_unknown：${message}`,
      'manual_review',
    );
  }
  try {
    await advanceUpload({
      ledgerId: claim.ledger_id, row, leaseOwner, state: 'uploaded', txId: uploaded.txId,
    });
    return { status: 'uploading_metadata', detail: 'metadata_uploaded' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PipelineStepError(
      `metadata 已获 txid ${uploaded.txId}，但账本写入结果未知：${message}`,
      'manual_review',
    );
  }
}

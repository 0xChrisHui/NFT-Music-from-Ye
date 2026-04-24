import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/chain/operator-wallet';
import {
  MATERIAL_NFT_ADDRESS,
  MATERIAL_NFT_ABI,
} from '@/src/lib/chain/contracts';

/**
 * 素材 NFT 铸造的状态机 steps：
 *   tryConfirmMinting  — 查已发 tx 的 receipt，推进或回退
 *   trySendNew         — 抢 pending + 发 tx + 存 hash（严格区分链上 vs DB 失败）
 *   markSuccess        — 先写 mint_events 再 CAS 推进 status（防并发/丢资产）
 *   resetToPending     — 仅在"链上未发"或"链上 revert"这种安全场景下调用
 */

const MAX_RETRY = 3;
// minting_onchain 无 tx_hash 超过 3 分钟视为卡住
const STUCK_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * 查 minting_onchain 记录：
 * - 有 tx_hash → 查链上 receipt → 完成或回退
 * - 无 tx_hash + 超时 → 标记 failed 等人工核查（不能安全 reset，
 *   可能是链上已发但 DB 没存住 hash → reset 会导致重复 mint）
 */
export async function tryConfirmMinting() {
  const { data: job } = await supabaseAdmin
    .from('mint_queue')
    .select('id, user_id, token_id, tx_hash, retry_count, updated_at')
    .eq('status', 'minting_onchain')
    .order('updated_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) return null;

  if (!job.tx_hash) {
    const age = Date.now() - new Date(job.updated_at).getTime();
    if (age > STUCK_TIMEOUT_MS) {
      console.error(
        `[mint-queue] CRITICAL: job ${job.id} 卡在 minting_onchain 无 tx_hash 已 ${age}ms — 链上状态未知，标记 failed 等人工核查 operator 钱包 tx 历史`,
      );
      await supabaseAdmin
        .from('mint_queue')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'minting_onchain');
      return { result: 'stuck_needs_review', jobId: job.id };
    }
    return null; // 正在发送中，等下次
  }

  // 有 tx_hash → 查链上结果
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: job.tx_hash as `0x${string}`,
    });

    if (receipt.status === 'success') {
      await markSuccess(job.id, job.user_id, job.token_id, job.tx_hash);
      return { result: 'confirmed', jobId: job.id, txHash: job.tx_hash };
    }
    // 链上 revert → 安全回退重试（tx 已结束，重新跑不会双重 mint）
    await resetToPending(job.id, job.retry_count);
    return { result: 'chain_failed', jobId: job.id };
  } catch {
    // receipt 还没出来（pending tx）→ 等下次
    return null;
  }
}

/** 抢一条 pending → 发交易 → 立刻存 tx_hash → 返回 */
export async function trySendNew() {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_pending_job');
  if (error || !jobs || jobs.length === 0) return null;

  const job = jobs[0];

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('evm_address')
    .eq('id', job.user_id)
    .single();

  if (!user) {
    await supabaseAdmin
      .from('mint_queue')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return { result: 'no_user', jobId: job.id };
  }

  // 严格区分：链上 send 失败（安全 reset）vs DB 写 tx_hash 失败（不能 reset 会重发）
  let txHash: `0x${string}`;
  try {
    txHash = await operatorWalletClient.writeContract({
      address: MATERIAL_NFT_ADDRESS,
      abi: MATERIAL_NFT_ABI,
      functionName: 'mint',
      args: [
        user.evm_address as `0x${string}`,
        BigInt(job.token_id),
        1n,
        '0x',
      ],
    });
  } catch (err) {
    console.error('[mint-queue] chain send failed:', err);
    await resetToPending(job.id, job.retry_count);
    return { result: 'send_failed', jobId: job.id };
  }

  // tx 已广播 — 下面任何失败都不能 resetToPending（否则重复 mint）
  const { error: dbErr } = await supabaseAdmin
    .from('mint_queue')
    .update({ tx_hash: txHash, updated_at: new Date().toISOString() })
    .eq('id', job.id);

  if (dbErr) {
    console.error(
      `[mint-queue] CRITICAL: tx ${txHash} 已上链但 DB 写 tx_hash 失败 job=${job.id}: ${dbErr.message}. 人工核查: UPDATE mint_queue SET tx_hash='${txHash}' WHERE id='${job.id}'`,
    );
    // 保持 minting_onchain + tx_hash=null，STUCK_TIMEOUT_MS 后会标记 failed 而非 reset
    return { result: 'db_write_failed', jobId: job.id, txHash };
  }

  return { result: 'sent', jobId: job.id, txHash };
}

async function markSuccess(
  jobId: string, userId: string, tokenId: number, txHash: string,
) {
  const { data: track } = await supabaseAdmin
    .from('tracks')
    .select('id')
    .eq('week', tokenId)
    .single();

  if (!track) {
    console.error(
      `[mint-queue] track not found for week=${tokenId} job=${jobId} — 标记 failed 等人工补 track`,
    );
    await supabaseAdmin
      .from('mint_queue')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'minting_onchain');
    return;
  }

  // 1. 先写永久记录（UNIQUE(mint_queue_id) 保证 upsert 幂等）
  const { error: eventErr } = await supabaseAdmin.from('mint_events').upsert(
    {
      mint_queue_id: jobId,
      user_id: userId,
      track_id: track.id,
      token_id: tokenId,
      tx_hash: txHash,
    },
    { onConflict: 'mint_queue_id' },
  );

  if (eventErr) {
    // mint_events 未落盘 — 保持 minting_onchain，下次 cron 查 receipt 会再进 markSuccess
    console.error(
      `[mint-queue] mint_events 写入失败 job=${jobId}: ${eventErr.message}，保持 minting_onchain 待下次重试`,
    );
    throw new Error(`mint_events write failed: ${eventErr.message}`);
  }

  // 2. 永久记录已落盘后才推进状态（CAS 防并发重复标 success）
  await supabaseAdmin
    .from('mint_queue')
    .update({ status: 'success', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'minting_onchain');
}

async function resetToPending(jobId: string, retryCount: number) {
  const newStatus = retryCount + 1 >= MAX_RETRY ? 'failed' : 'pending';
  await supabaseAdmin
    .from('mint_queue')
    .update({
      status: newStatus,
      tx_hash: null,
      retry_count: retryCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

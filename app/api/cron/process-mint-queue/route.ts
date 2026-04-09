import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/operator-wallet';
import {
  MATERIAL_NFT_ADDRESS,
  MATERIAL_NFT_ABI,
} from '@/src/lib/contracts';

/**
 * GET /api/cron/process-mint-queue?secret=xxx
 * 从 mint_queue 取一条 pending → 调合约 mint → 更新 status
 * 一次只处理一条（nonce 串行要求）
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 验证 secret
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
    }

    // 2. 取一条 pending 记录（按创建时间排序，最早的优先）
    const { data: job, error: fetchError } = await supabaseAdmin
      .from('mint_queue')
      .select('id, user_id, token_id, retry_count')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ result: 'ok', processed: 0 });
    }

    // 3. 标记为处理中（防止重复处理）
    await supabaseAdmin
      .from('mint_queue')
      .update({ status: 'minting_onchain', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    // 4. 查用户的 evm_address
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
      return NextResponse.json({ error: '找不到用户' }, { status: 500 });
    }

    // 5. 调合约 mint（运营钱包代付 gas）
    const txHash = await operatorWalletClient.writeContract({
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

    // 6. 等交易确认
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === 'success') {
      await supabaseAdmin
        .from('mint_queue')
        .update({
          status: 'success',
          tx_hash: txHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    } else {
      throw new Error('交易回滚');
    }

    return NextResponse.json({ result: 'ok', processed: 1, txHash });
  } catch (err) {
    console.error('cron process-mint-queue error:', err);

    // 失败时 retry_count++，状态回到 pending（下次重试）
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret === process.env.CRON_SECRET) {
      const { data: job } = await supabaseAdmin
        .from('mint_queue')
        .select('id, retry_count')
        .eq('status', 'minting_onchain')
        .limit(1)
        .single();

      if (job) {
        const newStatus = job.retry_count >= 3 ? 'failed' : 'pending';
        await supabaseAdmin
          .from('mint_queue')
          .update({
            status: newStatus,
            retry_count: job.retry_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }

    return NextResponse.json(
      { error: '处理失败' },
      { status: 500 },
    );
  }
}

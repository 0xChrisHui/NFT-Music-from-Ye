import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';

/**
 * POST /api/mint/material
 * 前端调用 → 验证身份 → 写一条 pending 记录到 mint_queue → 立刻返回
 * 不在这里调合约（由 cron 异步处理）
 */

export async function POST(req: NextRequest) {
  try {
    // 1. 统一身份验证（含自动创建用户）
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 2. 解析请求体（只认 tokenId，idempotencyKey 后端自己合成稳定值防并发）
    const body = await req.json();
    const { tokenId } = body as { tokenId: number };

    if (!tokenId || !Number.isInteger(tokenId)) {
      return NextResponse.json({ error: '缺少或非法 tokenId' }, { status: 400 });
    }

    const userId = auth.userId;

    // 3. 同一用户 + 同一素材不重复铸造（success 已存在 → 明确 409）
    const { data: alreadyMinted } = await supabaseAdmin
      .from('mint_events')
      .select('id')
      .eq('user_id', userId)
      .eq('token_id', tokenId)
      .limit(1)
      .maybeSingle();

    if (alreadyMinted) {
      return NextResponse.json({ error: '你已经铸造过这个素材', alreadyMinted: true }, { status: 409 });
    }

    // 4. 合成稳定 idempotencyKey — 防止并发重复入队的核心
    // 靠 mint_queue UNIQUE(idempotency_key) 把并发两次收藏压到一次插入
    const idempotencyKey = `mint-${userId}-${tokenId}`;

    const { data: mint, error: mintError } = await supabaseAdmin
      .from('mint_queue')
      .insert({
        idempotency_key: idempotencyKey,
        user_id: userId,
        mint_type: 'material',
        token_id: tokenId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (mintError) {
      // unique 冲突 = 已有同 (user,token) 的 job — 查出返回（pending/minting/failed 都复用）
      if (mintError.code === '23505') {
        const { data: existing } = await supabaseAdmin
          .from('mint_queue')
          .select('id, status')
          .eq('idempotency_key', idempotencyKey)
          .single();
        if (existing) {
          return NextResponse.json({ result: 'ok', mintId: existing.id, status: existing.status });
        }
      }
      throw mintError;
    }

    return NextResponse.json({ result: 'ok', mintId: mint.id, status: 'pending' });
  } catch (err) {
    console.error('POST /api/mint/material error:', err);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 },
    );
  }
}

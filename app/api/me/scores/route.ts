import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { MyScoresResponse } from '@/src/types/jam';

/**
 * GET /api/me/scores
 * 返回当前用户未过期的草稿列表，个人页草稿区域消费。
 * 只返回 status='draft' 且 expires_at > now() 的记录。
 */

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export async function GET(req: NextRequest) {
  try {
    // 1. 验证登录
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少 Authorization header' }, { status: 401 });
    }
    const claims = await privy.verifyAuthToken(authHeader.slice(7));
    const privyUserId = claims.userId;

    // 2. 查找用户
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('privy_user_id', privyUserId)
      .single();

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    // 3. 查未过期草稿，联表拿曲目名称
    const { data: scores, error } = await supabaseAdmin
      .from('pending_scores')
      .select('id, created_at, expires_at, track_id, tracks(title)')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const res: MyScoresResponse = {
      scores: (scores ?? []).map((s) => {
        const trackData = s.tracks as unknown as { title: string } | null;
        return {
          id: s.id,
          trackTitle: trackData?.title ?? '未知曲目',
          createdAt: s.created_at,
          expiresAt: s.expires_at,
        };
      }),
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/me/scores error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { TrackDetailResponse } from '@/src/types/tracks';

/**
 * GET /api/tracks/[id]
 * 返回单曲详情 + 当前用户是否已铸造 / 是否有 pending 请求
 * 不带 Authorization 时 minted=false, pending=false
 */

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. 查 track
    const { data: track, error } = await supabaseAdmin
      .from('tracks')
      .select('id, title, week, audio_url, cover, island, created_at')
      .eq('id', id)
      .single();

    if (error || !track) {
      return NextResponse.json({ error: '曲目不存在' }, { status: 404 });
    }

    // 2. 尝试识别当前用户（可选，不强制登录）
    let minted = false;
    let pending = false;

    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const claims = await privy.verifyAuthToken(token);

        // 查用户
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('privy_user_id', claims.userId)
          .single();

        if (user) {
          // 查是否已铸造
          const { data: event } = await supabaseAdmin
            .from('mint_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('track_id', track.id)
            .limit(1)
            .single();
          minted = !!event;

          // 查是否有 pending
          if (!minted) {
            const { data: queue } = await supabaseAdmin
              .from('mint_queue')
              .select('id')
              .eq('user_id', user.id)
              .eq('token_id', track.week)
              .in('status', ['pending', 'minting_onchain'])
              .limit(1)
              .single();
            pending = !!queue;
          }
        }
      } catch {
        // token 无效，当未登录处理
      }
    }

    const res: TrackDetailResponse = { track, minted, pending };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/tracks/[id] error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

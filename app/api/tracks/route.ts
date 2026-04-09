import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { TracksListResponse } from '@/src/types/tracks';

/**
 * GET /api/tracks
 * 返回所有曲目列表，首页岛屿展示用。不需要登录。
 */
export async function GET() {
  try {
    const { data: tracks, error } = await supabaseAdmin
      .from('tracks')
      .select('id, title, week, audio_url, cover, island, created_at')
      .order('week', { ascending: true });

    if (error) throw error;

    const res: TracksListResponse = { tracks: tracks ?? [] };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/tracks error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

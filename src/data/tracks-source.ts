import type { Track, TracksListResponse } from '@/src/types/tracks';

/**
 * 数据适配层 — 页面组件只通过这里获取 track 数据
 * Track C：从真实 API 读取
 */
export async function fetchTracks(): Promise<Track[]> {
  const res = await fetch('/api/tracks');
  if (!res.ok) return [];
  const data: TracksListResponse = await res.json();
  return data.tracks;
}

export async function fetchTrackById(id: string): Promise<Track | null> {
  const res = await fetch(`/api/tracks/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.track ?? null;
}

-- Phase 3 S0：tracks 表加 arweave_url 列
-- 含义：底曲上传到 Arweave 后的 HTTPS URL（scripts/upload-tracks.ts 回写）
-- 前端和 Decoder 在 Phase 3 会优先读这一列，NULL 时退回原 audio_url
-- 在 Supabase Dashboard → SQL Editor 粘贴执行

alter table tracks add column if not exists arweave_url text;

-- 后续筛选"已上 Arweave 的底曲"会用这个谓词，加个部分索引
create index if not exists idx_tracks_arweave_ready
  on tracks (week)
  where arweave_url is not null;

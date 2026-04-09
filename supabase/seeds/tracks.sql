-- 测试用种子数据：5 首曲目
-- 在 Supabase Dashboard → SQL Editor 粘贴执行

insert into tracks (title, week, audio_url, cover, island) values
  ('晨雾',     1, '/tracks/001.mp3', '#3b82f6', '蓝岛'),
  ('潮汐',     2, '/tracks/001.mp3', '#8b5cf6', '紫岛'),
  ('星尘',     3, '/tracks/001.mp3', '#ec4899', '粉岛'),
  ('深渊',     4, '/tracks/001.mp3', '#10b981', '绿岛'),
  ('回声',     5, '/tracks/001.mp3', '#f59e0b', '金岛');

-- 注意：audio_url 都指向同一个文件（Phase 1 测试用，只有 001.mp3）
-- Phase 2 每首曲子会有独立音频文件

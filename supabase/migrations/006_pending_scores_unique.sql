-- Phase 2.5 S0：清理重复 draft + 创建部分唯一索引
-- 在 Supabase Dashboard → SQL Editor 粘贴执行

-- 1. 保留每组 user_id+track_id 最新的一条 draft，其余标 expired
UPDATE pending_scores
SET status = 'expired', updated_at = now()
WHERE status = 'draft'
  AND id NOT IN (
    SELECT DISTINCT ON (user_id, track_id) id
    FROM pending_scores
    WHERE status = 'draft'
    ORDER BY user_id, track_id, created_at DESC
  );

-- 2. 创建部分唯一索引：同一用户+曲目只能有一条 draft
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_scores_active_draft
  ON pending_scores (user_id, track_id)
  WHERE status = 'draft';

-- Remove duplicados historicos dos marcos de XP e impede novas repeticoes.

WITH ranked_milestones AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, type, COALESCE(content->>'title', ''), COALESCE(content->>'score', '')
            ORDER BY created_at ASC, id ASC
        ) AS row_num
    FROM public.feed_items
    WHERE type = 'achievement'
      AND content->>'title' = 'Novo Marco Alcançado! 🎉'
)
DELETE FROM public.feed_items feed
USING ranked_milestones ranked
WHERE feed.id = ranked.id
  AND ranked.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_unique_xp_milestone
ON public.feed_items (user_id, ((content->>'score')))
WHERE type = 'achievement'
  AND content->>'title' = 'Novo Marco Alcançado! 🎉'
  AND content ? 'score';

-- Fixes:
-- 1. get_or_create_league_room had ambiguous column references when creating a new room.
-- 2. league_results lacked an UPDATE policy for the owner to acknowledge the result.
-- 3. current-week weekly_league_stats can drift behind activity_logs when the room RPC fails.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_or_create_league_room(
    p_user_id UUID,
    p_league_name TEXT,
    p_week_start DATE
)
RETURNS TABLE (
    room_id UUID,
    room_number INTEGER,
    participant_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id UUID;
    v_room_number INTEGER;
    v_participant_count INTEGER;
    v_league_name TEXT := COALESCE(NULLIF(TRIM(p_league_name), ''), 'Bronze');
BEGIN
    SELECT w.room_id, w.room_number
    INTO v_room_id, v_room_number
    FROM public.weekly_league_stats w
    WHERE w.user_id = p_user_id
      AND w.week_start_date = p_week_start
    LIMIT 1;

    IF v_room_id IS NOT NULL THEN
        SELECT lr.participant_count
        INTO v_participant_count
        FROM public.league_rooms lr
        WHERE lr.id = v_room_id;

        RETURN QUERY
        SELECT v_room_id, COALESCE(v_room_number, 1), COALESCE(v_participant_count, 1);
        RETURN;
    END IF;

    PERFORM PG_ADVISORY_XACT_LOCK(HASHTEXT(FORMAT('league-room:%s:%s', v_league_name, p_week_start::TEXT)));

    SELECT w.room_id, w.room_number
    INTO v_room_id, v_room_number
    FROM public.weekly_league_stats w
    WHERE w.user_id = p_user_id
      AND w.week_start_date = p_week_start
    LIMIT 1;

    IF v_room_id IS NOT NULL THEN
        SELECT lr.participant_count
        INTO v_participant_count
        FROM public.league_rooms lr
        WHERE lr.id = v_room_id;

        RETURN QUERY
        SELECT v_room_id, COALESCE(v_room_number, 1), COALESCE(v_participant_count, 1);
        RETURN;
    END IF;

    SELECT lr.id, lr.room_number, lr.participant_count
    INTO v_room_id, v_room_number, v_participant_count
    FROM public.league_rooms lr
    WHERE lr.week_start_date = p_week_start
      AND lr.league_name = v_league_name
      AND lr.status = 'active'
      AND lr.participant_count < lr.max_participants
    ORDER BY lr.room_number ASC
    LIMIT 1;

    IF v_room_id IS NULL THEN
        SELECT COALESCE(MAX(lr.room_number), 0) + 1
        INTO v_room_number
        FROM public.league_rooms lr
        WHERE lr.week_start_date = p_week_start
          AND lr.league_name = v_league_name;

        INSERT INTO public.league_rooms (
            week_start_date,
            league_name,
            room_number,
            max_participants,
            participant_count,
            status
        )
        VALUES (
            p_week_start,
            v_league_name,
            v_room_number,
            15,
            1,
            'active'
        )
        RETURNING id, participant_count
        INTO v_room_id, v_participant_count;
    ELSE
        UPDATE public.league_rooms AS lr
        SET participant_count = lr.participant_count + 1
        WHERE lr.id = v_room_id
        RETURNING lr.participant_count
        INTO v_participant_count;
    END IF;

    RETURN QUERY
    SELECT v_room_id, v_room_number, COALESCE(v_participant_count, 1);
END;
$$;

DROP POLICY IF EXISTS "Users can acknowledge own league results" ON public.league_results;

CREATE POLICY "Users can acknowledge own league results"
ON public.league_results
FOR UPDATE
USING (
    auth.uid() = user_id
    OR public.is_admin_user(auth.uid())
)
WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin_user(auth.uid())
);

CREATE OR REPLACE FUNCTION public.acknowledge_league_result(p_result_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.league_results
    SET acknowledged_at = COALESCE(acknowledged_at, TIMEZONE('utc', NOW()))
    WHERE id = p_result_id
      AND (
        user_id = auth.uid()
        OR public.is_admin_user(auth.uid())
      );

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_league_result(UUID) TO anon, authenticated, service_role;

WITH current_week AS (
    SELECT public.get_league_week_start(NOW()) AS week_start
),
xp_logs AS (
    SELECT
        al.user_id,
        cw.week_start AS week_start_date,
        COALESCE(NULLIF(TRIM(p.current_league), ''), 'Bronze') AS league_name,
        SUM(
            CASE
                WHEN COALESCE(al.activity_metadata ->> 'xp', '') ~ '^-?[0-9]+$'
                    THEN (al.activity_metadata ->> 'xp')::INTEGER
                ELSE 0
            END
        )::INTEGER AS xp_earned,
        MIN(COALESCE(al.created_at, al.activity_date)) AS first_xp_at,
        MAX(COALESCE(al.created_at, al.activity_date)) AS last_xp_at
    FROM public.activity_logs al
    JOIN public.profiles p
      ON p.id = al.user_id
    CROSS JOIN current_week cw
    WHERE al.activity_type = 'xp_earned'
      AND al.activity_date >= cw.week_start
      AND al.activity_date < cw.week_start + 7
    GROUP BY al.user_id, cw.week_start, COALESCE(NULLIF(TRIM(p.current_league), ''), 'Bronze')
)
INSERT INTO public.weekly_league_stats (
    user_id,
    league_name,
    week_start_date,
    xp_earned,
    created_at,
    updated_at
)
SELECT
    x.user_id,
    x.league_name,
    x.week_start_date,
    x.xp_earned,
    COALESCE(x.first_xp_at, TIMEZONE('utc', NOW())),
    COALESCE(x.last_xp_at, TIMEZONE('utc', NOW()))
FROM xp_logs x
ON CONFLICT (user_id, week_start_date)
DO UPDATE SET
    league_name = EXCLUDED.league_name,
    xp_earned = EXCLUDED.xp_earned,
    updated_at = EXCLUDED.updated_at;

SELECT public.rebuild_league_rooms(public.get_league_week_start(NOW()), TRUE);

COMMIT;

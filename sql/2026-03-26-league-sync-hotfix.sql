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
        RETURNING public.league_rooms.id, public.league_rooms.participant_count
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

CREATE OR REPLACE FUNCTION public.sync_user_weekly_league_xp(
    p_user_id UUID,
    p_week_start DATE DEFAULT public.get_league_week_start(NOW())
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_league_name TEXT;
    v_total_xp INTEGER := 0;
    v_first_xp_at TIMESTAMPTZ;
    v_last_xp_at TIMESTAMPTZ;
    v_room_id UUID;
    v_room_number INTEGER;
    v_room RECORD;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN JSONB_BUILD_OBJECT(
            'synced', FALSE,
            'reason', 'missing_user'
        );
    END IF;

    SELECT COALESCE(NULLIF(TRIM(p.current_league), ''), 'Bronze')
    INTO v_league_name
    FROM public.profiles p
    WHERE p.id = p_user_id;

    IF v_league_name IS NULL THEN
        RETURN JSONB_BUILD_OBJECT(
            'synced', FALSE,
            'reason', 'missing_profile'
        );
    END IF;

    SELECT
        COALESCE(
            SUM(
                CASE
                    WHEN COALESCE(al.activity_metadata ->> 'xp', '') ~ '^-?[0-9]+$'
                        THEN (al.activity_metadata ->> 'xp')::INTEGER
                    ELSE 0
                END
            ),
            0
        )::INTEGER,
        MIN(COALESCE(al.created_at, al.activity_date)),
        MAX(COALESCE(al.created_at, al.activity_date))
    INTO v_total_xp, v_first_xp_at, v_last_xp_at
    FROM public.activity_logs al
    WHERE al.user_id = p_user_id
      AND al.activity_type = 'xp_earned'
      AND al.activity_date >= p_week_start
      AND al.activity_date < p_week_start + 7;

    IF COALESCE(v_total_xp, 0) <= 0 THEN
        RETURN JSONB_BUILD_OBJECT(
            'synced', FALSE,
            'reason', 'no_weekly_xp'
        );
    END IF;

    SELECT w.room_id, w.room_number
    INTO v_room_id, v_room_number
    FROM public.weekly_league_stats w
    WHERE w.user_id = p_user_id
      AND w.week_start_date = p_week_start
    LIMIT 1;

    IF v_room_id IS NULL THEN
        SELECT *
        INTO v_room
        FROM public.get_or_create_league_room(
            p_user_id,
            v_league_name,
            p_week_start
        );

        v_room_id := v_room.room_id;
        v_room_number := v_room.room_number;
    END IF;

    INSERT INTO public.weekly_league_stats (
        user_id,
        league_name,
        room_id,
        room_number,
        week_start_date,
        xp_earned,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id,
        v_league_name,
        v_room_id,
        v_room_number,
        p_week_start,
        v_total_xp,
        COALESCE(v_first_xp_at, TIMEZONE('utc', NOW())),
        COALESCE(v_last_xp_at, TIMEZONE('utc', NOW()))
    )
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET
        league_name = EXCLUDED.league_name,
        room_id = COALESCE(public.weekly_league_stats.room_id, EXCLUDED.room_id),
        room_number = COALESCE(public.weekly_league_stats.room_number, EXCLUDED.room_number),
        xp_earned = EXCLUDED.xp_earned,
        created_at = COALESCE(public.weekly_league_stats.created_at, EXCLUDED.created_at),
        updated_at = EXCLUDED.updated_at;

    RETURN JSONB_BUILD_OBJECT(
        'synced', TRUE,
        'week_start', p_week_start,
        'league_name', v_league_name,
        'room_number', v_room_number,
        'xp_earned', v_total_xp
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_weekly_league_xp(UUID, DATE) TO anon, authenticated, service_role;

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
    created_at = COALESCE(public.weekly_league_stats.created_at, EXCLUDED.created_at),
    updated_at = EXCLUDED.updated_at;

SELECT public.rebuild_league_rooms(public.get_league_week_start(NOW()), TRUE);

COMMIT;

-- League rooms, weekly finalization and promotion flow

CREATE TABLE IF NOT EXISTS public.league_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_start_date DATE NOT NULL,
    league_name TEXT NOT NULL DEFAULT 'Bronze',
    room_number INTEGER NOT NULL,
    max_participants INTEGER NOT NULL DEFAULT 15,
    participant_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.league_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.league_rooms(id) ON DELETE SET NULL,
    week_start_date DATE NOT NULL,
    league_name TEXT NOT NULL,
    room_number INTEGER,
    final_rank INTEGER NOT NULL,
    room_size INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    outcome TEXT NOT NULL DEFAULT 'stayed',
    previous_league TEXT NOT NULL,
    new_league TEXT NOT NULL,
    promotion_slots INTEGER NOT NULL DEFAULT 0,
    demotion_slots INTEGER NOT NULL DEFAULT 0,
    podium_position INTEGER,
    acknowledged_at TIMESTAMPTZ,
    push_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'league_rooms_week_league_room_key'
    ) THEN
        ALTER TABLE public.league_rooms
        ADD CONSTRAINT league_rooms_week_league_room_key
        UNIQUE (week_start_date, league_name, room_number);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'league_results_user_week_key'
    ) THEN
        ALTER TABLE public.league_results
        ADD CONSTRAINT league_results_user_week_key
        UNIQUE (user_id, week_start_date);
    END IF;
END
$$;

ALTER TABLE public.weekly_league_stats
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.league_rooms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS room_number INTEGER,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

CREATE INDEX IF NOT EXISTS idx_weekly_league_stats_room_week
ON public.weekly_league_stats (week_start_date, room_id, xp_earned DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_league_stats_user_week
ON public.weekly_league_stats (user_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_league_rooms_week_league
ON public.league_rooms (week_start_date, league_name, room_number);

CREATE INDEX IF NOT EXISTS idx_league_results_user_ack
ON public.league_results (user_id, acknowledged_at, week_start_date DESC);

UPDATE public.weekly_league_stats
SET created_at = COALESCE(created_at, TIMEZONE('utc', NOW())),
    updated_at = COALESCE(updated_at, created_at, TIMEZONE('utc', NOW()))
WHERE created_at IS NULL
   OR updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = COALESCE(p_user_id, auth.uid())
          AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_league_week_start(p_reference TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
    SELECT DATE_TRUNC('week', p_reference AT TIME ZONE 'Africa/Lagos')::DATE;
$$;

CREATE OR REPLACE FUNCTION public.get_next_league_name(p_league TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE COALESCE(NULLIF(TRIM(p_league), ''), 'Bronze')
        WHEN 'Bronze' THEN 'Prata'
        WHEN 'Prata' THEN 'Ouro'
        ELSE 'Ouro'
    END;
$$;

CREATE OR REPLACE FUNCTION public.get_previous_league_name(p_league TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE COALESCE(NULLIF(TRIM(p_league), ''), 'Bronze')
        WHEN 'Ouro' THEN 'Prata'
        WHEN 'Prata' THEN 'Bronze'
        ELSE 'Bronze'
    END;
$$;

CREATE OR REPLACE FUNCTION public.get_league_promotion_slots(p_room_size INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN COALESCE(p_room_size, 0) >= 15 THEN 5
        WHEN COALESCE(p_room_size, 0) >= 10 THEN 3
        WHEN COALESCE(p_room_size, 0) >= 5 THEN 2
        WHEN COALESCE(p_room_size, 0) >= 1 THEN 1
        ELSE 0
    END;
$$;

CREATE OR REPLACE FUNCTION public.get_league_demotion_slots(p_league TEXT, p_room_size INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN COALESCE(NULLIF(TRIM(p_league), ''), 'Bronze') = 'Bronze' THEN 0
        WHEN COALESCE(p_room_size, 0) >= 15 THEN 3
        WHEN COALESCE(p_room_size, 0) >= 10 THEN 2
        WHEN COALESCE(p_room_size, 0) >= 5 THEN 1
        ELSE 0
    END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_league_room(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(public.is_admin_user(auth.uid()), FALSE)
        OR EXISTS (
            SELECT 1
            FROM public.weekly_league_stats own_stats
            WHERE own_stats.user_id = auth.uid()
              AND own_stats.room_id = p_room_id
        );
$$;

ALTER TABLE public.league_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all league stats" ON public.weekly_league_stats;
DROP POLICY IF EXISTS "Users can update their own weekly stats" ON public.weekly_league_stats;
DROP POLICY IF EXISTS "System can insert weekly stats" ON public.weekly_league_stats;

DROP POLICY IF EXISTS "League room members can view stats" ON public.weekly_league_stats;
DROP POLICY IF EXISTS "Users can update own weekly room stats" ON public.weekly_league_stats;
DROP POLICY IF EXISTS "Users can insert own weekly room stats" ON public.weekly_league_stats;

DROP POLICY IF EXISTS "League room members can view rooms" ON public.league_rooms;
DROP POLICY IF EXISTS "Admins can manage league rooms" ON public.league_rooms;

DROP POLICY IF EXISTS "Users can view own league results" ON public.league_results;
DROP POLICY IF EXISTS "Admins can manage league results" ON public.league_results;

CREATE POLICY "League room members can view stats"
ON public.weekly_league_stats
FOR SELECT
USING (
    auth.uid() = user_id
    OR public.can_view_league_room(room_id)
    OR public.is_admin_user(auth.uid())
);

CREATE POLICY "Users can update own weekly room stats"
ON public.weekly_league_stats
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly room stats"
ON public.weekly_league_stats
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin_user(auth.uid())
);

CREATE POLICY "League room members can view rooms"
ON public.league_rooms
FOR SELECT
USING (
    public.can_view_league_room(id)
    OR public.is_admin_user(auth.uid())
);

CREATE POLICY "Admins can manage league rooms"
ON public.league_rooms
FOR ALL
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Users can view own league results"
ON public.league_results
FOR SELECT
USING (
    auth.uid() = user_id
    OR public.is_admin_user(auth.uid())
);

CREATE POLICY "Admins can manage league results"
ON public.league_results
FOR ALL
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.rebuild_league_rooms(
    p_week_start DATE DEFAULT public.get_league_week_start(NOW()),
    p_refresh_league_name BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INTEGER := 0;
    v_rooms INTEGER := 0;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.league_results
        WHERE week_start_date = p_week_start
    ) THEN
        RAISE EXCEPTION 'Cannot rebuild rooms for finalized week %', p_week_start;
    END IF;

    IF p_refresh_league_name THEN
        UPDATE public.weekly_league_stats w
        SET league_name = COALESCE(NULLIF(TRIM(p.current_league), ''), 'Bronze'),
            room_id = NULL,
            room_number = NULL
        FROM public.profiles p
        WHERE p.id = w.user_id
          AND w.week_start_date = p_week_start
          AND w.league_name IS DISTINCT FROM COALESCE(NULLIF(TRIM(p.current_league), ''), 'Bronze');
    END IF;

    UPDATE public.weekly_league_stats w
    SET created_at = COALESCE(
            first_hits.first_xp_at,
            w.created_at,
            TIMEZONE('utc', NOW())
        ),
        updated_at = COALESCE(
            w.updated_at,
            first_hits.first_xp_at,
            w.created_at,
            TIMEZONE('utc', NOW())
        )
    FROM (
        SELECT user_id, MIN(created_at) AS first_xp_at
        FROM public.activity_logs
        WHERE activity_type = 'xp_earned'
          AND activity_date >= p_week_start
          AND activity_date < p_week_start + 7
        GROUP BY user_id
    ) first_hits
    WHERE w.week_start_date = p_week_start
      AND w.user_id = first_hits.user_id;

    UPDATE public.weekly_league_stats
    SET created_at = COALESCE(created_at, TIMEZONE('utc', NOW())),
        updated_at = COALESCE(updated_at, created_at, TIMEZONE('utc', NOW()))
    WHERE week_start_date = p_week_start;

    UPDATE public.weekly_league_stats
    SET room_id = NULL,
        room_number = NULL
    WHERE week_start_date = p_week_start;

    DELETE FROM public.league_rooms
    WHERE week_start_date = p_week_start;

    WITH ranked AS (
        SELECT
            w.id,
            COALESCE(NULLIF(TRIM(w.league_name), ''), 'Bronze') AS league_name,
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(NULLIF(TRIM(w.league_name), ''), 'Bronze')
                ORDER BY COALESCE(w.created_at, w.updated_at, TIMEZONE('utc', NOW())), w.user_id
            ) AS seq
        FROM public.weekly_league_stats w
        WHERE w.week_start_date = p_week_start
    ),
    assigned AS (
        SELECT
            id,
            league_name,
            ((seq - 1) / 15) + 1 AS room_number
        FROM ranked
    ),
    room_totals AS (
        SELECT
            league_name,
            room_number,
            COUNT(*)::INTEGER AS participant_count
        FROM assigned
        GROUP BY league_name, room_number
    )
    INSERT INTO public.league_rooms (
        week_start_date,
        league_name,
        room_number,
        max_participants,
        participant_count,
        status
    )
    SELECT
        p_week_start,
        league_name,
        room_number,
        15,
        participant_count,
        'active'
    FROM room_totals
    ON CONFLICT (week_start_date, league_name, room_number)
    DO UPDATE SET
        max_participants = EXCLUDED.max_participants,
        participant_count = EXCLUDED.participant_count,
        status = 'active',
        closed_at = NULL;

    WITH assigned AS (
        SELECT
            w.id,
            COALESCE(NULLIF(TRIM(w.league_name), ''), 'Bronze') AS league_name,
            ((ROW_NUMBER() OVER (
                PARTITION BY COALESCE(NULLIF(TRIM(w.league_name), ''), 'Bronze')
                ORDER BY COALESCE(w.created_at, w.updated_at, TIMEZONE('utc', NOW())), w.user_id
            ) - 1) / 15) + 1 AS room_number
        FROM public.weekly_league_stats w
        WHERE w.week_start_date = p_week_start
    )
    UPDATE public.weekly_league_stats w
    SET room_id = lr.id,
        room_number = assigned.room_number
    FROM assigned
    JOIN public.league_rooms lr
      ON lr.week_start_date = p_week_start
     AND lr.league_name = assigned.league_name
     AND lr.room_number = assigned.room_number
    WHERE w.id = assigned.id;

    UPDATE public.league_rooms lr
    SET participant_count = room_counts.participant_count
    FROM (
        SELECT room_id, COUNT(*)::INTEGER AS participant_count
        FROM public.weekly_league_stats
        WHERE week_start_date = p_week_start
          AND room_id IS NOT NULL
        GROUP BY room_id
    ) room_counts
    WHERE lr.id = room_counts.room_id;

    SELECT COUNT(*)::INTEGER
    INTO v_rows
    FROM public.weekly_league_stats
    WHERE week_start_date = p_week_start;

    SELECT COUNT(*)::INTEGER
    INTO v_rooms
    FROM public.league_rooms
    WHERE week_start_date = p_week_start;

    RETURN JSONB_BUILD_OBJECT(
        'week_start', p_week_start,
        'rows', v_rows,
        'rooms', v_rooms
    );
END;
$$;

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
        SELECT participant_count
        INTO v_participant_count
        FROM public.league_rooms
        WHERE id = v_room_id;

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
        SELECT participant_count
        INTO v_participant_count
        FROM public.league_rooms
        WHERE id = v_room_id;

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
        SELECT COALESCE(MAX(room_number), 0) + 1
        INTO v_room_number
        FROM public.league_rooms
        WHERE week_start_date = p_week_start
          AND league_name = v_league_name;

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
        UPDATE public.league_rooms
        SET participant_count = participant_count + 1
        WHERE id = v_room_id
        RETURNING participant_count
        INTO v_participant_count;
    END IF;

    RETURN QUERY
    SELECT v_room_id, v_room_number, COALESCE(v_participant_count, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_weekly_xp(
    p_user_id UUID,
    p_league_name TEXT,
    p_week_start DATE,
    p_xp INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room RECORD;
    v_reference_time TIMESTAMPTZ := TIMEZONE('utc', NOW());
BEGIN
    IF p_user_id IS NULL OR COALESCE(p_xp, 0) <= 0 THEN
        RETURN;
    END IF;

    SELECT *
    INTO v_room
    FROM public.get_or_create_league_room(
        p_user_id,
        COALESCE(NULLIF(TRIM(p_league_name), ''), 'Bronze'),
        p_week_start
    );

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
        COALESCE(NULLIF(TRIM(p_league_name), ''), 'Bronze'),
        v_room.room_id,
        v_room.room_number,
        p_week_start,
        p_xp,
        v_reference_time,
        v_reference_time
    )
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET
        league_name = EXCLUDED.league_name,
        room_id = COALESCE(public.weekly_league_stats.room_id, EXCLUDED.room_id),
        room_number = COALESCE(public.weekly_league_stats.room_number, EXCLUDED.room_number),
        xp_earned = public.weekly_league_stats.xp_earned + EXCLUDED.xp_earned,
        updated_at = TIMEZONE('utc', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_league_week(p_week_start DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_week_start DATE := COALESCE(
        p_week_start,
        public.get_league_week_start(NOW()) - 7
    );
    v_current_week DATE := public.get_league_week_start(NOW());
    v_processed_users INTEGER := 0;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.league_results
        WHERE week_start_date = v_week_start
    ) THEN
        SELECT COUNT(*)::INTEGER
        INTO v_processed_users
        FROM public.league_results
        WHERE week_start_date = v_week_start;

        RETURN JSONB_BUILD_OBJECT(
            'week_start', v_week_start,
            'already_finalized', TRUE,
            'processed_users', v_processed_users
        );
    END IF;

    PERFORM public.rebuild_league_rooms(v_week_start, FALSE);

    WITH room_sizes AS (
        SELECT
            lr.id AS room_id,
            lr.league_name,
            lr.room_number,
            COUNT(w.id)::INTEGER AS room_size
        FROM public.league_rooms lr
        JOIN public.weekly_league_stats w
          ON w.room_id = lr.id
         AND w.week_start_date = v_week_start
        WHERE lr.week_start_date = v_week_start
        GROUP BY lr.id, lr.league_name, lr.room_number
    ),
    ranked AS (
        SELECT
            w.user_id,
            w.room_id,
            COALESCE(w.room_number, room_sizes.room_number) AS room_number,
            room_sizes.league_name,
            room_sizes.room_size,
            w.xp_earned,
            public.get_league_promotion_slots(room_sizes.room_size) AS promotion_slots,
            public.get_league_demotion_slots(room_sizes.league_name, room_sizes.room_size) AS demotion_slots,
            ROW_NUMBER() OVER (
                PARTITION BY w.room_id
                ORDER BY w.xp_earned DESC, COALESCE(w.updated_at, w.created_at, TIMEZONE('utc', NOW())) ASC, w.user_id
            ) AS final_rank
        FROM public.weekly_league_stats w
        JOIN room_sizes
          ON room_sizes.room_id = w.room_id
        WHERE w.week_start_date = v_week_start
    ),
    transitions AS (
        SELECT
            ranked.*,
            CASE
                WHEN ranked.final_rank <= ranked.promotion_slots
                    AND ranked.league_name <> 'Ouro' THEN 'promoted'
                WHEN ranked.demotion_slots > 0
                    AND ranked.final_rank > ranked.room_size - ranked.demotion_slots
                    AND ranked.league_name <> 'Bronze' THEN 'demoted'
                ELSE 'stayed'
            END AS outcome,
            CASE
                WHEN ranked.final_rank <= ranked.promotion_slots
                    AND ranked.league_name <> 'Ouro' THEN public.get_next_league_name(ranked.league_name)
                WHEN ranked.demotion_slots > 0
                    AND ranked.final_rank > ranked.room_size - ranked.demotion_slots
                    AND ranked.league_name <> 'Bronze' THEN public.get_previous_league_name(ranked.league_name)
                ELSE ranked.league_name
            END AS new_league,
            CASE
                WHEN ranked.final_rank <= 3 THEN ranked.final_rank
                ELSE NULL
            END AS podium_position
        FROM ranked
    ),
    inserted_results AS (
        INSERT INTO public.league_results (
            user_id,
            room_id,
            week_start_date,
            league_name,
            room_number,
            final_rank,
            room_size,
            xp_earned,
            outcome,
            previous_league,
            new_league,
            promotion_slots,
            demotion_slots,
            podium_position
        )
        SELECT
            user_id,
            room_id,
            v_week_start,
            league_name,
            room_number,
            final_rank,
            room_size,
            xp_earned,
            outcome,
            league_name,
            new_league,
            promotion_slots,
            demotion_slots,
            podium_position
        FROM transitions
        ON CONFLICT (user_id, week_start_date) DO NOTHING
        RETURNING user_id
    )
    SELECT COUNT(*)::INTEGER
    INTO v_processed_users
    FROM inserted_results;

    UPDATE public.profiles p
    SET current_league = result_rows.new_league
    FROM public.league_results result_rows
    WHERE result_rows.week_start_date = v_week_start
      AND result_rows.user_id = p.id;

    UPDATE public.league_rooms
    SET status = 'closed',
        closed_at = TIMEZONE('utc', NOW())
    WHERE week_start_date = v_week_start;

    INSERT INTO public.user_notifications (
        user_id,
        title,
        body,
        type,
        link
    )
    SELECT
        lr.user_id,
        CASE lr.outcome
            WHEN 'promoted' THEN 'Parabens! Subiste de liga'
            WHEN 'demoted' THEN 'Liga encerrada: vamos voltar mais fortes'
            ELSE 'Liga encerrada: mantiveste a divisao'
        END,
        CASE lr.outcome
            WHEN 'promoted' THEN FORMAT(
                'Terminaste em #%s na Liga %s, Sala %s, com %s XP e subiste para %s.',
                lr.final_rank, lr.previous_league, COALESCE(lr.room_number, 1), lr.xp_earned, lr.new_league
            )
            WHEN 'demoted' THEN FORMAT(
                'Terminaste em #%s na Liga %s, Sala %s, com %s XP. Esta semana vais competir na %s.',
                lr.final_rank, lr.previous_league, COALESCE(lr.room_number, 1), lr.xp_earned, lr.new_league
            )
            ELSE FORMAT(
                'Terminaste em #%s na Liga %s, Sala %s, com %s XP e permaneces na mesma divisao.',
                lr.final_rank, lr.previous_league, COALESCE(lr.room_number, 1), lr.xp_earned
            )
        END,
        CASE
            WHEN lr.outcome = 'promoted' THEN 'achievement'
            ELSE 'personal'
        END,
        '/leagues'
    FROM public.league_results lr
    WHERE lr.week_start_date = v_week_start;

    INSERT INTO public.feed_items (
        user_id,
        type,
        content
    )
    SELECT
        lr.user_id,
        'achievement',
        JSONB_BUILD_OBJECT(
            'title', FORMAT('Podio da Liga %s', lr.previous_league),
            'body', FORMAT(
                'Fechou a semana em %s lugar na Sala %s com %s XP e garantiu lugar no podio.',
                CASE lr.podium_position
                    WHEN 1 THEN '1o'
                    WHEN 2 THEN '2o'
                    ELSE '3o'
                END,
                COALESCE(lr.room_number, 1),
                lr.xp_earned
            ),
            'score', lr.xp_earned,
            'medal_name', CASE lr.podium_position
                WHEN 1 THEN 'Ouro'
                WHEN 2 THEN 'Prata'
                ELSE 'Bronze'
            END
        )
    FROM public.league_results lr
    WHERE lr.week_start_date = v_week_start
      AND lr.podium_position IS NOT NULL;

    IF v_current_week > v_week_start THEN
        PERFORM public.rebuild_league_rooms(v_current_week, TRUE);
    END IF;

    RETURN JSONB_BUILD_OBJECT(
        'week_start', v_week_start,
        'already_finalized', FALSE,
        'processed_users', v_processed_users
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_league_week_start(TIMESTAMPTZ) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_league_name(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_previous_league_name(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_league_promotion_slots(INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_league_demotion_slots(TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_league_room(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_league_rooms(DATE, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_league_room(UUID, TEXT, DATE) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_weekly_xp(UUID, TEXT, DATE, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_league_week(DATE) TO anon, authenticated, service_role;

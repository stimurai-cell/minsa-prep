-- Real check-in diario da ofensiva (streak) baseado apenas na data local de Angola
-- Executar no editor SQL do Supabase.

-- 1) Tabela de check-ins diários (uma linha por utilizador por dia)
CREATE TABLE IF NOT EXISTS public.streak_checkins (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    streak_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (user_id, streak_date)
);

ALTER TABLE public.streak_checkins ENABLE ROW LEVEL SECURITY;

-- Políticas: cada utilizador vê e insere apenas os próprios check-ins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'streak_checkins_select_own'
    ) THEN
        CREATE POLICY streak_checkins_select_own
            ON public.streak_checkins
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'streak_checkins_insert_own'
    ) THEN
        CREATE POLICY streak_checkins_insert_own
            ON public.streak_checkins
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 2) Função única para registar a ofensiva do dia (sem depender de hora)
CREATE OR REPLACE FUNCTION public.register_daily_streak(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    today_local DATE := (TIMEZONE('Africa/Luanda', NOW()))::DATE;
    last_checkin DATE;
    new_streak INT;
    freeze_active BOOLEAN;
    days_gap INT;
    already_marked BOOLEAN := FALSE;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id é obrigatório (auth.uid() ausente)';
    END IF;

    -- Bloquear registo duplicado no mesmo dia
    SELECT streak_date INTO last_checkin
    FROM public.streak_checkins
    WHERE user_id = p_user_id
    ORDER BY streak_date DESC
    LIMIT 1;

    IF last_checkin = today_local THEN
        already_marked := TRUE;
    END IF;

    -- Buscar estado atual com lock para evitar race conditions
    SELECT streak_count, streak_freeze_active
    INTO new_streak, freeze_active
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF already_marked THEN
        RETURN jsonb_build_object('streak_count', new_streak, 'already_marked', TRUE);
    END IF;

    days_gap := CASE WHEN last_checkin IS NULL THEN NULL ELSE (today_local - last_checkin) END;

    IF last_checkin IS NULL THEN
        new_streak := 1; -- primeiro dia
    ELSIF days_gap = 1 THEN
        new_streak := COALESCE(new_streak, 0) + 1;
    ELSIF days_gap > 1 THEN
        IF freeze_active THEN
            new_streak := COALESCE(new_streak, 0) + 1; -- salvo pelo protetor
            freeze_active := FALSE;
        ELSE
            new_streak := 1; -- recomeça
        END IF;
    ELSE
        -- days_gap = 0 já tratado acima; qualquer negativo (fuso) cai aqui e não mexe.
        new_streak := COALESCE(new_streak, 0);
    END IF;

    INSERT INTO public.streak_checkins (user_id, streak_date)
    VALUES (p_user_id, today_local)
    ON CONFLICT (user_id, streak_date) DO NOTHING;

    UPDATE public.profiles
    SET streak_count = new_streak,
        streak_freeze_active = freeze_active,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_user_id;

    -- Marcos de ofensiva (evita duplicar notificações)
    IF new_streak = ANY (ARRAY[3, 7, 14, 30, 50, 100, 365]) THEN
        INSERT INTO public.feed_items (user_id, type, content)
        VALUES (
            p_user_id,
            'streak',
            jsonb_build_object(
                'title', 'Ofensiva Lendária! 🔥',
                'body', format('Mantiveste o foco por %s dias consecutivos. Continua imparável!', new_streak),
                'streak_days', new_streak
            )
        );
    END IF;

    RETURN jsonb_build_object('streak_count', new_streak, 'already_marked', FALSE);
END;
$$;

COMMENT ON FUNCTION public.register_daily_streak IS
'Marca a ofensiva diária com base apenas na data local de Angola, sem depender de horário.';


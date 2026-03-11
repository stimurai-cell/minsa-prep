-- Função para incrementar o XP total de forma atómica
-- Evita que o valor do XP total seja sobrescrito por dados antigos do cliente
CREATE OR REPLACE FUNCTION increment_total_xp(p_user_id UUID, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET total_xp = COALESCE(total_xp, 0) + p_xp
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

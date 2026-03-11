-- MINSA Prep: Schemal Fix for Profiles Table
-- Run this in your Supabase SQL Editor to fix registration and user data visibility.

DO $$
BEGIN
    -- 1. Add student_number if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'student_number'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN student_number TEXT;
    END IF;

    -- 2. Add last_active if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'last_active'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN last_active TIMESTAMP WITH TIME ZONE;
    END IF;

    -- 3. Add total_xp if missing (usually exists but good to be safe)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'total_xp'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN total_xp INT DEFAULT 0;
    END IF;
END$$;

-- Diagnostic check (Will show in results)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';

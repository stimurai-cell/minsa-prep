-- Social Feed and Unified Notification System (Duo-Style)

-- 1. Feed Items (Achievments, Admin News, Battle Results)
CREATE TABLE IF NOT EXISTS public.feed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Null for Admin posts
    type TEXT NOT NULL, -- 'achievement', 'news', 'battle', 'streak'
    content JSONB NOT NULL DEFAULT '{}', -- { title, body, icon, streak_days, medal_name, etc }
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Social Interactions
CREATE TABLE IF NOT EXISTS public.feed_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_item_id UUID REFERENCES public.feed_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL DEFAULT '❤️',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(feed_item_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.feed_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_item_id UUID REFERENCES public.feed_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Unified Notifications (In-app and PWA-ready)
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Null means broadcast to everyone
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'system', -- 'marketing', 'personal', 'system'
    link TEXT, -- Internal route or external URL
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. RLS & Policies
ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Reset and Apply Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public feed viewable by everyone" ON feed_items;
    DROP POLICY IF EXISTS "Admins can manage feed items" ON feed_items;
    DROP POLICY IF EXISTS "Anyone can react to feed" ON feed_reactions;
    DROP POLICY IF EXISTS "Anyone can view comments" ON feed_comments;
    DROP POLICY IF EXISTS "Users can comment on feed" ON feed_comments;
    DROP POLICY IF EXISTS "Users can view own notifications" ON user_notifications;
    DROP POLICY IF EXISTS "Admins can manage notifications" ON user_notifications;
END$$;

CREATE POLICY "Public feed viewable by everyone" ON feed_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage feed items" ON feed_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can react to feed" ON feed_reactions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view comments" ON feed_comments FOR SELECT USING (true);
CREATE POLICY "Users can comment on feed" ON feed_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON user_notifications FOR SELECT USING (
    user_id = auth.uid() OR user_id IS NULL
);
CREATE POLICY "Admins can manage notifications" ON user_notifications FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Helper Function to Generate Feed from Activity
CREATE OR REPLACE FUNCTION public.create_feed_item_from_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Only handle specific types that deserve a social announcement
    IF NEW.activity_type = 'completed_simulation' AND (NEW.activity_metadata->>'score')::decimal >= 80 THEN
        INSERT INTO public.feed_items (user_id, type, content)
        VALUES (NEW.user_id, 'achievement', jsonb_build_object(
            'title', 'Ação Heroica!', 
            'body', 'Acabou de realizar um simulado com pontuação incrível.',
            'score', NEW.activity_metadata->>'score'
        ));
    ELSIF NEW.activity_type = 'streak_milestone' THEN
        INSERT INTO public.feed_items (user_id, type, content)
        VALUES (NEW.user_id, 'streak', jsonb_build_object(
            'title', 'Chama Acesa!',
            'body', 'Bateu a meta de ' || (NEW.activity_metadata->>'days') || ' dias seguidos!',
            'days', NEW.activity_metadata->>'days'
        ));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_activity_to_feed
    AFTER INSERT ON public.activity_logs
    FOR EACH ROW EXECUTE FUNCTION public.create_feed_item_from_activity();

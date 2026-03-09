-- MINSA Prep Gamification & Social Features Update

-- 1. Add new fields to Profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS goal TEXT,
ADD COLUMN IF NOT EXISTS avatar_style TEXT DEFAULT 'default';

-- 2. User Follows Table
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (follower_id, following_id)
);

-- RLS for user_follows
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see who follows who" 
ON user_follows FOR SELECT USING (true);

CREATE POLICY "Users can follow others" 
ON user_follows FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others" 
ON user_follows FOR DELETE TO authenticated 
USING (auth.uid() = follower_id);

-- 3. User Activities Feed (Conquistas e marcos)
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- e.g., 'goal_reached', 'level_up', 'streak_day', 'exam_passed'
  description TEXT NOT NULL,
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- RLS for user_activities
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see activities of everyone" 
ON user_activities FOR SELECT USING (true);

CREATE POLICY "System and users can insert activities" 
ON user_activities FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

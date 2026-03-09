-- Trigger to notify user when they receive a new follower

CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS TRIGGER AS $$
DECLARE
    follower_name TEXT;
BEGIN
    -- Get the follower's name
    SELECT full_name INTO follower_name FROM public.profiles WHERE id = NEW.follower_id;

    -- Insert notification for the user being followed (following_id)
    INSERT INTO public.user_notifications (user_id, title, body, type, link)
    VALUES (
        NEW.following_id, 
        'Novo Seguidor! 👥', 
        follower_name || ' começou a seguir você no MINSA Prep.',
        'personal',
        '/profile/' || NEW.follower_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset and Create Trigger
DROP TRIGGER IF EXISTS trigger_notify_follower ON public.user_follows;
CREATE TRIGGER trigger_notify_follower
    AFTER INSERT ON public.user_follows
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();

-- Enable pg_cron for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create tables
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  current_state TEXT NOT NULL DEFAULT 'Focused',
  reread_count INT NOT NULL DEFAULT 0,
  adaptation_reason TEXT,
  content_version INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE UNIQUE,
  duration_seconds INT NOT NULL DEFAULT 0,
  total_distraction_seconds INT NOT NULL DEFAULT 0,
  dominant_state TEXT NOT NULL DEFAULT 'Focused',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reading_speed_wpm FLOAT,
  pause_duration FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_style TEXT NOT NULL DEFAULT 'Balanced',
  audio_enabled BOOLEAN NOT NULL DEFAULT false,
  font_size TEXT NOT NULL DEFAULT 'Medium',
  high_contrast BOOLEAN NOT NULL DEFAULT false,
  reduce_motion BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  version INT NOT NULL,
  chunk_count INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  input_text TEXT,
  action_taken TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Profiles: Users can select and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Learning Sessions: Users can select, insert, update and delete their own sessions
CREATE POLICY "Users can access own sessions" ON public.learning_sessions FOR ALL USING (auth.uid() = user_id);

-- Behavior Events: Users can access events related to their own sessions
CREATE POLICY "Users can access own session events" ON public.behavior_events FOR ALL USING (
  session_id IN (SELECT id FROM public.learning_sessions WHERE user_id = auth.uid())
);

CREATE POLICY "Users can access own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id);

-- Session Analytics: Users can access their own analytics
CREATE POLICY "Users can access own session analytics" ON public.session_analytics FOR ALL USING (
  session_id IN (SELECT id FROM public.learning_sessions WHERE user_id = auth.uid())
);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  
  -- Create default user settings
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Data Retention: Purge old behavior events after 30 days
-- Requires pg_cron initialization by a superuser, commenting out the schedule for safe local execution, but fn is here.
CREATE OR REPLACE FUNCTION purge_old_behavior_events() RETURNS void AS $$
BEGIN
  DELETE FROM public.behavior_events WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- SELECT cron.schedule('0 0 * * *', $$SELECT purge_old_behavior_events()$$);

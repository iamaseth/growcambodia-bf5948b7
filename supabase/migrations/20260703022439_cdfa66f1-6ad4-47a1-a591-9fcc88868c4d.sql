
-- Farms
CREATE TABLE public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.farms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farms TO authenticated;
GRANT ALL ON public.farms TO service_role;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farms are viewable by everyone" ON public.farms FOR SELECT USING (true);
CREATE POLICY "Users can insert own farms" ON public.farms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own farms" ON public.farms FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own farms" ON public.farms FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Plant logs
CREATE TABLE public.plant_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plant_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_logs TO authenticated;
GRANT ALL ON public.plant_logs TO service_role;
ALTER TABLE public.plant_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plant logs viewable by everyone" ON public.plant_logs FOR SELECT USING (true);
CREATE POLICY "Users insert own plant logs" ON public.plant_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plant logs" ON public.plant_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own plant logs" ON public.plant_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Timeline updates
CREATE TABLE public.timeline_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES public.plant_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  growth_stage TEXT NOT NULL,
  notes TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.timeline_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_updates TO authenticated;
GRANT ALL ON public.timeline_updates TO service_role;
ALTER TABLE public.timeline_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Updates viewable by everyone" ON public.timeline_updates FOR SELECT USING (true);
CREATE POLICY "Users insert own updates" ON public.timeline_updates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own updates" ON public.timeline_updates FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own updates" ON public.timeline_updates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comments (referenced by spec)
CREATE TABLE public.update_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES public.timeline_updates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.update_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.update_comments TO authenticated;
GRANT ALL ON public.update_comments TO service_role;
ALTER TABLE public.update_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by everyone" ON public.update_comments FOR SELECT USING (true);
CREATE POLICY "Users insert own comments" ON public.update_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.update_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Likes (unique per user per update)
CREATE TABLE public.update_likes (
  update_id UUID NOT NULL REFERENCES public.timeline_updates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (update_id, user_id)
);
GRANT SELECT ON public.update_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.update_likes TO authenticated;
GRANT ALL ON public.update_likes TO service_role;
ALTER TABLE public.update_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by everyone" ON public.update_likes FOR SELECT USING (true);
CREATE POLICY "Users like as themselves" ON public.update_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike own" ON public.update_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER farms_updated_at BEFORE UPDATE ON public.farms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER plant_logs_updated_at BEFORE UPDATE ON public.plant_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-maintain likes counter on timeline_updates
CREATE OR REPLACE FUNCTION public.sync_update_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.timeline_updates SET likes = likes + 1 WHERE id = NEW.update_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.timeline_updates SET likes = GREATEST(0, likes - 1) WHERE id = OLD.update_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER likes_count_trigger
  AFTER INSERT OR DELETE ON public.update_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_update_likes_count();

-- Indexes
CREATE INDEX idx_plant_logs_farm ON public.plant_logs(farm_id);
CREATE INDEX idx_updates_log ON public.timeline_updates(log_id);
CREATE INDEX idx_updates_created ON public.timeline_updates(created_at DESC);
CREATE INDEX idx_comments_update ON public.update_comments(update_id);

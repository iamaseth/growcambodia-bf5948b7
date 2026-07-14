
CREATE TABLE public.farm_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  plant_log_id UUID REFERENCES public.plant_logs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  visit_type TEXT NOT NULL DEFAULT 'general',
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','overdue','cancelled')),
  purpose TEXT,
  private_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_visits TO authenticated;
GRANT ALL ON public.farm_visits TO service_role;

ALTER TABLE public.farm_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own visits"
  ON public.farm_visits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own visits"
  ON public.farm_visits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own visits"
  ON public.farm_visits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own visits"
  ON public.farm_visits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_farm_visits_updated_at
  BEFORE UPDATE ON public.farm_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_farm_visits_user_date ON public.farm_visits(user_id, scheduled_date);
CREATE INDEX idx_farm_visits_farm ON public.farm_visits(farm_id);
CREATE INDEX idx_farm_visits_plant_log ON public.farm_visits(plant_log_id);

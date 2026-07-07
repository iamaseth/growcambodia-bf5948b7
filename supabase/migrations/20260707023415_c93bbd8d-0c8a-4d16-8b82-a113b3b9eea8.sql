
-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('farmer','agronomist','moderator','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "roles readable to authenticated" ON public.user_roles;
CREATE POLICY "roles readable to authenticated" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Extend comments
ALTER TABLE public.update_comments
  ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_agronomist_reply BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC;

-- Pinning policy (admins/moderators can update pinned flag)
DROP POLICY IF EXISTS "mods can update comments" ON public.update_comments;
CREATE POLICY "mods can update comments" ON public.update_comments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Extend plant_logs with variety + planted_at
ALTER TABLE public.plant_logs
  ADD COLUMN IF NOT EXISTS variety TEXT,
  ADD COLUMN IF NOT EXISTS planted_at DATE;

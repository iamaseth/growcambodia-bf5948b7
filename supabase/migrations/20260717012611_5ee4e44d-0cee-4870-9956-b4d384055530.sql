
-- Phase 2: Farm team memberships & farmer submissions

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.farm_member_role AS ENUM ('owner','farmer','staff','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.farm_member_status AS ENUM ('invited','active','suspended','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM ('draft','submitted','under_review','approved','rejected','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_type AS ENUM ('progress','measurement','problem','harvest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. farm_members
CREATE TABLE IF NOT EXISTS public.farm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role public.farm_member_role NOT NULL DEFAULT 'farmer',
  status public.farm_member_status NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farm_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_farm_members_user ON public.farm_members(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_members_farm ON public.farm_members(farm_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_members TO authenticated;
GRANT ALL ON public.farm_members TO service_role;

ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;

-- 3. Backfill: every existing farm owner gets an active owner membership.
INSERT INTO public.farm_members (farm_id, user_id, member_role, status, invited_by, accepted_at)
SELECT f.id, f.user_id, 'owner', 'active', f.user_id, f.created_at
FROM public.farms f
ON CONFLICT (farm_id, user_id) DO NOTHING;

-- Auto-create owner membership for new farms
CREATE OR REPLACE FUNCTION public.create_owner_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.farm_members (farm_id, user_id, member_role, status, invited_by, accepted_at)
  VALUES (NEW.id, NEW.user_id, 'owner', 'active', NEW.user_id, now())
  ON CONFLICT (farm_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS farms_owner_membership ON public.farms;
CREATE TRIGGER farms_owner_membership
AFTER INSERT ON public.farms
FOR EACH ROW EXECUTE FUNCTION public.create_owner_membership();

CREATE TRIGGER farm_members_updated_at
BEFORE UPDATE ON public.farm_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Security-definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_farm_member(_farm uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_members
    WHERE farm_id = _farm AND user_id = _user AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.farm_member_role(_farm uuid, _user uuid)
RETURNS public.farm_member_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT member_role FROM public.farm_members
  WHERE farm_id = _farm AND user_id = _user AND status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_manage_farm(_farm uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    public.has_role(_user, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.farms WHERE id = _farm AND user_id = _user
    )
    OR EXISTS (
      SELECT 1 FROM public.farm_members
      WHERE farm_id = _farm AND user_id = _user
        AND status = 'active' AND member_role IN ('owner','staff')
    )
$$;

CREATE OR REPLACE FUNCTION public.can_review_farm(_farm uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    public.has_role(_user, 'admin'::public.app_role)
    OR public.has_role(_user, 'moderator'::public.app_role)
    OR public.can_manage_farm(_farm, _user)
$$;

-- 5. farm_members RLS
CREATE POLICY "members read own or manage"
  ON public.farm_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_farm(farm_id, auth.uid()));

CREATE POLICY "managers insert members"
  ON public.farm_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_farm(farm_id, auth.uid()));

CREATE POLICY "managers update members"
  ON public.farm_members FOR UPDATE TO authenticated
  USING (public.can_manage_farm(farm_id, auth.uid()))
  WITH CHECK (public.can_manage_farm(farm_id, auth.uid()));

CREATE POLICY "managers delete members"
  ON public.farm_members FOR DELETE TO authenticated
  USING (public.can_manage_farm(farm_id, auth.uid()));

-- Guard: prevent non-managers from mutating their own membership row via any bypass
CREATE OR REPLACE FUNCTION public.guard_farm_member_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_manage_farm(NEW.farm_id, auth.uid()) THEN
    IF NEW.member_role IS DISTINCT FROM OLD.member_role
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Not authorized to change membership role or status';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER farm_members_guard
BEFORE UPDATE ON public.farm_members
FOR EACH ROW EXECUTE FUNCTION public.guard_farm_member_change();

-- 6. Extend farms & plant_logs so assigned farmers can UPDATE (SELECT already permissive)
CREATE POLICY "Members can update assigned farms"
  ON public.farms FOR UPDATE TO authenticated
  USING (public.is_farm_member(id, auth.uid()))
  WITH CHECK (public.is_farm_member(id, auth.uid()));

CREATE POLICY "Members can insert plant logs at assigned farms"
  ON public.plant_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_farm_member(farm_id, auth.uid()));

CREATE POLICY "Members can update assigned plant logs"
  ON public.plant_logs FOR UPDATE TO authenticated
  USING (public.is_farm_member(farm_id, auth.uid()))
  WITH CHECK (public.is_farm_member(farm_id, auth.uid()));

-- Farm-visit reads: managers of the farm can also see visits
CREATE POLICY "Managers read farm visits"
  ON public.farm_visits FOR SELECT TO authenticated
  USING (public.can_manage_farm(farm_id, auth.uid()));

-- 7. farmer_submissions
CREATE TABLE IF NOT EXISTS public.farmer_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  plant_log_id uuid REFERENCES public.plant_logs(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_type public.submission_type NOT NULL DEFAULT 'progress',
  title text NOT NULL,
  observations text,
  image_urls text[] NOT NULL DEFAULT '{}',
  measurement_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.submission_status NOT NULL DEFAULT 'draft',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_farm ON public.farmer_submissions(farm_id);
CREATE INDEX IF NOT EXISTS idx_submissions_author ON public.farmer_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.farmer_submissions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farmer_submissions TO authenticated;
GRANT ALL ON public.farmer_submissions TO service_role;

ALTER TABLE public.farmer_submissions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER submissions_updated_at
BEFORE UPDATE ON public.farmer_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: author sees own; reviewers see all for farms they manage/review
CREATE POLICY "authors and reviewers can read submissions"
  ON public.farmer_submissions FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.can_review_farm(farm_id, auth.uid())
  );

CREATE POLICY "members create own submissions"
  ON public.farmer_submissions FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.is_farm_member(farm_id, auth.uid())
  );

-- Update guards split between author edits and reviewer actions
CREATE POLICY "authors edit own drafts"
  ON public.farmer_submissions FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid() AND status IN ('draft','rejected')
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND status IN ('draft','submitted')
  );

CREATE POLICY "reviewers review submissions"
  ON public.farmer_submissions FOR UPDATE TO authenticated
  USING (public.can_review_farm(farm_id, auth.uid()))
  WITH CHECK (public.can_review_farm(farm_id, auth.uid()));

CREATE POLICY "authors delete own drafts"
  ON public.farmer_submissions FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND status = 'draft');

CREATE POLICY "reviewers delete submissions"
  ON public.farmer_submissions FOR DELETE TO authenticated
  USING (public.can_review_farm(farm_id, auth.uid()));

-- Author guard trigger: authors cannot set reviewer fields
CREATE OR REPLACE FUNCTION public.guard_submission_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF public.can_review_farm(NEW.farm_id, auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Author path: block reviewer-only fields from changing
  IF NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
     OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'Not authorized to modify review fields';
  END IF;
  -- Author may only move status draft/rejected -> draft/submitted
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('draft','submitted') THEN
    RAISE EXCEPTION 'Not authorized to set that submission status';
  END IF;
  IF NEW.status = 'submitted' AND OLD.status NOT IN ('draft','rejected') THEN
    RAISE EXCEPTION 'Only drafts can be submitted';
  END IF;
  IF NEW.status = 'submitted' AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER submissions_guard
BEFORE UPDATE ON public.farmer_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_submission_change();

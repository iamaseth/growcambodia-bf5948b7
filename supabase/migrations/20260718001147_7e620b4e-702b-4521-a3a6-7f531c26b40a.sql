
-- Fix: viewers should not be able to modify farms or plant_logs
DROP POLICY IF EXISTS "Members can update assigned farms" ON public.farms;
CREATE POLICY "Managers can update assigned farms"
  ON public.farms FOR UPDATE
  USING (public.can_manage_farm(id, auth.uid()))
  WITH CHECK (public.can_manage_farm(id, auth.uid()));

DROP POLICY IF EXISTS "Members can update assigned plant logs" ON public.plant_logs;
CREATE POLICY "Managers can update assigned plant logs"
  ON public.plant_logs FOR UPDATE
  USING (public.can_manage_farm(farm_id, auth.uid()))
  WITH CHECK (public.can_manage_farm(farm_id, auth.uid()));

DROP POLICY IF EXISTS "Members can insert plant logs at assigned farms" ON public.plant_logs;
CREATE POLICY "Managers can insert plant logs at assigned farms"
  ON public.plant_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.can_manage_farm(farm_id, auth.uid()));

-- Fix: revoke direct EXECUTE on SECURITY DEFINER helpers from PUBLIC/authenticated/anon.
-- These are invoked from RLS policies where PostgreSQL evaluates them without
-- requiring the caller to hold EXECUTE, so revoking does not break policy checks.
REVOKE EXECUTE ON FUNCTION public.is_farm_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_farm(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_review_farm(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.farm_member_role(uuid, uuid) FROM PUBLIC, anon, authenticated;

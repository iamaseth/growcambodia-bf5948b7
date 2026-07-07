
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
-- Allow the helper to be used inside RLS policies via SECURITY DEFINER without needing broad execute:
-- policies evaluate as the definer, so this is safe. Keep authenticated execute for app-level checks:
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

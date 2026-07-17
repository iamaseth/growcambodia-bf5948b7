
REVOKE EXECUTE ON FUNCTION public.is_farm_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.farm_member_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_farm(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_review_farm(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_owner_membership() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_farm_member_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_submission_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_farm_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.farm_member_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_farm(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_farm(uuid, uuid) TO authenticated;

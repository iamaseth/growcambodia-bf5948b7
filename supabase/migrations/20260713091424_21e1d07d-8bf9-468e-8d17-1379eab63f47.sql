DROP POLICY IF EXISTS "roles readable to authenticated" ON public.user_roles;
CREATE POLICY "users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
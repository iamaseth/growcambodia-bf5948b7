
-- Restrict farms SELECT to authenticated users (hide GPS/address from unauthenticated public)
DROP POLICY IF EXISTS "Farms are viewable by everyone" ON public.farms;
CREATE POLICY "Authenticated users can view farms"
  ON public.farms FOR SELECT TO authenticated
  USING (true);

-- Restrict crop_knowledge writes to admins/moderators (fixes always-true INSERT/UPDATE)
DROP POLICY IF EXISTS "Authenticated can insert crop knowledge" ON public.crop_knowledge;
DROP POLICY IF EXISTS "Authenticated can update crop knowledge" ON public.crop_knowledge;
CREATE POLICY "Admins insert crop knowledge"
  ON public.crop_knowledge FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Admins update crop knowledge"
  ON public.crop_knowledge FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Enforce agronomist role and prevent client-side AI badge spoofing on update_comments INSERT
DROP POLICY IF EXISTS "Users insert own comments" ON public.update_comments;
CREATE POLICY "Users insert own comments"
  ON public.update_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (is_agronomist_reply = false OR public.has_role(auth.uid(), 'agronomist'))
    AND is_ai = false
  );

-- Restrict crop-photos storage reads to authenticated users only
DROP POLICY IF EXISTS "Crop photos public read" ON storage.objects;
CREATE POLICY "Authenticated read crop photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crop-photos');

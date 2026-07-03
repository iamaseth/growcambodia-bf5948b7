
CREATE POLICY "Crop photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'crop-photos');

CREATE POLICY "Users upload crop photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crop-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own crop photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crop-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own crop photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crop-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

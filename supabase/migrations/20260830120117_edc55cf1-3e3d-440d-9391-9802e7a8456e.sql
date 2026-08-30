ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS storage_path text;

CREATE POLICY "store_media_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-media');

CREATE POLICY "store_media_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-media'
    AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "store_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-media'
    AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'store-media'
    AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "store_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-media'
    AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid())
  );
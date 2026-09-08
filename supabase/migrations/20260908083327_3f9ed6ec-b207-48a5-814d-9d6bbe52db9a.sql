-- Tighten anonymous read access on store-media: only public-facing folders of
-- published stores. Staff keep full access to their own store's objects.
DROP POLICY IF EXISTS store_media_read ON storage.objects;

CREATE POLICY store_media_read ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'store-media'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (
    (
      auth.uid() IS NOT NULL
      AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid())
    )
    OR (
      app_private.is_store_published(((storage.foldername(name))[1])::uuid)
      AND (storage.foldername(name))[2] IN ('products', 'branding', 'library')
    )
  )
);
-- ============================================================================
-- Longer browser cache for uploaded images
-- ----------------------------------------------------------------------------
-- Storage served every photo in `menu-images` with `Cache-Control: max-age=3600`
-- (Supabase's default when the upload doesn't say otherwise). An hour later the
-- browser has to re-validate each photo over the network before it will paint
-- one, which is why images appeared to reload on every navigation. With 270
-- objects averaging 1.5 MB that is a lot of round trips for bytes the browser
-- already holds.
--
-- A year is safe here because object keys are UUIDs: the bytes behind a given
-- URL never change. Replacing a photo writes a NEW key and a new URL, and the
-- row that points at it is what changes, so a stale cache entry can't survive
-- an edit.
--
-- This only rewrites the cache-control metadata. No file is re-uploaded, moved
-- or deleted. New uploads set the same value at upload time
-- (UPLOAD_CACHE_CONTROL in apps/web/src/services/imageUpload.ts), and that path
-- IS confirmed: a photo uploaded after that change serves max-age=31536000.
--
-- UNVERIFIED for the objects that already existed. Storage may serve the header
-- from the backing S3 object rather than from this DB mirror, in which case the
-- 270 rows updated here change nothing that a browser sees. It could not be
-- proven either way from here: Cloudflare kept returning CF-Cache-Status: HIT
-- with the old max-age=3600 for every existing URL.
--
-- To check: curl -sSI a long-untouched menu-images URL and read Cache-Control.
-- If it still says 3600 once the CDN entry has expired, this statement is inert
-- and the existing objects need re-uploading (or a Storage API copy-onto-self)
-- to pick the new value up. Harmless either way; the mirror is correct now.
--
-- Fully re-runnable.
-- ============================================================================
update storage.objects
set metadata = jsonb_set(metadata, '{cacheControl}', '"max-age=31536000"'::jsonb)
where bucket_id = 'menu-images'
  and metadata ? 'cacheControl'
  and metadata ->> 'cacheControl' is distinct from 'max-age=31536000';

-- Expand project-media bucket MIME allowlist for DJI/iPhone variants.
-- Run in Supabase SQL editor if uploads fail with MIME-related storage errors.
UPDATE storage.buckets
SET
  file_size_limit = GREATEST(file_size_limit, 524288000),
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/m4v',
    'application/octet-stream'
  ]
WHERE id = 'project-media';

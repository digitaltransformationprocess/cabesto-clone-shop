-- Rewrite local /media/... paths to Supabase Storage public URLs
-- Run after upload completes.

do $$
declare
  base text := 'https://dlxismvcvhbbhcaovzrz.supabase.co/storage/v1/object/public/product-media';
begin
  update public.products
  set cover_path = base || substr(cover_path, length('/media') + 1)
  where cover_path like '/media/%'
    and cover_path not like 'https://%';

  update public.product_images
  set path = base || substr(path, length('/media') + 1)
  where path like '/media/%'
    and path not like 'https://%';
end $$;

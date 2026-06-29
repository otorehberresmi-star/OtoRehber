-- Remove old demo/mock content that may still be stored in Supabase.
-- Review before running. This targets records created without a real user_id
-- and known placeholder/demo content patterns.

delete from public.comments
where user_id is null
   or lower(coalesce("user", '')) like '%test kullanıcısı%'
   or lower(coalesce(avatar, '')) like '%pravatar%'
   or lower(coalesce(avatar, '')) like '%placeholder%';

delete from public.posts
where user_id is null
   or lower(coalesce("user", '')) like '%test kullanıcısı%'
   or lower(coalesce(avatar, '')) like '%pravatar%'
   or lower(coalesce(avatar, '')) like '%placeholder%'
   or lower(coalesce(title, '')) like '%mock%'
   or lower(coalesce(content, '')) like '%mock%'
   or lower(coalesce(content, '')) like '%audi a3 sınıfının en konforlu%';

delete from public.reviews
where user_id is null
   or lower(coalesce("user", '')) like '%test kullanıcısı%'
   or lower(coalesce(avatar, '')) like '%pravatar%'
   or lower(coalesce(avatar, '')) like '%placeholder%'
   or lower(coalesce(comment, '')) like '%audi a3 sınıfının en konforlu%';

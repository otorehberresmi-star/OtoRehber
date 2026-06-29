-- Sync old denormalized avatar fields with the latest profiles.avatar_url.
-- Run in Supabase Dashboard > SQL Editor when existing posts/reviews/comments
-- still show an older avatar after a user changed their profile photo.

update public.posts p
set avatar = pr.avatar_url
from public.profiles pr
where p.user_id = pr.id
  and pr.avatar_url is not null
  and coalesce(p.avatar, '') is distinct from pr.avatar_url;

update public.reviews r
set avatar = pr.avatar_url
from public.profiles pr
where r.user_id = pr.id
  and pr.avatar_url is not null
  and coalesce(r.avatar, '') is distinct from pr.avatar_url;

update public.comments c
set avatar = pr.avatar_url
from public.profiles pr
where c.user_id = pr.id
  and pr.avatar_url is not null
  and coalesce(c.avatar, '') is distinct from pr.avatar_url;

update public.notifications n
set actor_avatar = pr.avatar_url
from public.profiles pr
where n.actor_id = pr.id
  and pr.avatar_url is not null
  and coalesce(n.actor_avatar, '') is distinct from pr.avatar_url;

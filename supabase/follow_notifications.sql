-- Sends an actor-aware notification when a user is followed.

create unique index if not exists notifications_follow_actor_unique
on public.notifications(user_id, type, actor_id)
where actor_id is not null and type = 'follow';

create or replace function public.notify_user_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_display_name text;
  actor_avatar_url text;
begin
  select
    coalesce(nullif(display_name, ''), nullif(full_name, ''), 'Bir kullanıcı'),
    avatar_url
  into actor_display_name, actor_avatar_url
  from public.profiles
  where id = new.follower_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    actor_id,
    actor_name,
    actor_avatar,
    metadata
  )
  values (
    new.following_id,
    'follow',
    coalesce(actor_display_name, 'Bir kullanıcı'),
    'seni takip etmeye başladı.',
    new.follower_id,
    coalesce(actor_display_name, 'Bir kullanıcı'),
    actor_avatar_url,
    jsonb_build_object('follower_id', new.follower_id)
  )
  on conflict do nothing;

  return new;
end;
$function$;

create or replace function public.remove_user_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.notifications
  where user_id = old.following_id
    and type = 'follow'
    and actor_id = old.follower_id;

  return old;
end;
$function$;

drop trigger if exists notify_user_follow_trigger on public.user_follows;
create trigger notify_user_follow_trigger
after insert on public.user_follows
for each row execute function public.notify_user_follow();

drop trigger if exists remove_user_follow_notification_trigger
on public.user_follows;
create trigger remove_user_follow_notification_trigger
after delete on public.user_follows
for each row execute function public.remove_user_follow_notification();

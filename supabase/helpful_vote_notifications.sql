-- Run this file as a whole in Supabase SQL Editor.
-- Creates actor-aware notifications for post, comment and review votes.

drop trigger if exists notify_like_from_post_update_trigger on public.posts;
drop trigger if exists notify_like_from_comment_update_trigger on public.comments;
drop trigger if exists notify_post_vote_change_trigger on public.post_votes;
drop trigger if exists notify_comment_vote_change_trigger on public.comment_votes;
drop trigger if exists notify_review_helpful_vote_change_trigger on public.review_helpful_votes;

drop index if exists public.notifications_like_post_unique;
drop index if exists public.notifications_like_comment_unique;

create unique index if not exists notifications_post_vote_actor_unique
on public.notifications(user_id, type, post_id, actor_id)
where post_id is not null and actor_id is not null and type = 'post_vote';

create unique index if not exists notifications_comment_vote_actor_unique
on public.notifications(user_id, type, comment_id, actor_id)
where comment_id is not null and actor_id is not null and type = 'comment_vote';

create unique index if not exists notifications_helpful_vote_actor_unique
on public.notifications(user_id, type, review_id, actor_id)
where review_id is not null and actor_id is not null and type = 'helpful_vote';

create or replace function public.notify_helpful_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_user_id uuid;
  owner_user_id uuid;
  target_post_id uuid;
  target_comment_id uuid;
  target_review_id uuid;
  notification_type text;
  notification_message text;
  notification_quote text;
  actor_display_name text;
  actor_avatar_url text;
begin
  actor_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if tg_table_name = 'post_votes' then
    target_post_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
    notification_type := 'post_vote';
  elsif tg_table_name = 'comment_votes' then
    target_comment_id := case when tg_op = 'DELETE' then old.comment_id else new.comment_id end;
    notification_type := 'comment_vote';
  else
    target_review_id := case when tg_op = 'DELETE' then old.review_id else new.review_id end;
    notification_type := 'helpful_vote';
  end if;

  if tg_op = 'DELETE' then
    delete from public.notifications
    where type = notification_type
      and actor_id = actor_user_id
      and (target_post_id is null or post_id = target_post_id)
      and (target_comment_id is null or comment_id = target_comment_id)
      and (target_review_id is null or review_id = target_review_id);
    return old;
  end if;

  if notification_type = 'post_vote' then
    select p.user_id, 'gönderini faydalı buldu.',
           left(concat_ws(' — ', nullif(p.title, ''), nullif(p.content, '')), 180)
    into owner_user_id, notification_message, notification_quote
    from public.posts p where p.id = target_post_id;
  elsif notification_type = 'comment_vote' then
    select c.user_id, c.post_id, c.review_id, 'yorumunu faydalı buldu.',
           left(coalesce(c.text, c.content, ''), 140)
    into owner_user_id, target_post_id, target_review_id,
         notification_message, notification_quote
    from public.comments c where c.id = target_comment_id;
  else
    select r.user_id, 'deneyimini faydalı buldu.',
           left(concat_ws(' — ', nullif(r.title, ''), nullif(r.comment, '')), 180)
    into owner_user_id, notification_message, notification_quote
    from public.reviews r where r.id = target_review_id;
  end if;

  if owner_user_id is null or owner_user_id = actor_user_id then
    return new;
  end if;

  select coalesce(nullif(display_name, ''), nullif(full_name, ''), 'Bir kullanıcı'),
         avatar_url
  into actor_display_name, actor_avatar_url
  from public.profiles where id = actor_user_id;

  if not exists (
    select 1 from public.notification_preferences np
    where np.user_id = owner_user_id
      and (
        coalesce(np.push_enabled, true) = false
        or coalesce(np.likes_enabled, true) = false
      )
  ) then
    insert into public.notifications (
      user_id, type, title, message, quote,
      actor_id, actor_name, actor_avatar,
      post_id, review_id, comment_id
    )
    values (
      owner_user_id, notification_type,
      coalesce(actor_display_name, 'Bir kullanıcı'),
      notification_message, notification_quote,
      actor_user_id, coalesce(actor_display_name, 'Bir kullanıcı'),
      actor_avatar_url, target_post_id, target_review_id, target_comment_id
    )
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

create trigger notify_post_vote_change_trigger
after insert or delete on public.post_votes
for each row execute function public.notify_helpful_vote_change();

create trigger notify_comment_vote_change_trigger
after insert or delete on public.comment_votes
for each row execute function public.notify_helpful_vote_change();

create trigger notify_review_helpful_vote_change_trigger
after insert or delete on public.review_helpful_votes
for each row execute function public.notify_helpful_vote_change();

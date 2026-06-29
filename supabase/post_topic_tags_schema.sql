-- Persists the topic types selected while creating a post.

alter table public.posts
add column if not exists topic_tags text[] not null default '{}'::text[];

create index if not exists posts_topic_tags_idx
on public.posts using gin(topic_tags);

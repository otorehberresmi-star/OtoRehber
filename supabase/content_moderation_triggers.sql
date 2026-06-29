-- Blocks profanity/insults at the database layer for public user-generated text.
-- Run in Supabase SQL Editor after complete_schema_migration.sql.

create or replace function public.contains_blocked_language(input_text text)
returns boolean
language plpgsql
stable
as $$
declare
  clean text;
  compact text;
  term text;
  blocked_terms text[] := array[
    'amk',
    'aq',
    'amq',
    'amina',
    'amcik',
    'amcuk',
    'orospu',
    'orosbu',
    'pic',
    'siktir',
    'sikerim',
    'sikeyim',
    'sikik',
    'sikis',
    'yarrak',
    'yarak',
    'got',
    'ibne',
    'pezevenk',
    'kahpe',
    'pust',
    'surtuk',
    'gerizekali'
  ];
begin
  if input_text is null or btrim(input_text) = '' then
    return false;
  end if;

  clean := lower(input_text);
  clean := translate(clean, 'çğıöşüÇĞİÖŞÜı', 'cgiosuCGIOSUi');
  clean := replace(clean, '0', 'o');
  clean := replace(clean, '1', 'i');
  clean := replace(clean, '!', 'i');
  clean := replace(clean, '3', 'e');
  clean := replace(clean, '4', 'a');
  clean := replace(clean, '@', 'a');
  clean := replace(clean, '5', 's');
  clean := replace(clean, '$', 's');
  clean := replace(clean, '7', 't');
  clean := regexp_replace(clean, '[^a-z0-9]+', ' ', 'g');
  compact := regexp_replace(clean, '[^a-z0-9]+', '', 'g');

  foreach term in array blocked_terms loop
    if clean ~ ('(^|[[:space:]])' || term || '([[:space:]]|$)')
      or position(term in compact) > 0 then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.reject_blocked_language()
returns trigger
language plpgsql
as $$
begin
  if TG_TABLE_NAME = 'posts' then
    if public.contains_blocked_language(new.title)
      or public.contains_blocked_language(new.content) then
      raise exception 'Uygunsuz içerik: Küfür veya hakaret içeren metin paylaşılamaz.';
    end if;
  elsif TG_TABLE_NAME = 'reviews' then
    if public.contains_blocked_language(new.title)
      or public.contains_blocked_language(new.comment) then
      raise exception 'Uygunsuz içerik: Küfür veya hakaret içeren metin paylaşılamaz.';
    end if;
  elsif TG_TABLE_NAME = 'comments' then
    if public.contains_blocked_language(new.content)
      or public.contains_blocked_language(new.text) then
      raise exception 'Uygunsuz içerik: Küfür veya hakaret içeren metin paylaşılamaz.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_reject_blocked_language on public.posts;
create trigger posts_reject_blocked_language
before insert or update of title, content on public.posts
for each row execute function public.reject_blocked_language();

drop trigger if exists reviews_reject_blocked_language on public.reviews;
create trigger reviews_reject_blocked_language
before insert or update of title, comment on public.reviews
for each row execute function public.reject_blocked_language();

drop trigger if exists comments_reject_blocked_language on public.comments;
create trigger comments_reject_blocked_language
before insert or update of content, text on public.comments
for each row execute function public.reject_blocked_language();

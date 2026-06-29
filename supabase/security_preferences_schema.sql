-- OtoRehber profile privacy preference.
-- TOTP factors are persisted by Supabase Auth; biometric preference is stored
-- encrypted on the user's device with Expo SecureStore.

alter table public.profiles
add column if not exists is_private boolean not null default false;

create or replace view public.public_profiles as
select
  id,
  case when is_private then 'Gizli Kullanıcı' else display_name end as display_name,
  case when is_private then null else full_name end as full_name,
  case when is_private then null else avatar_url end as avatar_url,
  created_at,
  is_private
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

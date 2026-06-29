-- Versioned legal document acknowledgements captured during registration.

create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'registration',
  metadata jsonb not null default '{}'::jsonb,
  constraint legal_consents_document_type_check
    check (document_type in ('terms', 'kvkk', 'privacy', 'marketing_consent')),
  constraint legal_consents_source_check
    check (source in ('registration', 'settings', 'migration'))
);

create unique index if not exists legal_consents_user_document_version_unique
on public.legal_consents(user_id, document_type, document_version);

create index if not exists legal_consents_user_accepted_idx
on public.legal_consents(user_id, accepted_at desc);

alter table public.legal_consents enable row level security;

drop policy if exists "Users can read their own legal consents"
on public.legal_consents;
drop policy if exists "Users can record their own legal consents"
on public.legal_consents;

create policy "Users can read their own legal consents"
on public.legal_consents for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can record their own legal consents"
on public.legal_consents for insert
to authenticated
with check (auth.uid() = user_id);

-- Consent history is intentionally immutable from the client.
-- Corrections or retention operations must use a trusted server process.

do $$
begin
  alter table public.legal_consents
    drop constraint if exists legal_consents_document_type_check;

  alter table public.legal_consents
    add constraint legal_consents_document_type_check
    check (document_type in ('terms', 'kvkk', 'privacy', 'marketing_consent'));
end;
$$;

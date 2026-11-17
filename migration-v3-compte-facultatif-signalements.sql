-- Version 3 : compte facultatif (sessions anonymes) + signalements communautaires.
-- À exécuter une fois dans Supabase (SQL Editor > New query > Run), APRÈS migration-reno.sql.

-- 1) Les sessions anonymes n'ont ni courriel ni téléphone : le contact devient facultatif.
alter table public.profiles alter column contact drop not null;

-- Quand un compte anonyme est relié à un courriel ou un cellulaire, le profil suit.
create or replace function public.maj_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set contact = coalesce(new.email, new.phone) where id = new.id;
  return new;
end $$;
revoke execute on function public.maj_contact() from public, anon, authenticated;
drop trigger if exists contact_change on auth.users;
create trigger contact_change after update of email, phone on auth.users
  for each row when (coalesce(new.email, new.phone) is distinct from coalesce(old.email, old.phone))
  execute function public.maj_contact();

-- 2) Signalements : seulement par des comptes à l'identité confirmée, un par annonce et par personne.
create table if not exists public.signalements (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lien text not null check (char_length(lien) <= 500),
  motif text not null check (motif in ('argent_avant_bail','faux_proprietaire','logement_inexistant','photos_volees','autre')),
  created_at timestamptz not null default now(),
  unique (user_id, lien)
);
create index if not exists signalements_lien_idx on public.signalements (lien);
alter table public.signalements enable row level security;

drop policy if exists "signaler si identite confirmee" on public.signalements;
create policy "signaler si identite confirmee" on public.signalements
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.identite_statut = 'confirmee')
  );
drop policy if exists "voir ses signalements" on public.signalements;
create policy "voir ses signalements" on public.signalements
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "retirer ses signalements" on public.signalements;
create policy "retirer ses signalements" on public.signalements
  for delete to authenticated using (user_id = auth.uid());

-- Nombre de signalements d'une annonce, sans révéler qui a signalé.
create or replace function public.nb_signalements(p_lien text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.signalements where lien = p_lien;
$$;
revoke execute on function public.nb_signalements(text) from public;
grant execute on function public.nb_signalements(text) to authenticated;

-- HabitaScan v4 : espace admin, montants modifiables, suppression du compte
-- À appliquer après migration-v3-compte-facultatif-signalements.sql
-- Ensuite, se donner le rôle admin (remplacer le courriel) :
--   insert into public.admins (user_id) select id from auth.users where email = 'toi@exemple.ca';

-- 1. Qui est admin
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ajoute_le timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Aucune politique : la table n'est lisible qu'à travers est_admin().

create or replace function public.est_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.est_admin() from public, anon;
grant execute on function public.est_admin() to authenticated;

-- 2. Montants du budget modifiables sans toucher au code
create table if not exists public.parametres (
  cle text primary key check (cle ~ '^[a-z_]{2,40}$'),
  valeur numeric not null check (valeur > 0 and valeur < 100000),
  maj_le timestamptz not null default now()
);
alter table public.parametres enable row level security;
drop policy if exists parametres_lecture on public.parametres;
create policy parametres_lecture on public.parametres for select to anon, authenticated using (true);
drop policy if exists parametres_admin on public.parametres;
create policy parametres_ajout on public.parametres for insert to authenticated with check ((select public.est_admin()));
create policy parametres_modif on public.parametres for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
insert into public.parametres (cle, valeur) values
  ('transit_montreal', 110), ('transit_quebec', 115), ('transit_gatineau', 116.5),
  ('assurance', 31), ('epicerie', 366), ('garde_jour', 9.65)
on conflict (cle) do nothing;

-- Loyers SCHL : l'admin peut les modifier
alter table public.loyers_reference enable row level security;
drop policy if exists loyers_admin on public.loyers_reference;
create policy loyers_ajout on public.loyers_reference for insert to authenticated with check ((select public.est_admin()));
create policy loyers_modif on public.loyers_reference for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));

-- 3. Fonctions admin (chacune vérifie est_admin)
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return jsonb_build_object(
    'utilisateurs', (select count(*) from auth.users),
    'nouveaux_7j', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'verifications', (select count(*) from public.verifications),
    'verifications_7j', (select count(*) from public.verifications where created_at > now() - interval '7 days'),
    'rouges', (select count(*) from public.verifications where couleur = 'r'),
    'signalements', (select count(*) from public.signalements),
    'identites_attente', (select count(*) from public.profiles where identite_statut = 'en_attente'));
end $$;

create or replace function public.admin_identites()
returns table (id uuid, contact text, doc_type text, soumise_le timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select p.id, p.contact,
           p.identite_doc_type,
           coalesce(p.identite_soumise_le, (select max(o.created_at) from storage.objects o
             where o.bucket_id = 'pieces-identite' and (storage.foldername(o.name))[1] = p.id::text))
    from public.profiles p where p.identite_statut = 'en_attente'
    order by 4 nulls last;
end $$;

create or replace function public.admin_decider_identite(p_id uuid, p_statut text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_statut not in ('confirmee','refusee') then raise exception 'statut invalide'; end if;
  update public.profiles set identite_statut = p_statut where id = p_id;
end $$;

create or replace function public.admin_signalements()
returns table (lien text, nb bigint, motifs text[], dernier timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select s.lien, count(*), array_agg(distinct s.motif), max(s.created_at)
    from public.signalements s group by s.lien order by 4 desc limit 200;
end $$;

create or replace function public.admin_retirer_signalements(p_lien text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  delete from public.signalements where lien = p_lien;
end $$;

revoke all on function public.admin_stats(), public.admin_identites(), public.admin_decider_identite(uuid, text),
  public.admin_signalements(), public.admin_retirer_signalements(text) from public, anon;
grant execute on function public.admin_stats(), public.admin_identites(), public.admin_decider_identite(uuid, text),
  public.admin_signalements(), public.admin_retirer_signalements(text) to authenticated;

-- 4. L'admin peut voir puis supprimer les photos de pièces d'identité
drop policy if exists identite_admin_lecture on storage.objects;
create policy identite_admin_lecture on storage.objects for select to authenticated
  using (bucket_id = 'pieces-identite' and (select public.est_admin()));
drop policy if exists identite_admin_suppression on storage.objects;
create policy identite_admin_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'pieces-identite' and (select public.est_admin()));

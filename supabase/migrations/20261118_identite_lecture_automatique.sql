-- Lecture automatique de la pièce d'identité (IA) + validation par un admin.
-- Minimisation : jamais le numéro de la pièce (seulement une empreinte SHA-256 salée, pour repérer une pièce réutilisée),
-- seulement l'année de naissance ; à la décision, on ne garde que le prénom, l'initiale du nom et l'expiration.
-- À appliquer dans Supabase : SQL Editor > coller ce fichier > Run.

alter table public.profiles
  add column if not exists identite_prenom text,
  add column if not exists identite_nom text,
  add column if not exists identite_naissance_annee integer,
  add column if not exists identite_expire_le date,
  add column if not exists identite_emetteur text,
  add column if not exists identite_alertes text[],
  add column if not exists identite_empreinte text,
  add column if not exists identite_lue_le timestamptz;

create index if not exists profiles_identite_empreinte_idx on public.profiles (identite_empreinte) where identite_empreinte is not null;

-- Quota : la lecture d'identité suit le réglage « IA active », 5 lectures par jour par défaut.
create or replace function public.consommer_quota(p_fonction text)
 returns boolean language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); maxi integer; total integer; drapeau text;
begin
  if uid is null then return false; end if;
  if public.est_suspendu() then return false; end if;
  drapeau := case p_fonction when 'analyser-annonce' then 'ia_active' when 'lire-identite' then 'ia_active'
                             when 'chercher-annonces' then 'recherche_active' else null end;
  if drapeau is not null and public.param_num(drapeau, 1) = 0 then return false; end if;
  maxi := case when p_fonction in ('chercher-annonces','info-adresse','recherche-image','analyser-annonce','lire-identite')
               then public.param_num('quota_' || replace(p_fonction, '-', '_'), case when p_fonction = 'lire-identite' then 5 else 0 end)::integer
               else 0 end;
  if maxi <= 0 then return false; end if;
  insert into public.quotas (user_id, fonction, jour, n) values (uid, p_fonction, current_date, 1)
  on conflict (user_id, fonction, jour) do update set n = public.quotas.n + 1
  returning n into total;
  return total <= maxi;
end $function$;

-- Liste des pièces à vérifier, avec ce que l'IA a lu.
drop function if exists public.admin_identites();
create function public.admin_identites()
 returns table(id uuid, contact text, doc_type text, soumise_le timestamptz,
               prenom text, nom text, naissance_annee integer, expire_le date, emetteur text, alertes text[], lue_le timestamptz)
 language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select p.id, p.contact, p.identite_doc_type,
           coalesce(p.identite_soumise_le, (select max(o.created_at) from storage.objects o
             where o.bucket_id = 'pieces-identite' and (storage.foldername(o.name))[1] = p.id::text)),
           p.identite_prenom, p.identite_nom, p.identite_naissance_annee, p.identite_expire_le,
           p.identite_emetteur, p.identite_alertes, p.identite_lue_le
    from public.profiles p where p.identite_statut = 'en_attente'
    order by 4 nulls last;
end $function$;
revoke all on function public.admin_identites() from public, anon;
grant execute on function public.admin_identites() to authenticated;

-- Décision : minimisation des données lues.
create or replace function public.admin_decider_identite(p_id uuid, p_statut text)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_statut not in ('confirmee','refusee') then raise exception 'statut invalide'; end if;
  if p_statut = 'confirmee' then
    update public.profiles set identite_statut = 'confirmee',
           identite_nom = nullif(left(coalesce(identite_nom, ''), 1), ''),
           identite_naissance_annee = null, identite_emetteur = null, identite_alertes = null
     where id = p_id;
  else
    update public.profiles set identite_statut = 'refusee',
           identite_prenom = null, identite_nom = null, identite_naissance_annee = null, identite_expire_le = null,
           identite_emetteur = null, identite_alertes = null, identite_empreinte = null, identite_lue_le = null
     where id = p_id;
  end if;
  perform public.journaliser('identite_' || p_statut, (select contact from public.profiles where id = p_id), null);
end $function$;

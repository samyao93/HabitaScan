-- Identité : prénom et nom déclarés par la personne, comparés au nom lu par l'IA, puis vérifiés par un admin.
-- Le nom s'affiche ainsi même si la lecture automatique est indisponible.
-- Minimisation : à la confirmation, on ne garde que le prénom et l'initiale du nom ; tout est effacé en cas de refus.

alter table public.profiles
  add column if not exists identite_prenom_declare text,
  add column if not exists identite_nom_declare text;

-- Comparaison tolérante (majuscules, accents, deuxième prénom) : l'un contient l'autre.
create or replace function public.noms_concordent(a text, b text)
 returns boolean language sql immutable set search_path to ''
as $function$
  select case when coalesce(trim(a), '') = '' or coalesce(trim(b), '') = '' then true else
    position(x in y) > 0 or position(y in x) > 0 end
  from (select
    regexp_replace(translate(lower(a), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '[^a-z]', '', 'g') as x,
    regexp_replace(translate(lower(b), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '[^a-z]', '', 'g') as y) t;
$function$;

-- Soumission : type de pièce + prénom et nom déclarés. L'ancienne version (type seul) est remplacée.
drop function if exists public.soumettre_identite(text);
create or replace function public.soumettre_identite(doc_type text, p_prenom text default null, p_nom text default null)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare pr text := nullif(left(trim(coalesce(p_prenom, '')), 60), ''); nm text := nullif(left(trim(coalesce(p_nom, '')), 60), '');
        al text[];
begin
  if doc_type not in ('permis','passeport','rp') then raise exception 'type de pièce invalide'; end if;
  select coalesce(identite_alertes, '{}') into al from public.profiles where id = auth.uid();
  al := array_remove(al, 'nom_different');
  if exists (select 1 from public.profiles where id = auth.uid() and identite_lue_le is not null
             and (not public.noms_concordent(identite_prenom, pr) or not public.noms_concordent(identite_nom, nm))) then
    al := al || 'nom_different';
  end if;
  update public.profiles
     set identite_doc_type = doc_type,
         identite_statut = case when identite_statut = 'confirmee' then identite_statut else 'en_attente' end,
         identite_soumise_le = now(),
         identite_prenom_declare = pr, identite_nom_declare = nm,
         identite_alertes = case when identite_lue_le is not null then al else identite_alertes end
   where id = auth.uid();
end $function$;

-- Liste des pièces à vérifier : ajoute le nom déclaré.
drop function if exists public.admin_identites();
create function public.admin_identites()
 returns table(id uuid, contact text, doc_type text, soumise_le timestamptz,
               prenom text, nom text, naissance_annee integer, expire_le date, emetteur text, alertes text[], lue_le timestamptz,
               prenom_declare text, nom_declare text)
 language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select p.id, p.contact, p.identite_doc_type,
           coalesce(p.identite_soumise_le, (select max(o.created_at) from storage.objects o
             where o.bucket_id = 'pieces-identite' and (storage.foldername(o.name))[1] = p.id::text)),
           p.identite_prenom, p.identite_nom, p.identite_naissance_annee, p.identite_expire_le,
           p.identite_emetteur, p.identite_alertes, p.identite_lue_le,
           p.identite_prenom_declare, p.identite_nom_declare
    from public.profiles p where p.identite_statut = 'en_attente'
    order by 4 nulls last;
end $function$;

-- Décision : le nom déclaré (vérifié par l'admin sur la photo) devient le nom affiché, minimisé.
create or replace function public.admin_decider_identite(p_id uuid, p_statut text)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_statut not in ('confirmee','refusee') then raise exception 'statut invalide'; end if;
  if p_statut = 'confirmee' then
    update public.profiles set identite_statut = 'confirmee',
           identite_prenom = coalesce(identite_prenom_declare, identite_prenom),
           identite_nom = nullif(left(coalesce(identite_nom_declare, identite_nom, ''), 1), ''),
           identite_prenom_declare = null, identite_nom_declare = null,
           identite_naissance_annee = null, identite_emetteur = null, identite_alertes = null
     where id = p_id;
  else
    update public.profiles set identite_statut = 'refusee',
           identite_prenom = null, identite_nom = null, identite_prenom_declare = null, identite_nom_declare = null,
           identite_naissance_annee = null, identite_expire_le = null,
           identite_emetteur = null, identite_alertes = null, identite_empreinte = null, identite_lue_le = null
     where id = p_id;
  end if;
  perform public.journaliser('identite_' || p_statut, (select contact from public.profiles where id = p_id), null);
end $function$;

-- Ajouter ou corriger le nom d'un compte déjà confirmé (vérifié auparavant sur la pièce).
create or replace function public.admin_definir_nom(p_id uuid, p_prenom text, p_nom text)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if not exists (select 1 from public.profiles where id = p_id and identite_statut = 'confirmee') then
    raise exception 'identite non confirmee';
  end if;
  update public.profiles set
    identite_prenom = nullif(left(trim(coalesce(p_prenom, '')), 60), ''),
    identite_nom = nullif(left(trim(coalesce(p_nom, '')), 1), '')
   where id = p_id;
  perform public.journaliser('identite_nom_defini', (select contact from public.profiles where id = p_id), null);
end $function$;

revoke all on function public.soumettre_identite(text, text, text) from public, anon;
revoke all on function public.admin_identites() from public, anon;
revoke all on function public.admin_definir_nom(uuid, text, text) from public, anon;
grant execute on function public.soumettre_identite(text, text, text) to authenticated;
grant execute on function public.admin_identites() to authenticated;
grant execute on function public.admin_definir_nom(uuid, text, text) to authenticated;

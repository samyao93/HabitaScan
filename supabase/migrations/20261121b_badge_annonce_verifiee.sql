-- Badge « Annonce vérifiée » : un vrai propriétaire prouve une fois qu'il possède l'immeuble ;
-- ses annonces portent un code (HS-XXXXXX) que la vérification HabitaScan reconnaît.
--
-- Preuve, en trois verrous (aucun ne suffit seul) :
--   1. Compte à l'identité confirmée (pièce d'identité déjà vérifiée par un admin).
--   2. Un admin consulte le Registre foncier : le propriétaire inscrit du lot doit correspondre au nom
--      de la pièce d'identité (ou, pour une entreprise, à un dirigeant au registre des entreprises).
--   3. Un code est envoyé PAR LA POSTE à l'adresse du propriétaire tirée des registres publics
--      (dernier acte de vente ou rôle d'évaluation), jamais à une adresse donnée par le demandeur.
--      Un fraudeur qui usurpe le nom d'un propriétaire ne reçoit donc pas le code.
-- HabitaScan n'héberge aucune annonce : le propriétaire publie où il veut (Kijiji, Facebook…).
-- La vérification reconnaît son code HS-XXXXXX dans le texte, ou simplement son numéro ou son courriel.
-- Le badge n'est « vert » que si le numéro ou le courriel de l'annonce est l'un de ceux déclarés par le
-- propriétaire : un code recopié dans une fausse annonce donne « Badge copié » (rouge).
--
-- Minimisation (Loi 25) : l'adresse postale du propriétaire n'est jamais enregistrée (elle sert seulement
-- à l'enveloppe) ; les contacts sont gardés en empreinte SHA-256 et sous forme masquée (514 ••• ••42).
-- Le code de la lettre est gardé en empreinte seulement.
--
-- À appliquer dans SQL Editor (une fois), puis régénérer supabase/schema.sql.

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  statut text not null default 'demande'
    check (statut in ('demande', 'lettre_envoyee', 'verifie', 'refuse', 'revoque', 'bloque')),
  adresse text not null check (char_length(adresse) between 6 and 200),
  ville text check (ville is null or char_length(ville) <= 80),
  lot text check (lot is null or lot ~ '^[0-9]{7,8}$'),
  nom_proprietaire text not null check (char_length(nom_proprietaire) between 2 and 120),
  type_proprietaire text not null default 'personne' check (type_proprietaire in ('personne', 'entreprise')),
  neq text check (neq is null or neq ~ '^[0-9]{10}$'),
  contacts text[] not null default '{}',
  contacts_affiches text[] not null default '{}',
  alerte_nom boolean not null default false,
  code_lettre text,
  essais smallint not null default 0,
  lettre_envoyee_le timestamptz,
  code_public text unique check (code_public is null or code_public ~ '^HS-[A-HJKMNP-Z2-9]{6}$'),
  verifie_le timestamptz,
  expire_le timestamptz,
  motif text check (motif is null or char_length(motif) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists badges_user_idx on public.badges (user_id);
create index if not exists badges_contacts_idx on public.badges using gin (contacts);

-- Aucune politique : la table n'est lisible et modifiable que par les fonctions ci-dessous.
alter table public.badges enable row level security;

-- Réglages (modifiables dans Admin > Montants ou la console) :
insert into public.parametres (cle, valeur) values
  ('badge_actif', 1),                -- 0 = demandes fermées
  ('badge_prix', 0),                 -- gratuit au lancement (réservé pour plus tard)
  ('badge_duree_mois', 12),          -- durée de validité ; un immeuble peut être vendu
  ('badges_max_jour', 3),            -- demandes par compte et par jour
  ('badges_max_compte', 10),         -- badges actifs par compte
  ('badge_seuil_signalements', 3),   -- signalements sur ses contacts → badge suspendu
  ('quota_verifier_badge', 60)       -- vérifications de code par personne et par jour
on conflict (cle) do nothing;

-- Code aléatoire sans caractères ambigus (pas de I, L, O, 0, 1).
create or replace function public.code_aleatoire(n integer)
 returns text language plpgsql volatile set search_path to ''
as $function$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea := extensions.gen_random_bytes(n); r text := ''; i integer;
begin
  for i in 0..n - 1 loop r := r || substr(a, (get_byte(b, i) % 31) + 1, 1); end loop;
  return r;
end $function$;

create or replace function public.empreinte_lettre(p_id uuid, p_code text)
 returns text language sql immutable set search_path to ''
as $function$
  select encode(extensions.digest('habitascan|lettre|' || p_id::text || '|'
    || upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
$function$;

-- 514 ••• ••42 ou j•••@gmail.com
create or replace function public.masquer_contact(p_type text, p_valeur text)
 returns text language plpgsql immutable set search_path to ''
as $function$
declare v text;
begin
  if p_type = 'tel' then
    v := right(regexp_replace(coalesce(p_valeur, ''), '\D', '', 'g'), 10);
    return substr(v, 1, 3) || ' ••• ••' || right(v, 2);
  end if;
  v := lower(trim(coalesce(p_valeur, '')));
  return left(v, 1) || '•••@' || split_part(v, '@', 2);
end $function$;

-- « 1234, rue Exemple, app. 3 » → « rue Exemple, app. 3 » : le locataire compare la rue, pas le numéro.
create or replace function public.rue_sans_numero(p_adresse text)
 returns text language sql immutable set search_path to ''
as $function$
  select regexp_replace(trim(coalesce(p_adresse, '')), '^[0-9]+[A-Za-z]?(-[0-9]*[A-Za-z]?)?\s*,?\s*', '');
$function$;

revoke execute on function public.code_aleatoire(integer) from public, anon, authenticated;
revoke execute on function public.empreinte_lettre(uuid, text) from public, anon, authenticated;
revoke execute on function public.masquer_contact(text, text) from public, anon, authenticated;

-- Demande du propriétaire.
create or replace function public.demander_badge(p_adresse text, p_ville text, p_lot text, p_nom text, p_type text,
                                                 p_neq text, p_tels text[], p_courriels text[], p_consentement boolean)
 returns uuid language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); pr record; emp text[] := '{}'; aff text[] := '{}'; x text; e text; nid uuid;
        nom text := trim(coalesce(p_nom, '')); nn text; ini text; alerte boolean := false;
begin
  if uid is null then raise exception 'session'; end if;
  if public.est_suspendu() then raise exception 'compte suspendu'; end if;
  if public.param_num('badge_actif', 1) = 0 then raise exception 'badge ferme'; end if;
  select * into pr from public.profiles where id = uid;
  if pr.identite_statut is distinct from 'confirmee' then raise exception 'identite non confirmee'; end if;
  if not coalesce(p_consentement, false) then raise exception 'consentement requis'; end if;
  if p_type not in ('personne', 'entreprise') then raise exception 'type invalide'; end if;
  if (select count(*) from public.badges where user_id = uid and created_at > now() - interval '1 day')
     >= public.param_num('badges_max_jour', 3) then raise exception 'trop de demandes'; end if;
  if (select count(*) from public.badges where user_id = uid and statut in ('demande', 'lettre_envoyee', 'verifie', 'bloque'))
     >= public.param_num('badges_max_compte', 10) then raise exception 'trop de badges'; end if;
  foreach x in array coalesce(p_tels[1:3], '{}') loop
    e := public.empreinte_contact('tel', x);
    if e is not null and not e = any(emp) then emp := emp || e; aff := aff || public.masquer_contact('tel', x); end if;
  end loop;
  foreach x in array coalesce(p_courriels[1:3], '{}') loop
    e := public.empreinte_contact('courriel', x);
    if e is not null and not e = any(emp) then emp := emp || e; aff := aff || public.masquer_contact('courriel', x); end if;
  end loop;
  -- Le contact de connexion est prouvé (code à 6 chiffres) : il compte toujours.
  if pr.contact is not null then
    x := case when pr.contact like '%@%' then 'courriel' else 'tel' end;
    e := public.empreinte_contact(x, pr.contact);
    if e is not null and not e = any(emp) then emp := emp || e; aff := aff || public.masquer_contact(x, pr.contact); end if;
  end if;
  if cardinality(emp) = 0 then raise exception 'contact requis'; end if;
  -- Personne : le prénom et l'initiale du nom gardés de la pièce d'identité doivent se retrouver dans le nom
  -- inscrit au Registre foncier. Sinon, alerte pour l'admin (copropriété, nom d'usage…), pas un refus.
  if p_type = 'personne' then
    nn := regexp_replace(translate(lower(nom), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '[^a-z ]', ' ', 'g');
    ini := lower(left(translate(coalesce(pr.identite_nom, ''), 'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç', 'AAAEEEEIIOOUUUCaaaeeeeiioouuuc'), 1));
    alerte := coalesce(pr.identite_prenom, '') = '' or not public.noms_concordent(pr.identite_prenom, nom)
              or (ini <> '' and nn !~ ('(^| )' || ini));
  end if;
  insert into public.badges (user_id, adresse, ville, lot, nom_proprietaire, type_proprietaire, neq, contacts, contacts_affiches, alerte_nom)
  values (uid, trim(p_adresse), nullif(trim(coalesce(p_ville, '')), ''), nullif(regexp_replace(coalesce(p_lot, ''), '\D', '', 'g'), ''),
          nom, p_type, case when p_type = 'entreprise' then nullif(regexp_replace(coalesce(p_neq, ''), '\D', '', 'g'), '') end,
          emp, aff, alerte)
  returning id into nid;
  return nid;
end $function$;

-- Les badges du propriétaire connecté (sans les empreintes ni le code de la lettre).
create or replace function public.mes_badges()
 returns table(id uuid, adresse text, ville text, nom_proprietaire text, statut text, code_public text,
               contacts_affiches text[], lettre_envoyee_le timestamptz, verifie_le timestamptz, expire_le timestamptz,
               essais_restants integer, motif text, created_at timestamptz)
 language sql stable security definer set search_path to ''
as $function$
  select b.id, b.adresse, b.ville, b.nom_proprietaire,
         case when b.statut = 'verifie' and b.expire_le < now() then 'expire' else b.statut end,
         b.code_public, b.contacts_affiches, b.lettre_envoyee_le, b.verifie_le, b.expire_le,
         greatest(0, 5 - b.essais), b.motif, b.created_at
  from public.badges b where b.user_id = (select auth.uid())
  order by b.created_at desc limit 20;
$function$;

-- Le propriétaire entre le code reçu par la poste. 5 essais, valable 60 jours.
-- Renvoie un objet plutôt qu'une erreur, pour que le compteur d'essais soit bien enregistré.
create or replace function public.confirmer_badge(p_id uuid, p_code text)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); b public.badges; c text; i integer := 0;
begin
  if uid is null then return jsonb_build_object('ok', false, 'erreur', 'session'); end if;
  select * into b from public.badges where id = p_id and user_id = uid for update;
  if not found then return jsonb_build_object('ok', false, 'erreur', 'introuvable'); end if;
  if b.statut <> 'lettre_envoyee' then return jsonb_build_object('ok', false, 'erreur', 'pas_de_lettre'); end if;
  if b.lettre_envoyee_le < now() - interval '60 days' then return jsonb_build_object('ok', false, 'erreur', 'code_expire'); end if;
  if b.code_lettre is null or public.empreinte_lettre(b.id, p_code) <> b.code_lettre then
    update public.badges set essais = essais + 1, statut = case when essais + 1 >= 5 then 'bloque' else statut end
     where id = b.id;
    return jsonb_build_object('ok', false, 'erreur', case when b.essais + 1 >= 5 then 'bloque' else 'mauvais_code' end,
                              'restants', greatest(0, 4 - b.essais));
  end if;
  loop
    c := 'HS-' || public.code_aleatoire(6);
    exit when not exists (select 1 from public.badges where code_public = c);
    i := i + 1; if i > 20 then raise exception 'code'; end if;
  end loop;
  update public.badges set statut = 'verifie', code_public = c, verifie_le = now(), code_lettre = null, essais = 0,
         expire_le = now() + make_interval(months => public.param_num('badge_duree_mois', 12)::integer)
   where id = b.id;
  return jsonb_build_object('ok', true, 'code', c);
end $function$;

-- Vérification d'un code trouvé dans une annonce. Compte connecté requis, 60 par jour (anti-énumération).
create or replace function public.verifier_badge(p_code text, p_tels text[], p_courriels text[], p_ville text)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); b public.badges; c text; n integer; emp text[] := '{}'; x text; e text; nsig integer;
        par_contact boolean := false; nb integer := 1;
begin
  if uid is null then return null; end if;
  foreach x in array coalesce(p_tels[1:5], '{}') loop
    e := public.empreinte_contact('tel', x); if e is not null then emp := emp || e; end if;
  end loop;
  foreach x in array coalesce(p_courriels[1:5], '{}') loop
    e := public.empreinte_contact('courriel', x); if e is not null then emp := emp || e; end if;
  end loop;
  c := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if c = '' and cardinality(emp) = 0 then return null; end if;
  insert into public.quotas (user_id, fonction, jour, n) values (uid, 'verifier-badge', current_date, 1)
  on conflict (user_id, fonction, jour) do update set n = public.quotas.n + 1 returning public.quotas.n into n;
  if n > public.param_num('quota_verifier_badge', 60) then return jsonb_build_object('statut', 'quota'); end if;
  if c = '' then
    -- Sans code : le numéro ou le courriel de l'annonce est-il celui d'un propriétaire vérifié ?
    -- Ne répond que s'il l'est (aucune information sur les autres contacts).
    par_contact := true;
    select count(*) into nb from public.badges
     where statut = 'verifie' and expire_le > now() and contacts && emp;
    if nb = 0 then return null; end if;
    select * into b from public.badges
     where statut = 'verifie' and expire_le > now() and contacts && emp
     order by (coalesce(p_ville, '') not in ('', 'Autre') and public.noms_concordent(ville, p_ville)) desc, verifie_le desc
     limit 1;
    c := b.code_public;
  else
    c := 'HS-' || substr(c, 3);
    select * into b from public.badges where code_public = c;
    if not found then return jsonb_build_object('statut', 'inconnu', 'code', c); end if;
    if b.statut = 'revoque' then return jsonb_build_object('statut', 'revoque', 'code', c); end if;
    if b.statut <> 'verifie' or b.expire_le < now() then
      return jsonb_build_object('statut', 'expire', 'code', c, 'expire_le', b.expire_le::date);
    end if;
  end if;
  select count(distinct s.user_id) into nsig from public.signalements_cles s
   where s.type in ('tel', 'courriel') and s.cle = any(b.contacts) and s.created_at > b.verifie_le;
  return jsonb_build_object(
    'statut', case when nsig >= public.param_num('badge_seuil_signalements', 3) then 'suspendu' else 'valide' end,
    'par_contact', par_contact,
    'immeubles', nb,
    'code', c,
    'nom', b.nom_proprietaire,
    'type', b.type_proprietaire,
    'rue', public.rue_sans_numero(b.adresse),
    'ville', b.ville,
    'verifie_le', b.verifie_le::date,
    'expire_le', b.expire_le::date,
    'contacts', to_jsonb(b.contacts_affiches),
    'contacts_fournis', cardinality(emp),
    'contact_correspond', case when cardinality(emp) = 0 then null else emp && b.contacts end,
    'ville_correspond', case when coalesce(p_ville, '') in ('', 'Autre') or b.ville is null then null
                             else public.noms_concordent(b.ville, p_ville) end,
    'signalements', nsig);
end $function$;

-- Console admin.
create or replace function public.admin_badges(p_statut text default '')
 returns table(id uuid, user_id uuid, contact text, identite text, statut text, adresse text, ville text, lot text,
               nom_proprietaire text, type_proprietaire text, neq text, contacts_affiches text[], alerte_nom boolean,
               essais smallint, lettre_envoyee_le timestamptz, code_public text, verifie_le timestamptz,
               expire_le timestamptz, motif text, created_at timestamptz)
 language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select b.id, b.user_id, p.contact,
           nullif(trim(coalesce(p.identite_prenom, '') || ' ' || coalesce(p.identite_nom, '')), '') || case when p.identite_nom is not null then '.' else '' end,
           b.statut, b.adresse, b.ville, b.lot, b.nom_proprietaire, b.type_proprietaire, b.neq, b.contacts_affiches,
           b.alerte_nom, b.essais, b.lettre_envoyee_le, b.code_public, b.verifie_le, b.expire_le, b.motif, b.created_at
    from public.badges b left join public.profiles p on p.id = b.user_id
    where coalesce(p_statut, '') = '' or b.statut = p_statut
    order by (b.statut = 'demande') desc, (b.statut = 'bloque') desc, b.created_at desc limit 300;
end $function$;

-- Registre foncier vérifié : génère le code à imprimer dans la lettre. Il n'est affiché qu'une fois.
-- Relancer la fonction crée un nouveau code (lettre perdue) et annule l'ancien.
create or replace function public.admin_badge_lettre(p_id uuid)
 returns text language plpgsql security definer set search_path to ''
as $function$
declare c text := public.code_aleatoire(8);
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  update public.badges set code_lettre = public.empreinte_lettre(id, c), essais = 0, statut = 'lettre_envoyee',
         lettre_envoyee_le = now(), motif = null
   where id = p_id and statut in ('demande', 'lettre_envoyee', 'bloque');
  if not found then raise exception 'statut invalide'; end if;
  perform public.journaliser('badge_lettre', p_id::text, null);
  return left(c, 4) || '-' || right(c, 4);
end $function$;

create or replace function public.admin_badge_decider(p_id uuid, p_statut text, p_motif text)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_statut not in ('refuse', 'revoque') then raise exception 'statut invalide'; end if;
  update public.badges set statut = p_statut, motif = left(nullif(trim(coalesce(p_motif, '')), ''), 300), code_lettre = null
   where id = p_id;
  perform public.journaliser('badge_' || p_statut, p_id::text, jsonb_build_object('motif', p_motif));
end $function$;

revoke execute on function public.demander_badge(text, text, text, text, text, text, text[], text[], boolean) from public, anon;
revoke execute on function public.mes_badges() from public, anon;
revoke execute on function public.confirmer_badge(uuid, text) from public, anon;
revoke execute on function public.verifier_badge(text, text[], text[], text) from public, anon;
revoke execute on function public.admin_badges(text) from public, anon;
revoke execute on function public.admin_badge_lettre(uuid) from public, anon;
revoke execute on function public.admin_badge_decider(uuid, text, text) from public, anon;
grant execute on function public.demander_badge(text, text, text, text, text, text, text[], text[], boolean) to authenticated;
grant execute on function public.mes_badges() to authenticated;
grant execute on function public.confirmer_badge(uuid, text) to authenticated;
grant execute on function public.verifier_badge(text, text[], text[], text) to authenticated;
grant execute on function public.admin_badges(text) to authenticated;
grant execute on function public.admin_badge_lettre(uuid) to authenticated;
grant execute on function public.admin_badge_decider(uuid, text, text) to authenticated;

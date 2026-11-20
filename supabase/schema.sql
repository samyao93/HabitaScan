-- Structure complète de la base Supabase (schéma public), sans aucune donnée.
-- Générée le 2026-11-20 par outils/exporter-schema.sql à partir de la base en production.
-- Sert de référence et permet de recréer une base vide (environnement de test, reprise après incident) :
--   SQL Editor d'un projet Supabase vide > coller ce fichier > Run.
-- Après toute modification de la base, relancer outils/exporter-schema.sql et remplacer ce fichier.
-- Les fichiers de supabase/migrations/ gardent l'historique des changements ; ce fichier-ci donne l'état actuel.

create table if not exists public.admin_journal (
  id bigint generated always as identity not null,
  admin_id uuid,
  admin_contact text,
  action text not null,
  cible text,
  details jsonb,
  cree_le timestamp with time zone default now() not null
);

create table if not exists public.admins (
  user_id uuid not null,
  ajoute_le timestamp with time zone default now() not null
);

create table if not exists public.connexions (
  id bigint generated always as identity not null,
  user_id uuid not null,
  pays text,
  region text,
  ville text,
  appareil text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.demandes_verif (
  id uuid default gen_random_uuid() not null,
  user_id uuid default auth.uid() not null,
  adresse text not null,
  lot text,
  nom_interlocuteur text,
  role text default 'proprietaire'::text,
  lien text,
  statut text default 'a_payer'::text not null,
  verdict text,
  note text,
  montant numeric,
  stripe_ref text,
  created_at timestamp with time zone default now() not null,
  paye_le timestamp with time zone,
  termine_le timestamp with time zone,
  rapport jsonb,
  verdict_global text
);

create table if not exists public.erreurs_app (
  id bigint generated always as identity not null,
  cree_le timestamp with time zone default now() not null,
  message text not null,
  vue text,
  agent text
);

create table if not exists public.evenements (
  jour date default CURRENT_DATE not null,
  type text not null,
  n integer default 0 not null
);

create table if not exists public.licences_rbq (
  numero text not null,
  nom text,
  autres_noms text,
  sous_categories text,
  mandataire text,
  region text,
  importe_le timestamp with time zone default now() not null
);

create table if not exists public.loyers_reference (
  ville text not null,
  chambres smallint not null,
  loyer integer not null,
  periode text default 'octobre 2025'::text not null,
  source text default 'SCHL, Portail de l''information sur le marché de l''habitation'::text not null
);

create table if not exists public.pages_legales (
  cle text not null,
  contenu text not null,
  maj_le timestamp with time zone default now() not null
);

create table if not exists public.parametres (
  cle text not null,
  valeur numeric not null,
  maj_le timestamp with time zone default now() not null
);

create table if not exists public.parametres_texte (
  cle text not null,
  valeur text not null,
  maj_le timestamp with time zone default now() not null
);

create table if not exists public.profiles (
  id uuid not null,
  contact text,
  identite_statut text default 'aucune'::text not null,
  identite_doc_type text,
  identite_soumise_le timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  partage_lieu boolean default false not null,
  partage_lieu_le timestamp with time zone,
  suspendu boolean default false not null,
  suspendu_motif text,
  suspendu_le timestamp with time zone,
  identite_prenom text,
  identite_nom text,
  identite_naissance_annee integer,
  identite_expire_le date,
  identite_emetteur text,
  identite_alertes text[],
  identite_empreinte text,
  identite_lue_le timestamp with time zone
);

create table if not exists public.quotas (
  user_id uuid not null,
  fonction text not null,
  jour date default CURRENT_DATE not null,
  n integer default 0 not null
);

create table if not exists public.signalements (
  id bigint generated always as identity not null,
  user_id uuid default auth.uid() not null,
  lien text not null,
  motif text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.signalements_cles (
  id bigint generated always as identity not null,
  user_id uuid not null,
  type text not null,
  cle text not null,
  motif text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.verifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid default auth.uid() not null,
  ville text,
  chambres smallint,
  prix integer,
  couleur text not null,
  raisons jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  lien text,
  module text default 'logement'::text not null,
  travaux text,
  licence text,
  photos text[],
  texte_empreinte text
);

alter table public.admin_journal add constraint admin_journal_pkey PRIMARY KEY (id);

alter table public.admins add constraint admins_pkey PRIMARY KEY (user_id);

alter table public.connexions add constraint connexions_pkey PRIMARY KEY (id);

alter table public.demandes_verif add constraint demandes_verif_adresse_check CHECK (((char_length(adresse) >= 6) AND (char_length(adresse) <= 200)));

alter table public.demandes_verif add constraint demandes_verif_lien_check CHECK (((lien IS NULL) OR (char_length(lien) <= 500)));

alter table public.demandes_verif add constraint demandes_verif_lot_check CHECK (((lot IS NULL) OR (lot ~ '^[0-9]{7,8}$'::text)));

alter table public.demandes_verif add constraint demandes_verif_nom_interlocuteur_check CHECK (((nom_interlocuteur IS NULL) OR ((char_length(nom_interlocuteur) >= 2) AND (char_length(nom_interlocuteur) <= 120))));

alter table public.demandes_verif add constraint demandes_verif_note_check CHECK (((note IS NULL) OR (char_length(note) <= 600)));

alter table public.demandes_verif add constraint demandes_verif_pkey PRIMARY KEY (id);

alter table public.demandes_verif add constraint demandes_verif_rapport_taille CHECK (((rapport IS NULL) OR (octet_length((rapport)::text) <= 12000)));

alter table public.demandes_verif add constraint demandes_verif_role_check CHECK (((role IS NULL) OR (role = ANY (ARRAY['proprietaire'::text, 'gestionnaire'::text, 'locataire'::text]))));

alter table public.demandes_verif add constraint demandes_verif_statut_check CHECK ((statut = ANY (ARRAY['a_payer'::text, 'payee'::text, 'terminee'::text, 'remboursee'::text])));

alter table public.demandes_verif add constraint demandes_verif_verdict_check CHECK (((verdict IS NULL) OR (verdict = ANY (ARRAY['correspond'::text, 'ne_correspond_pas'::text, 'compagnie'::text, 'introuvable'::text, 'trouve'::text]))));

alter table public.demandes_verif add constraint demandes_verif_verdict_global_check CHECK (((verdict_global IS NULL) OR (verdict_global = ANY (ARRAY['continuer'::text, 'precautions'::text, 'arreter'::text]))));

alter table public.erreurs_app add constraint erreurs_app_agent_check CHECK ((char_length(agent) <= 160));

alter table public.erreurs_app add constraint erreurs_app_message_check CHECK ((char_length(message) <= 300));

alter table public.erreurs_app add constraint erreurs_app_pkey PRIMARY KEY (id);

alter table public.erreurs_app add constraint erreurs_app_vue_check CHECK ((char_length(vue) <= 40));

alter table public.evenements add constraint evenements_pkey PRIMARY KEY (jour, type);

alter table public.evenements add constraint evenements_type_check CHECK ((type ~ '^[a-z_]{2,40}$'::text));

alter table public.licences_rbq add constraint licences_rbq_numero_check CHECK ((numero ~ '^[0-9]{8,10}$'::text));

alter table public.licences_rbq add constraint licences_rbq_pkey PRIMARY KEY (numero);

alter table public.loyers_reference add constraint loyers_reference_chambres_check CHECK (((chambres >= 1) AND (chambres <= 3)));

alter table public.loyers_reference add constraint loyers_reference_pkey PRIMARY KEY (ville, chambres);

alter table public.pages_legales add constraint pages_legales_cle_check CHECK ((cle = ANY (ARRAY['confidentialite'::text, 'conditions'::text])));

alter table public.pages_legales add constraint pages_legales_contenu_check CHECK (((char_length(contenu) >= 50) AND (char_length(contenu) <= 60000)));

alter table public.pages_legales add constraint pages_legales_pkey PRIMARY KEY (cle);

alter table public.parametres add constraint parametres_cle_check CHECK ((cle ~ '^[a-z_]{2,40}$'::text));

alter table public.parametres add constraint parametres_pkey PRIMARY KEY (cle);

alter table public.parametres add constraint parametres_valeur_check CHECK (((valeur >= (0)::numeric) AND (valeur < (100000)::numeric)));

alter table public.parametres_texte add constraint parametres_texte_cle_check CHECK ((cle ~ '^[a-z_]{2,40}$'::text));

alter table public.parametres_texte add constraint parametres_texte_pkey PRIMARY KEY (cle);

alter table public.parametres_texte add constraint parametres_texte_valeur_check CHECK ((char_length(valeur) <= 500));

alter table public.profiles add constraint profiles_identite_doc_type_check CHECK ((identite_doc_type = ANY (ARRAY['permis'::text, 'passeport'::text, 'rp'::text])));

alter table public.profiles add constraint profiles_identite_statut_check CHECK ((identite_statut = ANY (ARRAY['aucune'::text, 'en_attente'::text, 'confirmee'::text, 'refusee'::text])));

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table public.quotas add constraint quotas_pkey PRIMARY KEY (user_id, fonction, jour);

alter table public.signalements add constraint signalements_lien_check CHECK ((char_length(lien) <= 500));

alter table public.signalements add constraint signalements_motif_check CHECK ((motif = ANY (ARRAY['argent_avant_bail'::text, 'faux_proprietaire'::text, 'logement_inexistant'::text, 'photos_volees'::text, 'autre'::text])));

alter table public.signalements add constraint signalements_pkey PRIMARY KEY (id);

alter table public.signalements add constraint signalements_user_id_lien_key UNIQUE (user_id, lien);

alter table public.signalements_cles add constraint signalements_cles_pkey PRIMARY KEY (id);

alter table public.signalements_cles add constraint signalements_cles_type_check CHECK ((type = ANY (ARRAY['tel'::text, 'courriel'::text, 'photo'::text])));

alter table public.signalements_cles add constraint signalements_cles_user_id_type_cle_key UNIQUE (user_id, type, cle);

alter table public.verifications add constraint verifications_chambres_check CHECK (((chambres >= 1) AND (chambres <= 3)));

alter table public.verifications add constraint verifications_champs_chk CHECK ((((module = 'logement'::text) AND (ville IS NOT NULL) AND (chambres IS NOT NULL) AND (prix IS NOT NULL)) OR ((module = 'reno'::text) AND (travaux IS NOT NULL))));

alter table public.verifications add constraint verifications_couleur_check CHECK ((couleur = ANY (ARRAY['r'::text, 'y'::text, 'g'::text])));

alter table public.verifications add constraint verifications_licence_chk CHECK (((licence IS NULL) OR (licence ~ '^[0-9]{8,10}$'::text)));

alter table public.verifications add constraint verifications_lien_check CHECK (((lien IS NULL) OR (length(lien) <= 500)));

alter table public.verifications add constraint verifications_module_chk CHECK ((module = ANY (ARRAY['logement'::text, 'reno'::text])));

alter table public.verifications add constraint verifications_pkey PRIMARY KEY (id);

alter table public.verifications add constraint verifications_prix_check CHECK ((prix > 0));

alter table public.verifications add constraint verifications_travaux_chk CHECK (((travaux IS NULL) OR (travaux = ANY (ARRAY['toiture'::text, 'portes'::text, 'plomberie'::text, 'chauffage'::text, 'electricite'::text, 'general'::text]))));

alter table public.admins add constraint admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.connexions add constraint connexions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.demandes_verif add constraint demandes_verif_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.quotas add constraint quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.signalements add constraint signalements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.signalements_cles add constraint signalements_cles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.verifications add constraint verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX admin_journal_date ON public.admin_journal USING btree (cree_le DESC);

CREATE INDEX connexions_user_date ON public.connexions USING btree (user_id, created_at DESC);

CREATE INDEX demandes_verif_statut ON public.demandes_verif USING btree (statut, created_at);

CREATE INDEX demandes_verif_user ON public.demandes_verif USING btree (user_id);

CREATE INDEX profiles_identite_empreinte_idx ON public.profiles USING btree (identite_empreinte) WHERE (identite_empreinte IS NOT NULL);

CREATE INDEX signalements_cles_type_cle_idx ON public.signalements_cles USING btree (type, cle);

CREATE INDEX signalements_lien_idx ON public.signalements USING btree (lien);

CREATE INDEX verifications_lien_idx ON public.verifications USING btree (lien) WHERE (lien IS NOT NULL);

CREATE INDEX verifications_user_idx ON public.verifications USING btree (user_id, created_at DESC);

alter table public.admin_journal enable row level security;

alter table public.admins enable row level security;

alter table public.connexions enable row level security;

alter table public.demandes_verif enable row level security;

alter table public.erreurs_app enable row level security;

alter table public.evenements enable row level security;

alter table public.licences_rbq enable row level security;

alter table public.loyers_reference enable row level security;

alter table public.pages_legales enable row level security;

alter table public.parametres enable row level security;

alter table public.parametres_texte enable row level security;

alter table public.profiles enable row level security;

alter table public.quotas enable row level security;

alter table public.signalements enable row level security;

alter table public.signalements_cles enable row level security;

alter table public.verifications enable row level security;

CREATE OR REPLACE FUNCTION public.admin_admins()
 RETURNS TABLE(user_id uuid, contact text, ajoute_le timestamp with time zone, moi boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query select a.user_id, p.contact, a.ajoute_le, a.user_id = auth.uid()
    from public.admins a left join public.profiles p on p.id = a.user_id order by a.ajoute_le;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_ajouter_admin(p_courriel text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid;
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_courriel));
  if uid is null then raise exception 'aucun compte avec ce courriel : la personne doit d''abord s''inscrire dans l''app'; end if;
  insert into public.admins(user_id) values (uid) on conflict do nothing;
  perform public.journaliser('ajouter_admin', p_courriel, null);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_connexions()
 RETURNS TABLE(user_id uuid, contact text, pays text, region text, ville text, appareil text, derniere timestamp with time zone, nb bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select distinct on (c.user_id) c.user_id, p.contact, c.pays, c.region, c.ville, c.appareil, c.created_at,
      count(*) over (partition by c.user_id)
    from public.connexions c join public.profiles p on p.id = c.user_id
    order by c.user_id, c.created_at desc;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decider_identite(p_id uuid, p_statut text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_demandes()
 RETURNS TABLE(id uuid, contact text, adresse text, lot text, nom_interlocuteur text, role text, lien text, statut text, verdict text, note text, montant numeric, created_at timestamp with time zone, paye_le timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select d.id, p.contact, d.adresse, d.lot, d.nom_interlocuteur, d.role, d.lien, d.statut, d.verdict, d.note,
           d.montant, d.created_at, d.paye_le
    from public.demandes_verif d left join public.profiles p on p.id = d.user_id
    where d.statut <> 'a_payer' or d.created_at > now() - interval '2 days'
    order by (d.statut = 'payee') desc, d.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_demandes_liste(p_statut text DEFAULT ''::text)
 RETURNS TABLE(id uuid, user_id uuid, contact text, adresse text, lot text, nom_interlocuteur text, role text, lien text, statut text, verdict text, note text, montant numeric, stripe_ref text, created_at timestamp with time zone, paye_le timestamp with time zone, termine_le timestamp with time zone, rapport jsonb, verdict_global text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query select d.id, d.user_id, p.contact, d.adresse, d.lot, d.nom_interlocuteur, d.role, d.lien, d.statut, d.verdict, d.note,
      d.montant, d.stripe_ref, d.created_at, d.paye_le, d.termine_le, d.rapport, d.verdict_global
    from public.demandes_verif d left join public.profiles p on p.id = d.user_id
    where coalesce(p_statut, '') = '' or d.statut = p_statut
    order by (d.statut = 'payee') desc, d.created_at desc limit 500;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_erreurs(p_limite integer DEFAULT 100)
 RETURNS SETOF erreurs_app
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query select * from public.erreurs_app order by cree_le desc limit least(greatest(p_limite, 1), 500);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_identites()
 RETURNS TABLE(id uuid, contact text, doc_type text, soumise_le timestamp with time zone, prenom text, nom text, naissance_annee integer, expire_le date, emetteur text, alertes text[], lue_le timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_journal_liste(p_limite integer DEFAULT 100)
 RETURNS SETOF admin_journal
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query select * from public.admin_journal order by cree_le desc limit least(greatest(p_limite, 1), 500);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_lieux_resume()
 RETURNS TABLE(region text, ville text, personnes bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select c.region, coalesce(c.ville,'Inconnue'), count(distinct c.user_id)
    from public.connexions c where c.created_at > now() - interval '30 days'
    group by 1, 2 order by 3 desc, 2 limit 50;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_maj_demande(p_id uuid, p_statut text, p_verdict text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_statut not in ('payee','terminee','remboursee') then raise exception 'statut invalide'; end if;
  update public.demandes_verif set
    statut = p_statut,
    verdict = case when p_statut = 'terminee' then p_verdict else verdict end,
    note = coalesce(nullif(p_note, ''), note),
    paye_le = case when p_statut = 'payee' and paye_le is null then now() else paye_le end,
    termine_le = case when p_statut = 'terminee' then now() else termine_le end
  where id = p_id;
  perform public.journaliser('demande_' || p_statut, p_id::text, jsonb_build_object('verdict', p_verdict));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_maj_loyer(p_ville text, p_chambres smallint, p_loyer integer, p_periode text, p_source text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_loyer < 100 or p_loyer > 20000 or p_chambres < 0 or p_chambres > 3 then raise exception 'valeur hors limites'; end if;
  update public.loyers_reference set loyer = p_loyer, periode = p_periode, source = p_source where ville = p_ville and chambres = p_chambres;
  if not found then
    insert into public.loyers_reference(ville, chambres, loyer, periode, source) values (p_ville, p_chambres, p_loyer, p_periode, p_source);
  end if;
  perform public.journaliser('loyer', p_ville || ' ' || p_chambres || ' ch.', jsonb_build_object('loyer', p_loyer, 'periode', p_periode, 'source', p_source));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_maj_page(p_cle text, p_contenu text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_cle not in ('confidentialite', 'conditions') then raise exception 'page inconnue'; end if;
  if char_length(coalesce(p_contenu, '')) < 50 then raise exception 'texte trop court'; end if;
  if char_length(p_contenu) > 60000 then raise exception 'texte trop long'; end if;
  insert into public.pages_legales (cle, contenu, maj_le) values (p_cle, p_contenu, now())
  on conflict (cle) do update set contenu = excluded.contenu, maj_le = now();
  perform public.journaliser('page_legale', p_cle, jsonb_build_object('longueur', char_length(p_contenu)));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_maj_parametre(p_cle text, p_valeur numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare avant numeric;
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_cle !~ '^[a-z_]{2,40}$' then raise exception 'cle invalide'; end if;
  if p_valeur < 0 or p_valeur > 100000 then raise exception 'valeur hors limites'; end if;
  select valeur into avant from public.parametres where cle = p_cle;
  insert into public.parametres(cle, valeur, maj_le) values (p_cle, p_valeur, now())
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now();
  perform public.journaliser('parametre', p_cle, jsonb_build_object('avant', avant, 'apres', p_valeur));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_maj_rapport(p_id uuid, p_rapport jsonb, p_terminer boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g text := p_rapport->>'global'; r text := p_rapport->'registre'->>'resultat'; st text;
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if jsonb_typeof(p_rapport) <> 'object' or octet_length(p_rapport::text) > 12000 then raise exception 'rapport invalide'; end if;
  select statut into st from public.demandes_verif where id = p_id;
  if st is null then raise exception 'demande introuvable'; end if;
  if st not in ('payee','terminee') then raise exception 'la demande doit etre payee'; end if;
  if p_terminer and (g is null or g not in ('continuer','precautions','arreter')) then raise exception 'choisis le verdict global'; end if;
  if p_terminer and (r is null or r not in ('correspond','ne_correspond_pas','compagnie','introuvable','trouve')) then raise exception 'indique le resultat du Registre foncier'; end if;
  update public.demandes_verif set
    rapport = p_rapport,
    verdict_global = case when g in ('continuer','precautions','arreter') then g else verdict_global end,
    verdict = case when r in ('correspond','ne_correspond_pas','compagnie','introuvable','trouve') then r else verdict end,
    note = left(nullif(p_rapport->>'recommandations', ''), 600),
    statut = case when p_terminer then 'terminee' else statut end,
    termine_le = case when p_terminer then coalesce(termine_le, now()) else termine_le end
  where id = p_id;
  perform public.journaliser(case when p_terminer then 'rapport_envoye' else 'rapport_brouillon' end, p_id::text, jsonb_build_object('verdict', g));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_maj_texte(p_cle text, p_valeur text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare avant text;
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_cle not in ('lien_paiement','message_accueil','courriel_support') then raise exception 'cle invalide'; end if;
  if char_length(coalesce(p_valeur, '')) > 500 then raise exception 'texte trop long'; end if;
  if p_cle = 'lien_paiement' and coalesce(p_valeur, '') <> '' and p_valeur !~ '^https://(buy\.stripe\.com|checkout\.stripe\.com)/' then
    raise exception 'le lien doit commencer par https://buy.stripe.com/'; end if;
  select valeur into avant from public.parametres_texte where cle = p_cle;
  insert into public.parametres_texte(cle, valeur, maj_le) values (p_cle, coalesce(p_valeur, ''), now())
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now();
  perform public.journaliser('texte', p_cle, jsonb_build_object('avant', avant, 'apres', p_valeur));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_mesure()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return jsonb_build_object(
    'j7', (select coalesce(jsonb_object_agg(type, s), '{}') from (select type, sum(n) s from public.evenements where jour > current_date - 7 group by type) a),
    'j30', (select coalesce(jsonb_object_agg(type, s), '{}') from (select type, sum(n) s from public.evenements where jour > current_date - 30 group by type) b),
    'payees30', (select count(*) from public.demandes_verif where paye_le > now() - interval '30 days'),
    'erreurs7', (select count(*) from public.erreurs_app where cree_le > now() - interval '7 days'),
    'dernieres', (select coalesce(jsonb_agg(e order by e.cree_le desc), '[]') from (select cree_le, message, vue, agent from public.erreurs_app order by cree_le desc limit 15) e));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_partage_stats()
 RETURNS TABLE(partagent bigint, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query select count(*) filter (where partage_lieu), count(*) from public.profiles;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_retirer_admin(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_id = auth.uid() then raise exception 'tu ne peux pas retirer ton propre acces'; end if;
  if (select count(*) from public.admins) <= 1 then raise exception 'il doit rester au moins un admin'; end if;
  delete from public.admins where user_id = p_id;
  perform public.journaliser('retirer_admin', (select contact from public.profiles where id = p_id), null);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_retirer_cle(p_type text, p_cle text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  delete from public.signalements_cles where type = p_type and cle = p_cle;
  perform public.journaliser('retirer_signalement_' || p_type, left(p_cle, 12), null);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_retirer_signalements(p_lien text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  delete from public.signalements where lien = p_lien;
  perform public.journaliser('retirer_signalements', p_lien, null);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_signalements()
 RETURNS TABLE(lien text, nb bigint, motifs text[], dernier timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select s.lien, count(*), array_agg(distinct s.motif), max(s.created_at)
    from public.signalements s group by s.lien order by 4 desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_signalements_cles()
 RETURNS TABLE(type text, cle text, nb bigint, motifs text[], dernier timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select s.type, s.cle, count(distinct s.user_id), array_agg(distinct s.motif), max(s.created_at)
    from public.signalements_cles s group by s.type, s.cle order by 5 desc limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_suspendre(p_id uuid, p_suspendu boolean, p_motif text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_id = auth.uid() then raise exception 'impossible de se suspendre soi-meme'; end if;
  update public.profiles set suspendu = p_suspendu,
    suspendu_motif = case when p_suspendu then left(nullif(p_motif, ''), 300) else null end,
    suspendu_le = case when p_suspendu then now() else null end
  where id = p_id;
  perform public.journaliser(case when p_suspendu then 'suspendre' else 'reactiver' end, (select contact from public.profiles where id = p_id), jsonb_build_object('motif', p_motif));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_tableau()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return jsonb_build_object(
    'utilisateurs', (select count(*) from auth.users),
    'nouveaux_7j', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'nouveaux_30j', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'actifs_30j', (select count(distinct user_id) from public.verifications where created_at > now() - interval '30 days'),
    'verifications', (select count(*) from public.verifications),
    'verifications_7j', (select count(*) from public.verifications where created_at > now() - interval '7 days'),
    'verifications_30j', (select count(*) from public.verifications where created_at > now() - interval '30 days'),
    'couleurs_30j', (select coalesce(jsonb_object_agg(couleur, n), '{}') from (select couleur, count(*) n from public.verifications where created_at > now() - interval '30 days' group by 1) x),
    'demandes', (select coalesce(jsonb_object_agg(statut, n), '{}') from (select statut, count(*) n from public.demandes_verif group by 1) x),
    'revenus_total', (select coalesce(sum(montant), 0) from public.demandes_verif where statut in ('payee','terminee')),
    'revenus_30j', (select coalesce(sum(montant), 0) from public.demandes_verif where statut in ('payee','terminee') and paye_le > now() - interval '30 days'),
    'en_retard', (select count(*) from public.demandes_verif where statut = 'payee'
                   and paye_le < now() - make_interval(hours => public.param_num('delai_verif_heures', 24)::int)),
    'identites_attente', (select count(*) from public.profiles where identite_statut = 'en_attente'),
    'signalements_30j', (select count(*) from public.signalements where created_at > now() - interval '30 days'),
    'erreurs_24h', (select count(*) from public.erreurs_app where cree_le > now() - interval '24 hours'),
    'suspendus', (select count(*) from public.profiles where suspendu),
    'serie_verifs', (select coalesce(jsonb_agg(jsonb_build_object('jour', j, 'n', coalesce(v.n, 0)) order by j), '[]')
       from generate_series(current_date - 29, current_date, interval '1 day') j
       left join (select created_at::date d, count(*) n from public.verifications where created_at > current_date - 30 group by 1) v on v.d = j::date),
    'serie_inscriptions', (select coalesce(jsonb_agg(jsonb_build_object('jour', j, 'n', coalesce(u.n, 0)) order by j), '[]')
       from generate_series(current_date - 29, current_date, interval '1 day') j
       left join (select created_at::date d, count(*) n from auth.users where created_at > current_date - 30 group by 1) u on u.d = j::date)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_utilisateur(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return jsonb_build_object(
    'profil', (select to_jsonb(p) || jsonb_build_object('derniere_connexion', u.last_sign_in_at,
                 'est_admin', exists(select 1 from public.admins a where a.user_id = p.id))
               from public.profiles p left join auth.users u on u.id = p.id where p.id = p_id),
    'verifications', (select coalesce(jsonb_agg(to_jsonb(v) - 'raisons' - 'user_id' order by v.created_at desc), '[]')
                      from (select * from public.verifications where user_id = p_id order by created_at desc limit 50) v),
    'demandes', (select coalesce(jsonb_agg(to_jsonb(d) - 'user_id' order by d.created_at desc), '[]') from public.demandes_verif d where d.user_id = p_id),
    'connexions', (select coalesce(jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at desc), '[]') from public.connexions c where c.user_id = p_id),
    'signalements', (select count(*) from public.signalements s where s.user_id = p_id),
    'quotas_jour', (select coalesce(jsonb_object_agg(fonction, n), '{}') from public.quotas q where q.user_id = p_id and q.jour = current_date)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_utilisateurs(p_q text DEFAULT ''::text, p_filtre text DEFAULT 'tous'::text, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
 RETURNS TABLE(id uuid, contact text, created_at timestamp with time zone, identite_statut text, suspendu boolean, est_admin boolean, nb_verifs bigint, nb_demandes bigint, derniere_activite timestamp with time zone, dernier_lieu text, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
  with base as (
    select p.id, p.contact, p.created_at, p.identite_statut, p.suspendu,
      exists(select 1 from public.admins a where a.user_id = p.id) est_admin,
      (select count(*) from public.verifications v where v.user_id = p.id) nb_verifs,
      (select count(*) from public.demandes_verif d where d.user_id = p.id) nb_demandes,
      greatest((select max(v.created_at) from public.verifications v where v.user_id = p.id),
               (select u.last_sign_in_at from auth.users u where u.id = p.id)) derniere_activite,
      (select concat_ws(', ', c.ville, c.region) from public.connexions c where c.user_id = p.id order by c.created_at desc limit 1) dernier_lieu
    from public.profiles p
    where (coalesce(p_q, '') = '' or p.contact ilike '%' || p_q || '%')
      and (p_filtre = 'tous' or (p_filtre = 'suspendus' and p.suspendu)
           or (p_filtre = 'identite_attente' and p.identite_statut = 'en_attente')
           or (p_filtre = 'identite_confirmee' and p.identite_statut = 'confirmee')
           or (p_filtre = 'admins' and exists(select 1 from public.admins a where a.user_id = p.id)))
  )
  select b.*, count(*) over () from base b
  order by b.created_at desc limit least(greatest(p_limite, 1), 200) offset greatest(p_decalage, 0);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_verifications(p_q text DEFAULT ''::text, p_couleur text DEFAULT ''::text, p_module text DEFAULT ''::text, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
 RETURNS TABLE(id uuid, contact text, module text, ville text, chambres smallint, prix integer, couleur text, lien text, travaux text, licence text, created_at timestamp with time zone, raisons jsonb, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
  select v.id, p.contact, v.module, v.ville, v.chambres, v.prix, v.couleur, v.lien, v.travaux, v.licence, v.created_at, v.raisons, count(*) over ()
  from public.verifications v left join public.profiles p on p.id = v.user_id
  where (coalesce(p_couleur, '') = '' or v.couleur = p_couleur)
    and (coalesce(p_module, '') = '' or coalesce(v.module, 'logement') = p_module)
    and (coalesce(p_q, '') = '' or p.contact ilike '%' || p_q || '%' or v.ville ilike '%' || p_q || '%' or v.lien ilike '%' || p_q || '%')
  order by v.created_at desc limit least(greatest(p_limite, 1), 200) offset greatest(p_decalage, 0);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_vider_erreurs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  delete from public.erreurs_app where true;
  perform public.journaliser('vider_erreurs', null, null);
end $function$
;

CREATE OR REPLACE FUNCTION public.consommer_quota(p_fonction text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.creer_profil()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, contact) values (new.id, coalesce(new.email, new.phone));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.definir_partage_lieu(p_actif boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  update public.profiles set partage_lieu = p_actif,
    partage_lieu_le = case when p_actif then now() else null end
  where id = auth.uid();
  if not p_actif then delete from public.connexions where user_id = auth.uid(); end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.empreinte_contact(p_type text, p_valeur text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare v text;
begin
  if p_type = 'tel' then
    v := regexp_replace(coalesce(p_valeur, ''), '\D', '', 'g');
    if length(v) < 10 then return null; end if;
    v := right(v, 10);
  elsif p_type = 'courriel' then
    v := lower(trim(coalesce(p_valeur, '')));
    if v !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then return null; end if;
  else
    return null;
  end if;
  return encode(extensions.digest('habitascan|' || p_type || '|' || v, 'sha256'), 'hex');
end $function$
;

CREATE OR REPLACE FUNCTION public.est_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.est_suspendu()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select suspendu from public.profiles where id = (select auth.uid())), false);
$function$
;

CREATE OR REPLACE FUNCTION public.journaliser(p_action text, p_cible text, p_details jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.admin_journal(admin_id, admin_contact, action, cible, details)
  values ((select auth.uid()), (select contact from public.profiles where id = (select auth.uid())), p_action, p_cible, p_details);
$function$
;

CREATE OR REPLACE FUNCTION public.maj_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.profiles set contact = coalesce(new.email, new.phone) where id = new.id;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.memoire_collective(p_tels text[], p_courriels text[], p_photos text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tels jsonb := '[]'; courriels jsonb := '[]'; photo integer := 0; x text; e text; c integer;
begin
  if auth.uid() is null then return null; end if;
  foreach x in array coalesce(p_tels[1:5], '{}') loop
    e := public.empreinte_contact('tel', x);
    select count(distinct user_id) into c from public.signalements_cles where type = 'tel' and cle = e;
    tels := tels || to_jsonb(coalesce(c, 0));
  end loop;
  foreach x in array coalesce(p_courriels[1:5], '{}') loop
    e := public.empreinte_contact('courriel', x);
    select count(distinct user_id) into c from public.signalements_cles where type = 'courriel' and cle = e;
    courriels := courriels || to_jsonb(coalesce(c, 0));
  end loop;
  foreach x in array coalesce(p_photos[1:8], '{}') loop
    if x ~ '^[0-9a-f]{16}$' then
      select count(distinct user_id) into c from public.signalements_cles
       where type = 'photo' and bit_count(('x' || cle)::bit(64) # ('x' || x)::bit(64)) <= 6;
      photo := greatest(photo, coalesce(c, 0));
    end if;
  end loop;
  return jsonb_build_object('tels', tels, 'courriels', courriels, 'photo', photo);
end $function$
;

CREATE OR REPLACE FUNCTION public.nb_demandes_jour()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::int from public.demandes_verif where user_id = (select auth.uid()) and created_at > now() - interval '1 day';
$function$
;

CREATE OR REPLACE FUNCTION public.nb_signalements(p_lien text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::int from public.signalements where lien = p_lien;
$function$
;

CREATE OR REPLACE FUNCTION public.noter(p_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_type not in ('vue_bienvenue','vue_inscription','vue_accueil','vue_verifier','vue_resultat','vue_proprio',
                    'vue_budget','vue_trouver','vue_approfondie','vue_reno','vue_renoResultat','vue_victime',
                    'vue_conditions','vue_confidentialite','recherche_lancee','lot_cherche','demande_creee',
                    'ia_analyse','ia_echec') then return; end if;
  insert into public.evenements (jour, type, n) values (current_date, p_type, 1)
  on conflict (jour, type) do update set n = public.evenements.n + 1;
end $function$
;

CREATE OR REPLACE FUNCTION public.noter_connexion(p_pays text, p_region text, p_ville text, p_appareil text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid := auth.uid();
begin
  if u is null then return; end if;
  if not coalesce((select partage_lieu from public.profiles where id = u), false) then return; end if;
  if exists (select 1 from public.connexions where user_id = u and created_at > now() - interval '30 minutes') then return; end if;
  insert into public.connexions(user_id, pays, region, ville, appareil)
  values (u, left(nullif(p_pays,''),2), left(nullif(p_region,''),3), left(nullif(p_ville,''),80), left(nullif(p_appareil,''),40));
  delete from public.connexions where user_id = u and created_at < now() - interval '90 days';
  delete from public.connexions where user_id = u and id not in
    (select id from public.connexions where user_id = u order by created_at desc limit 20);
end $function$
;

CREATE OR REPLACE FUNCTION public.noter_erreur(p_message text, p_vue text, p_agent text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select count(*) from public.erreurs_app where cree_le > now() - interval '1 day') >= 500 then return; end if;
  insert into public.erreurs_app (message, vue, agent)
  values (left(coalesce(p_message,''), 300), left(p_vue, 40), left(p_agent, 160));
end $function$
;

CREATE OR REPLACE FUNCTION public.param_num(p_cle text, p_defaut numeric)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select valeur from public.parametres where cle = p_cle), p_defaut);
$function$
;

CREATE OR REPLACE FUNCTION public.retrouver_annonce(p_photos text[], p_texte text, p_prix integer, p_ville text, p_lien text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); res jsonb;
begin
  if uid is null then return null; end if;
  if coalesce(array_length(p_photos, 1), 0) = 0 and p_texte is null then return null; end if;
  with cand as (
    select v.user_id, v.prix, v.ville, v.couleur
    from public.verifications v
    where v.user_id <> uid
      and v.created_at > now() - interval '180 days'
      and coalesce(v.module, 'logement') <> 'reno'
      and (p_lien is null or v.lien is distinct from p_lien)
      and (
        (p_texte ~ '^[0-9a-f]{16}$' and v.texte_empreinte ~ '^[0-9a-f]{16}$'
          and bit_count(('x' || v.texte_empreinte)::bit(64) # ('x' || p_texte)::bit(64)) <= 8)
        or exists (
          select 1 from unnest(coalesce(v.photos, '{}')) a, unnest(coalesce(p_photos[1:12], '{}')) b
          where a ~ '^[0-9a-f]{16}$' and b ~ '^[0-9a-f]{16}$'
            and bit_count(('x' || a)::bit(64) # ('x' || b)::bit(64)) <= 6)
      )
  )
  select jsonb_build_object(
    'vues', (select count(distinct user_id) from cand),
    'rouges', (select count(distinct user_id) from cand where couleur = 'r'),
    'prix_differents', (select count(*) from cand where p_prix is not null and prix is not null
                          and abs(prix - p_prix) > greatest(50, p_prix * 0.1)),
    'autres_prix', coalesce((select jsonb_agg(distinct prix) from (select prix from cand where p_prix is not null and prix is not null
                          and abs(prix - p_prix) > greatest(50, p_prix * 0.1) limit 3) x), '[]'),
    'autres_villes', coalesce((select jsonb_agg(distinct ville) from (select ville from cand where ville is not null and p_ville is not null
                          and lower(ville) <> lower(p_ville) and ville <> 'Autre' limit 3) y), '[]')
  ) into res;
  return res;
end $function$
;

CREATE OR REPLACE FUNCTION public.signaler_cles(p_motif text, p_tels text[], p_courriels text[], p_photos text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); n integer := 0; x text; e text; k integer;
begin
  if uid is null then raise exception 'session'; end if;
  if public.est_suspendu() then raise exception 'compte suspendu'; end if;
  if not exists (select 1 from public.profiles where id = uid and identite_statut = 'confirmee') then
    raise exception 'identite non confirmee';
  end if;
  if p_motif not in ('argent_avant_bail','faux_proprietaire','logement_inexistant','photos_volees','autre') then
    raise exception 'motif invalide';
  end if;
  if (select count(*) from public.signalements_cles where user_id = uid and created_at > now() - interval '1 day') > 60 then
    raise exception 'trop de signalements';
  end if;
  foreach x in array coalesce(p_tels[1:5], '{}') loop
    e := public.empreinte_contact('tel', x);
    if e is not null then
      insert into public.signalements_cles (user_id, type, cle, motif) values (uid, 'tel', e, p_motif) on conflict do nothing;
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  foreach x in array coalesce(p_courriels[1:5], '{}') loop
    e := public.empreinte_contact('courriel', x);
    if e is not null then
      insert into public.signalements_cles (user_id, type, cle, motif) values (uid, 'courriel', e, p_motif) on conflict do nothing;
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  foreach x in array coalesce(p_photos[1:8], '{}') loop
    if x ~ '^[0-9a-f]{16}$' and x <> '0000000000000000' and x <> 'ffffffffffffffff' then
      insert into public.signalements_cles (user_id, type, cle, motif) values (uid, 'photo', x, p_motif) on conflict do nothing;
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.soumettre_identite(doc_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if doc_type not in ('permis','passeport','rp') then
    raise exception 'type de pièce invalide';
  end if;
  update public.profiles
     set identite_doc_type = doc_type,
         identite_statut = case when identite_statut = 'confirmee' then identite_statut else 'en_attente' end,
         identite_soumise_le = now()
   where id = auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.stats_lien(p_lien text)
 RETURNS TABLE(total bigint, rouges bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*), count(*) filter (where couleur = 'r')
  from public.verifications where lien = p_lien;
$function$
;

create policy demandes_ajout on public.demandes_verif as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (statut = 'a_payer'::text) AND (verdict IS NULL) AND (note IS NULL) AND (montant IS NULL) AND (stripe_ref IS NULL) AND (paye_le IS NULL) AND (termine_le IS NULL) AND (rapport IS NULL) AND (verdict_global IS NULL) AND (NOT ( SELECT est_suspendu() AS est_suspendu)) AND (( SELECT param_num('approfondie_active'::text, (1)::numeric) AS param_num) <> (0)::numeric) AND ((( SELECT nb_demandes_jour() AS nb_demandes_jour))::numeric < ( SELECT param_num('demandes_max_jour'::text, (5)::numeric) AS param_num))));

create policy demandes_lecture on public.demandes_verif as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "licences lisibles par tous" on public.licences_rbq as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy "loyers: lecture publique" on public.loyers_reference as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy loyers_ajout on public.loyers_reference as PERMISSIVE for INSERT to authenticated with check (( SELECT est_admin() AS est_admin));

create policy loyers_modif on public.loyers_reference as PERMISSIVE for UPDATE to authenticated using (( SELECT est_admin() AS est_admin)) with check (( SELECT est_admin() AS est_admin));

create policy "pages légales : lecture publique" on public.pages_legales as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy parametres_ajout on public.parametres as PERMISSIVE for INSERT to authenticated with check (( SELECT est_admin() AS est_admin));

create policy parametres_lecture on public.parametres as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy parametres_modif on public.parametres as PERMISSIVE for UPDATE to authenticated using (( SELECT est_admin() AS est_admin)) with check (( SELECT est_admin() AS est_admin));

create policy parametres_texte_ajout on public.parametres_texte as PERMISSIVE for INSERT to authenticated with check (( SELECT est_admin() AS est_admin));

create policy parametres_texte_lecture on public.parametres_texte as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy parametres_texte_modif on public.parametres_texte as PERMISSIVE for UPDATE to authenticated using (( SELECT est_admin() AS est_admin)) with check (( SELECT est_admin() AS est_admin));

create policy "profil: lecture de son propre profil" on public.profiles as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = id));

create policy "retirer ses signalements" on public.signalements as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "signaler si identite confirmee" on public.signalements as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (NOT ( SELECT est_suspendu() AS est_suspendu)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.identite_statut = 'confirmee'::text))))));

create policy "voir ses signalements" on public.signalements as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "verifs: ajout des siennes" on public.verifications as PERMISSIVE for INSERT to authenticated with check (((( SELECT auth.uid() AS uid) = user_id) AND (NOT ( SELECT est_suspendu() AS est_suspendu))));

create policy "verifs: lecture des siennes" on public.verifications as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "verifs: suppression des siennes" on public.verifications as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

revoke all on function public.admin_admins() from public, anon, authenticated;
grant execute on function public.admin_admins() to authenticated;

revoke all on function public.admin_ajouter_admin(p_courriel text) from public, anon, authenticated;
grant execute on function public.admin_ajouter_admin(p_courriel text) to authenticated;

revoke all on function public.admin_connexions() from public, anon, authenticated;
grant execute on function public.admin_connexions() to authenticated;

revoke all on function public.admin_decider_identite(p_id uuid, p_statut text) from public, anon, authenticated;
grant execute on function public.admin_decider_identite(p_id uuid, p_statut text) to authenticated;

revoke all on function public.admin_demandes() from public, anon, authenticated;
grant execute on function public.admin_demandes() to authenticated;

revoke all on function public.admin_demandes_liste(p_statut text) from public, anon, authenticated;
grant execute on function public.admin_demandes_liste(p_statut text) to authenticated;

revoke all on function public.admin_erreurs(p_limite integer) from public, anon, authenticated;
grant execute on function public.admin_erreurs(p_limite integer) to authenticated;

revoke all on function public.admin_identites() from public, anon, authenticated;
grant execute on function public.admin_identites() to authenticated;

revoke all on function public.admin_journal_liste(p_limite integer) from public, anon, authenticated;
grant execute on function public.admin_journal_liste(p_limite integer) to authenticated;

revoke all on function public.admin_lieux_resume() from public, anon, authenticated;
grant execute on function public.admin_lieux_resume() to authenticated;

revoke all on function public.admin_maj_demande(p_id uuid, p_statut text, p_verdict text, p_note text) from public, anon, authenticated;
grant execute on function public.admin_maj_demande(p_id uuid, p_statut text, p_verdict text, p_note text) to authenticated;

revoke all on function public.admin_maj_loyer(p_ville text, p_chambres smallint, p_loyer integer, p_periode text, p_source text) from public, anon, authenticated;
grant execute on function public.admin_maj_loyer(p_ville text, p_chambres smallint, p_loyer integer, p_periode text, p_source text) to authenticated;

revoke all on function public.admin_maj_page(p_cle text, p_contenu text) from public, anon, authenticated;
grant execute on function public.admin_maj_page(p_cle text, p_contenu text) to authenticated;

revoke all on function public.admin_maj_parametre(p_cle text, p_valeur numeric) from public, anon, authenticated;
grant execute on function public.admin_maj_parametre(p_cle text, p_valeur numeric) to authenticated;

revoke all on function public.admin_maj_rapport(p_id uuid, p_rapport jsonb, p_terminer boolean) from public, anon, authenticated;
grant execute on function public.admin_maj_rapport(p_id uuid, p_rapport jsonb, p_terminer boolean) to authenticated;

revoke all on function public.admin_maj_texte(p_cle text, p_valeur text) from public, anon, authenticated;
grant execute on function public.admin_maj_texte(p_cle text, p_valeur text) to authenticated;

revoke all on function public.admin_mesure() from public, anon, authenticated;
grant execute on function public.admin_mesure() to authenticated;

revoke all on function public.admin_partage_stats() from public, anon, authenticated;
grant execute on function public.admin_partage_stats() to authenticated;

revoke all on function public.admin_retirer_admin(p_id uuid) from public, anon, authenticated;
grant execute on function public.admin_retirer_admin(p_id uuid) to authenticated;

revoke all on function public.admin_retirer_cle(p_type text, p_cle text) from public, anon, authenticated;
grant execute on function public.admin_retirer_cle(p_type text, p_cle text) to authenticated;

revoke all on function public.admin_retirer_signalements(p_lien text) from public, anon, authenticated;
grant execute on function public.admin_retirer_signalements(p_lien text) to authenticated;

revoke all on function public.admin_signalements() from public, anon, authenticated;
grant execute on function public.admin_signalements() to authenticated;

revoke all on function public.admin_signalements_cles() from public, anon, authenticated;
grant execute on function public.admin_signalements_cles() to authenticated;

revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to authenticated;

revoke all on function public.admin_suspendre(p_id uuid, p_suspendu boolean, p_motif text) from public, anon, authenticated;
grant execute on function public.admin_suspendre(p_id uuid, p_suspendu boolean, p_motif text) to authenticated;

revoke all on function public.admin_tableau() from public, anon, authenticated;
grant execute on function public.admin_tableau() to authenticated;

revoke all on function public.admin_utilisateur(p_id uuid) from public, anon, authenticated;
grant execute on function public.admin_utilisateur(p_id uuid) to authenticated;

revoke all on function public.admin_utilisateurs(p_q text, p_filtre text, p_limite integer, p_decalage integer) from public, anon, authenticated;
grant execute on function public.admin_utilisateurs(p_q text, p_filtre text, p_limite integer, p_decalage integer) to authenticated;

revoke all on function public.admin_verifications(p_q text, p_couleur text, p_module text, p_limite integer, p_decalage integer) from public, anon, authenticated;
grant execute on function public.admin_verifications(p_q text, p_couleur text, p_module text, p_limite integer, p_decalage integer) to authenticated;

revoke all on function public.admin_vider_erreurs() from public, anon, authenticated;
grant execute on function public.admin_vider_erreurs() to authenticated;

revoke all on function public.consommer_quota(p_fonction text) from public, anon, authenticated;
grant execute on function public.consommer_quota(p_fonction text) to authenticated;

revoke all on function public.creer_profil() from public, anon, authenticated;

revoke all on function public.definir_partage_lieu(p_actif boolean) from public, anon, authenticated;
grant execute on function public.definir_partage_lieu(p_actif boolean) to authenticated;

revoke all on function public.empreinte_contact(p_type text, p_valeur text) from public, anon, authenticated;

revoke all on function public.est_admin() from public, anon, authenticated;
grant execute on function public.est_admin() to authenticated;

revoke all on function public.est_suspendu() from public, anon, authenticated;
grant execute on function public.est_suspendu() to authenticated;

revoke all on function public.journaliser(p_action text, p_cible text, p_details jsonb) from public, anon, authenticated;

revoke all on function public.maj_contact() from public, anon, authenticated;

revoke all on function public.memoire_collective(p_tels text[], p_courriels text[], p_photos text[]) from public, anon, authenticated;
grant execute on function public.memoire_collective(p_tels text[], p_courriels text[], p_photos text[]) to authenticated;

revoke all on function public.nb_demandes_jour() from public, anon, authenticated;
grant execute on function public.nb_demandes_jour() to authenticated;

revoke all on function public.nb_signalements(p_lien text) from public, anon, authenticated;
grant execute on function public.nb_signalements(p_lien text) to authenticated;

revoke all on function public.noter(p_type text) from public, anon, authenticated;
grant execute on function public.noter(p_type text) to anon;
grant execute on function public.noter(p_type text) to authenticated;

revoke all on function public.noter_connexion(p_pays text, p_region text, p_ville text, p_appareil text) from public, anon, authenticated;
grant execute on function public.noter_connexion(p_pays text, p_region text, p_ville text, p_appareil text) to authenticated;

revoke all on function public.noter_erreur(p_message text, p_vue text, p_agent text) from public, anon, authenticated;
grant execute on function public.noter_erreur(p_message text, p_vue text, p_agent text) to anon;
grant execute on function public.noter_erreur(p_message text, p_vue text, p_agent text) to authenticated;

revoke all on function public.param_num(p_cle text, p_defaut numeric) from public, anon, authenticated;
grant execute on function public.param_num(p_cle text, p_defaut numeric) to authenticated;

revoke all on function public.retrouver_annonce(p_photos text[], p_texte text, p_prix integer, p_ville text, p_lien text) from public, anon, authenticated;
grant execute on function public.retrouver_annonce(p_photos text[], p_texte text, p_prix integer, p_ville text, p_lien text) to authenticated;

revoke all on function public.signaler_cles(p_motif text, p_tels text[], p_courriels text[], p_photos text[]) from public, anon, authenticated;
grant execute on function public.signaler_cles(p_motif text, p_tels text[], p_courriels text[], p_photos text[]) to authenticated;

revoke all on function public.soumettre_identite(doc_type text) from public, anon, authenticated;
grant execute on function public.soumettre_identite(doc_type text) to authenticated;

revoke all on function public.stats_lien(p_lien text) from public, anon, authenticated;
grant execute on function public.stats_lien(p_lien text) to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.admins to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.admins to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.demandes_verif to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.demandes_verif to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.erreurs_app to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.erreurs_app to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.evenements to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.evenements to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.licences_rbq to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.licences_rbq to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.loyers_reference to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.loyers_reference to authenticated;

grant SELECT on public.pages_legales to anon;

grant SELECT on public.pages_legales to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.parametres to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.parametres to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.parametres_texte to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.parametres_texte to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.profiles to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.profiles to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.quotas to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.quotas to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.signalements to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.signalements to authenticated;

grant DELETE, INSERT, SELECT, UPDATE on public.verifications to anon;

grant DELETE, INSERT, SELECT, UPDATE on public.verifications to authenticated;

-- ===== Stockage des fichiers (schéma storage, hors export automatique) =====
-- Pièces d'identité : dossier privé, chaque personne dépose et supprime dans son propre dossier, seuls les admins lisent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('pieces-identite', 'pieces-identite', false, 8388608, '{image/jpeg,image/png,image/webp,image/heic}') on conflict (id) do nothing;

create policy "pieces: depot dans son dossier" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'pieces-identite'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "pieces: suppression de ses fichiers" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'pieces-identite'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy identite_admin_lecture on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'pieces-identite'::text) AND ( SELECT public.est_admin() AS est_admin)));

create policy identite_admin_suppression on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'pieces-identite'::text) AND ( SELECT public.est_admin() AS est_admin)));

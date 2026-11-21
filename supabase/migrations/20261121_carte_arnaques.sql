-- Carte des arnaques par quartier : agrégats anonymes des signalements, pour le public, les médias
-- et les associations de locataires.
--
-- Vie privée :
-- - On ne garde jamais d'adresse : seulement la ville (choisie dans la liste de référence) et la RTA,
--   c'est-à-dire les 3 premiers caractères du code postal (ex. H2X), qui couvrent des milliers de logements.
-- - La carte ne montre un secteur que si au moins `carte_seuil_min` personnes différentes (3 par défaut)
--   l'ont signalé sur la période (`carte_mois`, 12 mois par défaut). Les secteurs sous le seuil sont
--   regroupés à l'échelle de la ville (« autres secteurs »), elle-même soumise au même seuil.
-- - Le détail des motifs ne montre qu'un motif atteignant aussi le seuil ; le reste est regroupé.
-- - Aucune date, aucun lien d'annonce, aucun identifiant n'est renvoyé. Les comptes suspendus ne comptent pas.
-- - La ligne disparaît avec le compte (suppression en cascade).
--
-- À appliquer dans SQL Editor, puis régénérer supabase/schema.sql (outils/exporter-schema.sql).

create table if not exists public.signalements_lieux (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ville text,
  rta text check (rta is null or rta ~ '^[GHJ][0-9][A-Z]$'),
  motif text not null check (motif in ('argent_avant_bail','faux_proprietaire','logement_inexistant','photos_volees','autre')),
  created_at timestamp with time zone not null default now(),
  check (ville is not null or rta is not null)
);
create index if not exists signalements_lieux_created_idx on public.signalements_lieux (created_at);
create index if not exists signalements_lieux_user_idx on public.signalements_lieux (user_id, created_at);

-- Aucune lecture ni écriture directe : seulement par les deux fonctions ci-dessous.
alter table public.signalements_lieux enable row level security;
revoke all on public.signalements_lieux from public, anon, authenticated;

insert into public.parametres (cle, valeur) values ('carte_seuil_min', 3), ('carte_mois', 12)
  on conflict (cle) do nothing;

-- Appelée par l'app juste après un signalement réussi. Mêmes conditions que pour signaler.
create or replace function public.noter_lieu_signalement(p_ville text, p_rta text, p_motif text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); v text; r text;
begin
  if uid is null then raise exception 'session'; end if;
  if public.est_suspendu() then raise exception 'compte suspendu'; end if;
  if not exists (select 1 from public.profiles where id = uid and identite_statut = 'confirmee') then
    raise exception 'identite non confirmee';
  end if;
  if p_motif not in ('argent_avant_bail','faux_proprietaire','logement_inexistant','photos_volees','autre') then
    raise exception 'motif invalide';
  end if;
  -- Ville : seulement une ville de la liste de référence (pas de texte libre).
  select l.ville into v from public.loyers_reference l where lower(l.ville) = lower(trim(coalesce(p_ville, ''))) limit 1;
  -- RTA : 3 premiers caractères d'un code postal du Québec (G, H ou J). Le reste du code n'est jamais reçu.
  r := upper(left(regexp_replace(coalesce(p_rta, ''), '\s', '', 'g'), 3));
  if r !~ '^[GHJ][0-9][A-Z]$' then r := null; end if;
  if v is null and r is null then return false; end if;
  if (select count(*) from public.signalements_lieux where user_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'trop de signalements';
  end if;
  insert into public.signalements_lieux (user_id, ville, rta, motif) values (uid, v, r, p_motif);
  return true;
end $function$;

revoke all on function public.noter_lieu_signalement(text, text, text) from public, anon, authenticated;
grant execute on function public.noter_lieu_signalement(text, text, text) to authenticated;

-- Agrégats publics de la carte. Une ligne par secteur (RTA) au-dessus du seuil, plus une ligne
-- « autres secteurs » par ville (rta = null) pour les signalements sans RTA ou dans un secteur sous le seuil.
create or replace function public.carte_arnaques()
 returns table(ville text, rta text, personnes integer, motifs jsonb)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  with p as (
    select greatest(3, public.param_num('carte_seuil_min', 3))::int as k,
           least(36, greatest(1, public.param_num('carte_mois', 12)))::int as mois
  ),
  base as (
    select s.user_id, s.ville, s.rta, s.motif
    from public.signalements_lieux s
    join public.profiles pr on pr.id = s.user_id and not pr.suspendu
    where s.created_at > now() - make_interval(months => (select mois from p))
  ),
  -- Secteurs assez signalés pour être montrés. Ville : la plus fréquente parmi les signalements du secteur.
  secteurs as (
    select b.rta, count(distinct b.user_id)::int as personnes
    from base b where b.rta is not null
    group by b.rta having count(distinct b.user_id) >= (select k from p)
  ),
  lignes as (
    select b.*, case when b.rta in (select s.rta from secteurs s) then b.rta end as rta_montree
    from base b
  ),
  groupes as (
    -- Secteur montré : sa ville majoritaire. Sinon : regroupé dans sa ville.
    select l.user_id, l.motif, l.rta_montree as rta,
           case when l.rta_montree is null then l.ville
                else (select l2.ville from lignes l2 where l2.rta = l.rta_montree and l2.ville is not null
                      group by l2.ville order by count(*) desc, l2.ville limit 1) end as ville
    from lignes l
    where l.rta_montree is not null or l.ville is not null
  ),
  totaux as (
    select g.ville, g.rta, count(distinct g.user_id)::int as personnes
    from groupes g group by g.ville, g.rta
    having count(distinct g.user_id) >= (select k from p)
  ),
  par_motif as (
    select g.ville, g.rta, g.motif, count(distinct g.user_id)::int as n
    from groupes g join totaux t on t.ville is not distinct from g.ville and t.rta is not distinct from g.rta
    group by g.ville, g.rta, g.motif
  )
  select t.ville, t.rta, t.personnes,
         coalesce((select jsonb_object_agg(m.motif, m.n) from par_motif m
                   where m.ville is not distinct from t.ville and m.rta is not distinct from t.rta
                     and m.n >= (select k from p)), '{}'::jsonb)
  from totaux t
  order by t.personnes desc, t.ville, t.rta;
$function$;

revoke all on function public.carte_arnaques() from public, anon, authenticated;
grant execute on function public.carte_arnaques() to anon, authenticated;

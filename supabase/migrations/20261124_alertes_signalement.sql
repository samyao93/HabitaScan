-- Alerte « annonce signalée » : prévient la personne qui a vérifié une annonce quand, APRÈS sa vérification,
-- d'autres utilisateurs (identité confirmée, comptes non suspendus) signalent cette annonce comme arnaque,
-- ou une annonce reliée : même lien, mêmes photos, même téléphone ou courriel, ou même texte.
-- L'alerte s'affiche dans l'app (accueil, historique). Elle est activée par défaut et se désactive dans Mon compte.
--
-- Confidentialité : la vérification garde désormais l'empreinte SHA-256 des numéros et courriels de l'annonceur
-- (même calcul que pour les signalements, jamais en clair). L'alerte ne renvoie que des nombres et des motifs,
-- jamais qui a signalé.

alter table public.verifications add column if not exists contacts text[];
alter table public.verifications drop constraint if exists verifications_contacts_chk;
alter table public.verifications add constraint verifications_contacts_chk check (
  contacts is null or (cardinality(contacts) <= 10
    and array_to_string(contacts, ',') ~ '^[0-9a-f]{64}(,[0-9a-f]{64})*$'));

alter table public.profiles
  add column if not exists alertes_signalement boolean not null default true,
  add column if not exists alertes_vues_le timestamptz;

-- Enregistre les empreintes des numéros et courriels de l'annonceur sur une de SES vérifications.
create or replace function public.noter_contacts_verification(p_id uuid, p_tels text[], p_courriels text[])
 returns void language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); e text[] := '{}'; x text; h text;
begin
  if uid is null then raise exception 'session'; end if;
  foreach x in array coalesce(p_tels[1:5], '{}') loop
    h := public.empreinte_contact('tel', x);
    if h is not null and not h = any(e) then e := e || h; end if;
  end loop;
  foreach x in array coalesce(p_courriels[1:5], '{}') loop
    h := public.empreinte_contact('courriel', x);
    if h is not null and not h = any(e) then e := e || h; end if;
  end loop;
  if cardinality(e) = 0 then return; end if;
  update public.verifications set contacts = e where id = p_id and user_id = uid;
end $function$;

-- Activer ou désactiver l'alerte.
create or replace function public.definir_alertes_signalement(p_actif boolean)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if auth.uid() is null then raise exception 'session'; end if;
  update public.profiles set alertes_signalement = coalesce(p_actif, true) where id = auth.uid();
end $function$;

-- « Compris » : les alertes actuelles ne sont plus mises en avant sur l'accueil.
create or replace function public.marquer_alertes_vues()
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if auth.uid() is null then raise exception 'session'; end if;
  update public.profiles set alertes_vues_le = now() where id = auth.uid();
end $function$;

-- Les vérifications de la personne (logement, 180 derniers jours) signalées par d'autres après la vérification.
-- Une ligne par vérification : nombre de personnes distinctes, motifs, ce qui relie (lien, photos, tel,
-- courriel, texte), date du dernier signalement, et « nouvelle » si ce signalement est postérieur au dernier « Compris ».
-- Renvoie null si l'alerte est désactivée.
create or replace function public.mes_alertes_signalement()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); vues timestamptz; actif boolean; res jsonb;
begin
  if uid is null then return null; end if;
  select p.alertes_signalement, p.alertes_vues_le into actif, vues from public.profiles p where p.id = uid;
  if actif is false then return null; end if;
  with mes as (
    select v.id, v.created_at, v.lien, v.photos, v.texte_empreinte, v.contacts
    from public.verifications v
    where v.user_id = uid and v.module = 'logement' and v.created_at > now() - interval '180 days'
    order by v.created_at desc limit 100
  ),
  valides as (
    select p.id from public.profiles p where not p.suspendu and p.identite_statut = 'confirmee'
  ),
  liens as ( -- l'annonce elle-même, par son lien
    select m.id, 'lien'::text quoi, s.user_id, s.motif, s.created_at
    from mes m join public.signalements s on s.lien = m.lien
    where m.lien is not null and s.user_id <> uid and s.created_at > m.created_at
  ),
  textes as ( -- même texte, publié sous un autre lien qui, lui, a été signalé
    select m.id, 'texte'::text quoi, s.user_id, s.motif, s.created_at
    from mes m
    join public.verifications v2 on v2.texte_empreinte ~ '^[0-9a-f]{16}$' and v2.lien is not null
      and v2.lien is distinct from m.lien
      and bit_count(('x' || v2.texte_empreinte)::bit(64) # ('x' || m.texte_empreinte)::bit(64)) <= 8
    join public.signalements s on s.lien = v2.lien
    where m.texte_empreinte ~ '^[0-9a-f]{16}$' and s.user_id <> uid and s.created_at > m.created_at
  ),
  contacts as ( -- même téléphone ou courriel
    select m.id, k.type quoi, k.user_id, k.motif, k.created_at
    from mes m join public.signalements_cles k on k.type in ('tel', 'courriel') and k.cle = any(m.contacts)
    where m.contacts is not null and k.user_id <> uid and k.created_at > m.created_at
  ),
  photos as ( -- mêmes photos (6 bits d'écart au plus sur 64)
    select m.id, 'photo'::text quoi, k.user_id, k.motif, k.created_at
    from mes m join public.signalements_cles k on k.type = 'photo'
    where m.photos is not null and k.user_id <> uid and k.created_at > m.created_at
      and exists (select 1 from unnest(m.photos) a
                  where a ~ '^[0-9a-f]{16}$'
                    and bit_count(('x' || a)::bit(64) # ('x' || k.cle)::bit(64)) <= 6)
  ),
  tout as (
    select t.* from (select * from liens union all select * from textes
                     union all select * from contacts union all select * from photos) t
    where t.user_id in (select id from valides)
  ),
  par_verif as (
    select t.id, count(distinct t.user_id) nb, array_agg(distinct t.quoi order by t.quoi) quoi,
           array_agg(distinct t.motif order by t.motif) motifs, max(t.created_at) dernier
    from tout t group by t.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'verif', p.id, 'nb', p.nb, 'quoi', to_jsonb(p.quoi), 'motifs', to_jsonb(p.motifs),
      'dernier', p.dernier, 'nouvelle', (vues is null or p.dernier > vues))
    order by p.dernier desc), '[]'::jsonb)
  into res from par_verif p;
  return res;
end $function$;

revoke all on function public.noter_contacts_verification(uuid, text[], text[]) from public, anon;
revoke all on function public.definir_alertes_signalement(boolean) from public, anon;
revoke all on function public.marquer_alertes_vues() from public, anon;
revoke all on function public.mes_alertes_signalement() from public, anon;
grant execute on function public.noter_contacts_verification(uuid, text[], text[]) to authenticated;
grant execute on function public.definir_alertes_signalement(boolean) to authenticated;
grant execute on function public.marquer_alertes_vues() to authenticated;
grant execute on function public.mes_alertes_signalement() to authenticated;

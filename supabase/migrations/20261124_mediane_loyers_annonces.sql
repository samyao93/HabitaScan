-- Comparer le prix : loyer médian des annonces récentes déjà vérifiées dans HabitaScan,
-- pour la même ville et le même nombre de chambres.
--
-- Fiabilité :
-- - 90 derniers jours, vérifications de logements seulement (pas le module Réno).
-- - Les résultats « Ne paie pas » (couleur r) sont exclus : leurs prix sont souvent des appâts.
-- - Une annonce vérifiée plusieurs fois ne compte qu'une fois (même lien ; sans lien : même compte et même prix).
-- - La médiane n'est donnée qu'à partir de 10 annonces différentes ; sinon seul le nombre est renvoyé,
--   et l'app affiche « pas encore assez d'annonces ».
-- Vie privée : aucun lien, aucune date, aucun compte n'est renvoyé, seulement un nombre et une médiane.
--
-- À appliquer dans SQL Editor, puis régénérer supabase/schema.sql (outils/exporter-schema.sql).

create or replace function public.mediane_loyers_annonces(p_ville text, p_chambres integer)
 returns table(n integer, mediane integer, jours integer, minimum integer)
 language sql stable security definer set search_path to ''
as $function$
  with a as (
    select distinct on (coalesce(v.lien, v.user_id::text || ':' || v.prix::text)) v.prix
    from public.verifications v
    where v.ville = p_ville
      and v.chambres = p_chambres
      and v.created_at > now() - interval '90 days'
      and coalesce(v.module, 'logement') = 'logement'
      and v.couleur in ('g', 'y')
      and v.prix between 300 and 9999
    order by coalesce(v.lien, v.user_id::text || ':' || v.prix::text), v.created_at desc
  )
  select count(*)::integer,
         case when count(*) >= 10 then round(percentile_cont(0.5) within group (order by prix))::integer end,
         90,
         10
  from a;
$function$;

revoke all on function public.mediane_loyers_annonces(text, integer) from public, anon, authenticated;
grant execute on function public.mediane_loyers_annonces(text, integer) to authenticated;

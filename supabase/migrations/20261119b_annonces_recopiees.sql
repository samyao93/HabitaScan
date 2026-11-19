-- Annonces recopiées : retrouver la même annonce publiée ailleurs (autre site, autre lien, autre numéro),
-- grâce à l'empreinte de ses photos et de son texte.
-- Confidentialité : seules des empreintes non réversibles sont conservées (photos : dHash 64 bits ; texte : SimHash 64 bits).
-- Chaque vérification y contribue, pas seulement les signalements.

alter table public.verifications
  add column if not exists photos text[],
  add column if not exists texte_empreinte text;

-- Retrouve les vérifications faites par d'autres personnes (180 derniers jours) d'une annonce aux mêmes photos
-- (6 bits d'écart au plus sur 64) ou au même texte (8 bits au plus), sur un autre lien.
-- Ne renvoie que des nombres, quelques prix et villes : jamais qui a vérifié.
create or replace function public.retrouver_annonce(p_photos text[], p_texte text, p_prix integer, p_ville text, p_lien text)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
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
end $function$;

revoke all on function public.retrouver_annonce(text[], text, integer, text, text) from public, anon;
grant execute on function public.retrouver_annonce(text[], text, integer, text, text) to authenticated;

-- Studios (0 chambre) : vérifications, loyers de référence et médianes SCHL.
-- - verifications.chambres et loyers_reference.chambres acceptent 0 (studio) à 3 (3 et plus).
-- - Le loyer moyen peut manquer pour une ligne qui n'a qu'une médiane (cas des studios aujourd'hui).
-- - Médianes SCHL des studios, octobre 2025 (Portail de l'information sur le marché de l'habitation, Québec,
--   « Loyer médian ($) », studio). Elles restent modifiables dans l'Espace admin.
--
-- À appliquer dans SQL Editor, puis régénérer supabase/schema.sql (outils/exporter-schema.sql).

alter table public.verifications drop constraint if exists verifications_chambres_check;
alter table public.verifications
  add constraint verifications_chambres_check check (chambres >= 0 and chambres <= 3);

alter table public.loyers_reference drop constraint if exists loyers_reference_chambres_check;
alter table public.loyers_reference
  add constraint loyers_reference_chambres_check check (chambres >= 0 and chambres <= 3);

alter table public.loyers_reference alter column loyer drop not null;

insert into public.loyers_reference (ville, chambres, loyer, mediane, mediane_periode)
select v.ville, 0, null, v.mediane, 'octobre 2025'
from (values
  ('Montréal', 950),
  ('Québec', 818),
  ('Gatineau', 969),
  ('Sherbrooke', 700),
  ('Trois-Rivières', 655),
  ('Saguenay', 650),
  ('Drummondville', 770),
  ('Rimouski', 673),
  ('Rivière-du-Loup', 575)
) as v(ville, mediane)
where exists (select 1 from public.loyers_reference r where r.ville = v.ville)
on conflict (ville, chambres) do update
  set mediane = excluded.mediane, mediane_periode = excluded.mediane_periode
  where public.loyers_reference.mediane is null;

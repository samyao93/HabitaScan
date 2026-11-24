-- Loyers médians SCHL modifiables dans l'Espace admin (onglet Montants), à côté des loyers moyens.
-- L'app s'en sert pour le budget, le verdict, la recherche et « Comparer le prix ». Sans valeur ici,
-- elle utilise les médianes d'octobre 2025 intégrées au code (src/prix/medianes-schl.json), puis la moyenne.
-- Les droits sont ceux de la table : lecture publique, modification par les admins seulement (RLS existante).
--
-- À appliquer dans SQL Editor, puis régénérer supabase/schema.sql (outils/exporter-schema.sql).

alter table public.loyers_reference
  add column if not exists mediane integer,
  add column if not exists mediane_periode text;

alter table public.loyers_reference drop constraint if exists loyers_reference_mediane_check;
alter table public.loyers_reference
  add constraint loyers_reference_mediane_check check (mediane is null or (mediane >= 100 and mediane <= 20000));

-- Valeurs de départ : SCHL, Enquête sur les logements locatifs, octobre 2025, loyer médian selon le nombre de chambres
-- (Portail de l'information sur le marché de l'habitation, Québec, appartements et maisons en rangée).
update public.loyers_reference r
set mediane = v.mediane, mediane_periode = 'octobre 2025'
from (values
  ('Montréal', 1, 1056),
  ('Montréal', 2, 1250),
  ('Montréal', 3, 1545),
  ('Québec', 1, 1034),
  ('Québec', 2, 1134),
  ('Québec', 3, 1378),
  ('Gatineau', 1, 1250),
  ('Gatineau', 2, 1350),
  ('Gatineau', 3, 1350),
  ('Sherbrooke', 1, 850),
  ('Sherbrooke', 2, 997),
  ('Sherbrooke', 3, 1350),
  ('Trois-Rivières', 1, 764),
  ('Trois-Rivières', 2, 900),
  ('Trois-Rivières', 3, 1000),
  ('Saguenay', 1, 719),
  ('Saguenay', 2, 900),
  ('Saguenay', 3, 921),
  ('Drummondville', 1, 918),
  ('Drummondville', 2, 1035),
  ('Drummondville', 3, 1400),
  ('Rimouski', 1, 734),
  ('Rimouski', 2, 900),
  ('Rimouski', 3, 1075),
  ('Rivière-du-Loup', 1, 685),
  ('Rivière-du-Loup', 2, 830),
  ('Rivière-du-Loup', 3, 917)
) as v(ville, chambres, mediane)
where r.ville = v.ville and r.chambres = v.chambres and r.mediane is null;

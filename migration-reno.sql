-- Module Vérif-Réno : à exécuter une fois dans Supabase (SQL Editor > New query > Run).
-- 1) L'historique accepte aussi les vérifications d'entrepreneurs.
alter table public.verifications
  add column if not exists module text not null default 'logement',
  add column if not exists travaux text,
  add column if not exists licence text;

alter table public.verifications alter column ville drop not null;
alter table public.verifications alter column chambres drop not null;
alter table public.verifications alter column prix drop not null;

alter table public.verifications
  add constraint verifications_module_chk check (module in ('logement','reno')),
  add constraint verifications_travaux_chk check (travaux is null or travaux in ('toiture','portes','plomberie','chauffage','electricite','general')),
  add constraint verifications_licence_chk check (licence is null or licence ~ '^[0-9]{8,10}$'),
  add constraint verifications_champs_chk check (
    (module = 'logement' and ville is not null and chambres is not null and prix is not null)
    or (module = 'reno' and travaux is not null));

-- 2) Liste des licences actives de la RBQ (données ouvertes, CC-BY 4.0).
--    numero = chiffres seulement (sans tirets), comme l'app le cherche.
create table if not exists public.licences_rbq (
  numero text primary key check (numero ~ '^[0-9]{8,10}$'),
  nom text,
  autres_noms text,
  sous_categories text,
  mandataire text,
  region text,
  importe_le timestamptz not null default now()
);
alter table public.licences_rbq enable row level security;
-- Donnée publique : lecture pour tous, aucune écriture depuis l'app.
drop policy if exists "licences lisibles par tous" on public.licences_rbq;
create policy "licences lisibles par tous" on public.licences_rbq
  for select to anon, authenticated using (true);

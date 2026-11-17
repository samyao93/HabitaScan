-- HabitaScan v5 : vérification approfondie payante (déjà appliquée sur le projet Supabase le 17 novembre 2026)
create table if not exists public.parametres_texte (
  cle text primary key check (cle ~ '^[a-z_]{2,40}$'),
  valeur text not null check (char_length(valeur) <= 500),
  maj_le timestamptz not null default now()
);
alter table public.parametres_texte enable row level security;
create policy parametres_texte_lecture on public.parametres_texte for select to anon, authenticated using (true);
create policy parametres_texte_ajout on public.parametres_texte for insert to authenticated with check ((select public.est_admin()));
create policy parametres_texte_modif on public.parametres_texte for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
insert into public.parametres (cle, valeur) values ('prix_verif', 10), ('delai_verif_heures', 24) on conflict (cle) do nothing;
insert into public.parametres_texte (cle, valeur) values ('lien_paiement', '') on conflict (cle) do nothing;

create table if not exists public.demandes_verif (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  adresse text not null check (char_length(adresse) between 6 and 200),
  lot text check (lot is null or lot ~ '^[0-9]{7,8}$'),
  nom_interlocuteur text not null check (char_length(nom_interlocuteur) between 2 and 120),
  role text not null default 'proprietaire' check (role in ('proprietaire','gestionnaire')),
  lien text check (lien is null or char_length(lien) <= 500),
  statut text not null default 'a_payer' check (statut in ('a_payer','payee','terminee','remboursee')),
  verdict text check (verdict is null or verdict in ('correspond','ne_correspond_pas','compagnie','introuvable')),
  note text check (note is null or char_length(note) <= 600),
  montant numeric, stripe_ref text,
  created_at timestamptz not null default now(), paye_le timestamptz, termine_le timestamptz
);
create index if not exists demandes_verif_user on public.demandes_verif (user_id);
create index if not exists demandes_verif_statut on public.demandes_verif (statut, created_at);
alter table public.demandes_verif enable row level security;
create policy demandes_ajout on public.demandes_verif for insert to authenticated
  with check (user_id = (select auth.uid()) and statut = 'a_payer' and verdict is null and note is null
              and montant is null and stripe_ref is null and paye_le is null and termine_le is null);
create policy demandes_lecture on public.demandes_verif for select to authenticated using (user_id = (select auth.uid()));
-- Fonctions admin_demandes() et admin_maj_demande(uuid, text, text, text) : voir l'historique des migrations Supabase.

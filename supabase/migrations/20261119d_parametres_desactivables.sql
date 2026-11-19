-- Corrige les interrupteurs de la console : « désactivé » s'enregistre avec la valeur 0,
-- mais la contrainte exigeait une valeur strictement positive (impossible de désactiver une fonction).
alter table public.parametres drop constraint if exists parametres_valeur_check;
alter table public.parametres add constraint parametres_valeur_check check (valeur >= 0 and valeur < 100000);

-- Connexion par téléphone (SMS) : désactivée tant qu'un fournisseur de SMS n'est pas configuré dans Supabase.
insert into public.parametres (cle, valeur) values ('sms_actif', 0) on conflict (cle) do nothing;

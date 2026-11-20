-- Durcissement signalé par l'audit de sécurité Supabase.
-- 1. Chemin de recherche vide pour les deux fonctions SECURITY DEFINER qui ne l'avaient pas
--    (leur code nomme déjà toutes les tables avec « public. », le comportement ne change pas).
alter function public.maj_contact() set search_path = '';
alter function public.nb_signalements(text) set search_path = '';

-- 2. empreinte_contact ne sert qu'à l'intérieur des fonctions de la base : inutile de l'exposer à l'API.
revoke execute on function public.empreinte_contact(text, text) from public, anon, authenticated;

-- Choix assumés (pas des oublis) :
-- - noter et noter_erreur restent appelables sans connexion : elles mesurent l'écran d'accueil et les
--   erreurs avant connexion. Elles n'acceptent qu'une liste fermée de valeurs, tronquent les textes
--   et plafonnent les erreurs à 500 par jour.
-- - Les fonctions admin_* sont appelables par tout compte connecté, mais chacune vérifie est_admin()
--   et refuse sinon.

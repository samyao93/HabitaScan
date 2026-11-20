-- Pages juridiques modifiables depuis la console admin (Markdown), lues par le site et l'app.
create table if not exists public.pages_legales (
  cle text primary key check (cle in ('confidentialite', 'conditions')),
  contenu text not null check (char_length(contenu) between 50 and 60000),
  maj_le timestamptz not null default now()
);
alter table public.pages_legales enable row level security;
drop policy if exists "pages légales : lecture publique" on public.pages_legales;
create policy "pages légales : lecture publique" on public.pages_legales for select to anon, authenticated using (true);
revoke insert, update, delete on public.pages_legales from anon, authenticated;
grant select on public.pages_legales to anon, authenticated;

create or replace function public.admin_maj_page(p_cle text, p_contenu text)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  if p_cle not in ('confidentialite', 'conditions') then raise exception 'page inconnue'; end if;
  if char_length(coalesce(p_contenu, '')) < 50 then raise exception 'texte trop court'; end if;
  if char_length(p_contenu) > 60000 then raise exception 'texte trop long'; end if;
  insert into public.pages_legales (cle, contenu, maj_le) values (p_cle, p_contenu, now())
  on conflict (cle) do update set contenu = excluded.contenu, maj_le = now();
  perform public.journaliser('page_legale', p_cle, jsonb_build_object('longueur', char_length(p_contenu)));
end $function$;
revoke all on function public.admin_maj_page(text, text) from public, anon;
grant execute on function public.admin_maj_page(text, text) to authenticated;

-- Texte de départ : le texte actuel de l'app (les admins le modifient ensuite dans la console).
insert into public.pages_legales (cle, contenu) values ('confidentialite', $md$# Politique de confidentialité

En vigueur le [date de mise en ligne].

## En bref

- Nous recueillons le minimum : ton courriel ou ton numéro pour te connecter, et le résumé de tes vérifications pour ton historique.
- Le texte des annonces, tes conversations et tes captures d'écran sont lus **sur ton téléphone**. Si tu actives l'analyse intelligente, ils sont envoyés à Anthropic pour l'analyse. Nous ne les conservons jamais.
- Aucune vente de renseignements, aucune publicité, aucun profilage ni suivi publicitaire.
- Ta ville de connexion n'est jamais notée sans ton accord : cette fonction est désactivée par défaut et tu l'actives toi-même dans Mon compte.
- Tu peux consulter, corriger ou supprimer tes renseignements en tout temps.

Voir aussi les [conditions d'utilisation](/conditions).

Cette politique respecte la [Loi sur la protection des renseignements personnels dans le secteur privé](https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1), modifiée par la Loi 25. L'app s'adresse aux personnes de 14 ans et plus.

## Personne responsable

[Prénom Nom], [titre], [nom de l'entreprise]
Courriel : [confidentialite@exemple.ca]
[adresse postale]

Écris-lui pour toute question, demande d'accès, de correction ou de suppression, ou pour porter plainte.

## Ce que nous recueillons

| Renseignement | Pourquoi |
|---|---|
| Courriel ou cellulaire | Te connecter avec un code, retrouver ton compte, compter les utilisateurs |
| Résumé de tes vérifications : ville, chambres, loyer, lien, résultat ; travaux et licence RBQ ; empreintes non réversibles des photos et du texte de l'annonce (jamais les photos ni le texte eux-mêmes) | Ton historique, et reconnaître la même annonce publiée ailleurs. Les autres voient seulement des nombres, des prix et des villes, jamais qui a vérifié |
| Signalement : lien de l'annonce, numéros de téléphone et courriels de l'annonceur (seulement en empreinte chiffrée, jamais en clair), empreinte visuelle des photos (la photo ne quitte pas ton téléphone), et motif | Avertir les autres utilisateurs (mémoire collective). Ils voient seulement un nombre |
| Photo de pièce d'identité, seulement pour signaler | Éviter les fausses accusations. Lue automatiquement pour pré-remplir les informations, puis vérifiée par l'équipe. Supprimée après la vérification |
| Informations lues sur la pièce : prénom, nom, année de naissance, date d'expiration, province ou pays ; empreinte chiffrée du numéro (jamais le numéro lui-même) | Vérifier l'identité, repérer une pièce expirée, une personne mineure ou une pièce utilisée par deux comptes. Une fois l'identité confirmée, seuls le prénom, l'initiale du nom et la date d'expiration sont gardés ; tout est effacé si elle est refusée |
| Ville, chambres et budget de « Trouver » | Chercher des annonces. Non conservés |
| Vérification complète : adresse, lot, lien de l'annonce et, si tu le donnes, le nom de l'annonceur | Faire la vérification que tu as payée et te remettre le rapport. Le rapport donne le nom du propriétaire inscrit au Registre foncier (information publique), sans aucun document |
| Compteurs d'utilisation (écrans ouverts par jour) et erreurs techniques | Améliorer l'app. Compteurs sans lien avec ton compte ; erreurs sans renseignement personnel |
| Ville approximative de connexion, seulement si tu l'actives dans Mon compte : ville, région, pays (déduits de l'adresse IP, sans GPS ni adresse IP conservée) et type d'appareil | Repérer une connexion inhabituelle sur ton compte et savoir quelles régions nous servons. Visible seulement par les administrateurs |
| Analyse intelligente, seulement si tu l'actives : captures et texte de l'annonce, réponse de l'annonceur et captures de la discussion | Extraire les informations et repérer les signaux d'arnaque, surtout dans la conversation. Envoyés à Anthropic pour l'analyse, jamais conservés par HabitaScan |
| Numéros de téléphone et courriels de l'annonceur trouvés dans l'annonce ou la conversation | Vérifier s'ils ont déjà été signalés. Comparés puis oubliés, sauf si tu les signales (empreinte chiffrée seulement) |

**Restent sur ton téléphone :** le texte des annonces et des conversations, tes captures (sauf si la recherche des photos est activée : envoyée à Google Cloud Vision puis oubliée), la photo du compte de taxes, ton budget et ton revenu.

**Résultat automatique :** le verdict est calculé à partir de règles publiques. Il porte sur l'annonce, pas sur toi. Tu peux demander quelles règles ont mené à un résultat.

## Fournisseurs, dont hors du Québec

| Fournisseur | Où et quoi |
|---|---|
| Supabase (base de données, connexion) | Données à Montréal (AWS Canada Centre) ; entreprise américaine |
| Vercel (pages de l'app) | États-Unis : adresse IP ; si tu l'actives, Vercel en déduit ta ville approximative |
| jsDelivr (bibliothèques de l'app) | Réseau mondial : adresse IP |
| Tavily (« Trouver » et recherche des copies d'une annonce) | États-Unis : mots de la recherche ou une phrase de l'annonce, sans ton nom |
| Google Cloud Vision, si activé | États-Unis : capture envoyée pour la recherche |
| Stripe (paiement de la vérification complète) | Entreprise américaine : courriel et carte. HabitaScan ne voit jamais le numéro de carte |
| Anthropic (analyse intelligente, si tu l'actives ; lecture de la pièce d'identité) | Entreprise américaine : captures et texte envoyés pour l'analyse ; photo de la pièce envoyée pour la lecture, sans copie conservée |

Avant de confier des renseignements hors du Québec, nous évaluons s'ils seront protégés adéquatement (art. 17 de la loi). Nous ne communiquons rien d'autre sans ton consentement, sauf dans les cas prévus par la loi.

## Conservation et sécurité

- Compte et historique : jusqu'à la suppression du compte, ou [24] mois sans connexion.
- Pièce d'identité : supprimée dès la vérification, au plus tard [30] jours après l'envoi.
- Signalements : [12] mois.
- Ville approximative de connexion : 90 jours au plus, 20 connexions au plus ; effacée dès que tu désactives la fonction.
- Échanges chiffrés (HTTPS) ; chaque utilisateur ne lit que ses propres renseignements.
- En cas d'incident présentant un risque de préjudice sérieux, nous avisons la Commission d'accès à l'information et les personnes touchées.

## Tes droits

Accès et copie de tes renseignements, correction, suppression, retrait du consentement. Réponse dans les 30 jours, gratuitement.

Tu peux supprimer ton compte toi-même dans Mon compte, et retirer une vérification de ton historique à partir de son détail. En cas de désaccord, tu peux t'adresser à la [Commission d'accès à l'information](https://www.cai.gouv.qc.ca).
$md$) on conflict (cle) do nothing;
insert into public.pages_legales (cle, contenu) values ('conditions', $md$# Conditions d'utilisation

En vigueur le [date de mise en ligne]. HabitaScan est exploité par [nom de l'entreprise], [adresse postale]. Courriel : [confidentialite@exemple.ca].

## 1. Ce que fait HabitaScan

HabitaScan aide à repérer les signes de fraude dans une annonce de logement, à vérifier qui est le propriétaire, à estimer un budget d'installation et à vérifier un entrepreneur en rénovation. Les résultats sont calculés à partir de règles publiques, de données gouvernementales et de ce que tu entres.

## 2. Ce n'est pas une garantie

**Un résultat vert ne garantit pas qu'une annonce est honnête,** et un résultat rouge ne prouve pas une fraude. HabitaScan ne remplace ni un avocat, ni un notaire, ni le Tribunal administratif du logement. Avant de payer quoi que ce soit : visite le logement, confirme le propriétaire et signe le bail.

## 3. Ton compte

Tu dois avoir 14 ans ou plus. Ton compte est personnel : garde l'accès à ton courriel ou à ton cellulaire pour toi. Tu peux supprimer ton compte en tout temps depuis l'accueil.

## 4. Vérification complète payante

- Prix : 15 $, taxes incluses s'il y a lieu, payé par carte sur la page sécurisée de Stripe.
- Nous vérifions : le propriétaire au Registre foncier ; si c'est une entreprise, son statut et ses dirigeants au registre des entreprises ; les photos de l'annonce ; les autres annonces du même logement. Tu reçois un rapport écrit avec un verdict et le nom du propriétaire inscrit (information publique du Registre foncier), à retrouver sur ton bail. Jamais de document sur le propriétaire.
- Délai : 24 h maximum après le paiement.
- **Remboursement complet** si nous ne livrons pas le rapport dans ce délai, ou si nous ne pouvons pas identifier le propriétaire. Écris-nous à [confidentialite@exemple.ca].
- Le rapport reflète les registres publics et le Web au moment de la vérification. Une vente récente peut ne pas encore être publiée, et une recherche sur le Web ne trouve pas tout.

## 5. Signalements

Signale seulement une annonce que tu crois vraiment frauduleuse, et choisis le bon motif. Un faux signalement peut nuire à une personne honnête : nous pouvons retirer un signalement et fermer un compte qui en abuse.

## 6. Utilisation interdite

- Utiliser l'app pour harceler, ficher ou retrouver une personne.
- Collecter ou revendre automatiquement le contenu de l'app (robots, aspiration).
- Contourner les limites d'usage ou la sécurité.
- Entrer de fausses informations pour nuire à quelqu'un.

Des limites quotidiennes s'appliquent aux recherches automatiques, pour garder le service gratuit pour tout le monde.

## 7. Responsabilité

Nous faisons tout pour que l'information soit exacte et à jour, mais des données publiques peuvent contenir des erreurs ou dater. Dans les limites permises par la [Loi sur la protection du consommateur](https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-40.1), nous ne sommes pas responsables d'une décision prise seulement sur la base d'un résultat de l'app. Rien dans ces conditions ne limite les droits que cette loi te donne.

## 8. Contenu et marque

Le nom HabitaScan, le logo et le code de l'app nous appartiennent. Les données gouvernementales utilisées restent soumises à leurs licences (par exemple CC-BY 4.0), et leurs sources sont citées dans l'app.

## 9. Modifications et droit applicable

Si ces conditions changent, nous l'indiquons dans l'app. Elles sont régies par les lois du Québec. En cas de désaccord, écris-nous d'abord à [confidentialite@exemple.ca]. Pour tes renseignements personnels, consulte la [politique de confidentialité](/confidentialite).
$md$) on conflict (cle) do nothing;

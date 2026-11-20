# HabitaScan : mise en ligne (version 4)

Projet Supabase : **verif-logement** (organisation Envctor, région Canada, ca-central-1)
Tableau de bord : https://supabase.com/dashboard/project/oyiiaqyepihkawzkkjpi

Nouveautés de la version 4 :
- **Trouver un logement** : la personne choisit la ville, le nombre de chambres et son budget. L'app cherche les annonces du dernier mois sur Kijiji, Centris, Kangalou, Louer.ca, DuProprio et d'autres sites (Brave Search API, section 4b). Elle retire celles hors budget, signale ce qui cloche dans le texte (dépôt, paiement suspect, propriétaire « à l'étranger », prix très bas) et met en avant les annonces de courtiers. Un bouton « Vérifier » envoie l'annonce dans la vérification complète. Des liens vers chaque site (Facebook Marketplace compris) sont toujours proposés.
- **Vérifier le propriétaire** remplace le lien vers le rôle d'évaluation : à Montréal, un propriétaire peut faire retirer son nom du rôle en ligne. L'app compare le nom et l'adresse du compte de taxes (lecture sur le téléphone), puis guide vers Infolot (gratuit) et le Registre foncier (1 $).
- **Simulateur de budget d'installation 2026** : règle des 30 % de la SCHL, loyers moyens SCHL, laissez-passer 2026 (Montréal, Québec/Lévis, Gatineau), assurance, épicerie, frais d'emménagement. Mène à la recherche dans ce budget.
- **Résultats décisifs** : « Ne paie pas », « Visite d'abord, puis vérifie le propriétaire », « Aucun signal. Tu peux visiter. »
- Facebook n'est pas couvert par la recherche automatique : Marketplace n'est pas lisible par les moteurs de recherche. La personne y cherche elle-même, puis vérifie l'annonce avec des captures.

Nouveautés de la version 3 :
- **Compte obligatoire, sans pièce d'identité** : courriel ou cellulaire + code à 6 chiffres avant la première vérification. La pièce d'identité sert seulement à signaler une annonce. Une annonce partagée avant l'inscription est gardée et s'ouvre juste après.
- **Lecture automatique** : l'utilisateur colle ou partage le texte de l'annonce, ou ajoute une capture d'écran ; l'app remplit le prix, la ville et le nombre de chambres.
- **Signalements** : les comptes à l'identité confirmée peuvent signaler une annonce ; les suivants voient l'avertissement.
- **Recherche des photos ailleurs sur le web** (Google Cloud Vision), à activer.
- **App iPhone et Android** prête à construire (dossier `app-native`).

## 0. Réactiver le projet Supabase (obligatoire)

Le projet `verif-logement` est en pause : ton compte a atteint la limite de 2 projets gratuits actifs. Mets en pause ou supprime un autre projet, puis clique « Restore » sur `verif-logement`.

## 1. La base de données

- **`supabase/schema.sql`** : la structure complète et actuelle de la base (tables, sécurité RLS, fonctions, droits, stockage), sans aucune donnée. Pour recréer une base vide (test, reprise après incident) : SQL Editor d'un projet vide > coller > Run.
- **`supabase/migrations/`** : l'historique des changements depuis novembre 2026. Chaque nouveau changement de la base = un nouveau fichier ici, appliqué dans SQL Editor.
- Après tout changement de la base, régénère `supabase/schema.sql` : colle `outils/exporter-schema.sql` dans SQL Editor, Run, et remplace le contenu du fichier par le résultat.

Donne-toi le rôle admin (remplace le courriel par celui de ton compte, après t'être connecté une première fois dans l'app) :
   `insert into public.admins (user_id) select id from auth.users where email = 'toi@exemple.ca';`

## 2. Réglages Supabase (une fois)

**a) Connexions anonymes : laisser désactivé**
Authentication > Sign In / Providers > « Allow anonymous sign-ins » : désactivé. Le compte est obligatoire.

**b) Code à 6 chiffres par courriel (obligatoire, deux modèles)**
Supabase utilise deux modèles différents. Si un seul contient le code, l'autre envoie un lien de confirmation au lieu d'un code.
Authentication > Emails > Templates :
1. **« Confirm signup »** (nouveau compte) : objet « Ton code HabitaScan », contenu : tout le fichier `courriel-inscription.html`.
2. **« Magic Link »** (compte existant, y compris la console admin) : objet « Ton code de connexion HabitaScan », contenu : tout le fichier `courriel-code.html`.
Les deux doivent contenir `{{ .Token }}` et **pas** `{{ .ConfirmationURL }}`. Clique « Save » sur chacun.

**c) Adresse de l'app (obligatoire)** : Authentication > URL Configuration > Site URL : https://habitascan.vercel.app (et dans Redirect URLs : https://habitascan.vercel.app/**).

**d) Envoi de courriels en volume (avant le lancement)** : Authentication > Emails > SMTP Settings.

**e) Codes par SMS (facultatif, payant)** : Authentication > Sign In / Providers > Phone (Twilio).

**f) Limiter les abus** : Authentication > Rate Limits : garde une limite basse pour l'envoi de codes.

## 3. Mettre l'app web en ligne (2 minutes, gratuit)

L'app est en ligne sur **https://habitascan.vercel.app**, publiée par Vercel à partir du dépôt GitHub samyao93/HabitaScan.
1. Pour une mise à jour : remplace le fichier modifié dans le dépôt GitHub (« Add file » > « Upload files »). Vercel republie tout seul en moins d'une minute.
2. Sur ton téléphone, ouvre l'adresse puis « Ajouter à l'écran d'accueil ».
4. Sur Android, l'app installée apparaît dans le menu « Partager » de Facebook et Kijiji. Sur iPhone, il faut l'app native (section 6).

## 4. Activer la recherche des photos (facultatif, payant au-delà du gratuit)

1. Google Cloud : crée un projet, active « Cloud Vision API », crée une clé API limitée à cette API.
2. Installe la CLI Supabase, puis dans ce dossier :
```
supabase login
supabase link --project-ref oyiiaqyepihkawzkkjpi
supabase secrets set GOOGLE_VISION_KEY=ta_cle
supabase functions deploy recherche-image
```
3. C'est tout : l'app l'utilise dès qu'une capture est ajoutée. Sans la fonction, l'app affiche « pas encore activée ».

Coût : selon GetApp, 1 000 premières unités par mois gratuites, puis 1,50 $ par 1 000 (palier 1 001 à 5 M). Vérifie le tarif officiel de Google avant le lancement. La fonction n'est appelable qu'avec une session de l'app, mais garde une alerte de budget dans Google Cloud.

Limite connue : sur une capture d'écran, Google cherche toute l'image (photo + texte de Facebook). Les résultats du même site que l'annonce sont retirés. À tester sur de vraies annonces avant de s'y fier.

## 4b. Activer « Trouver un logement » (Brave Search API)

1. Crée un compte sur https://brave.com/search/api/ et choisis le plan **Search** (5 $ US par 1 000 requêtes, 5 $ de crédit gratuit par mois ; une carte est demandée). Chaque recherche dans l'app fait 2 requêtes : environ 500 recherches gratuites par mois.
2. Fixe une limite de dépenses dans le tableau de bord Brave.
3. Supabase > Edge Functions > Secrets : ajoute `BRAVE_API_KEY`.
4. Déploie la fonction : `supabase functions deploy chercher-annonces` (ou donne-moi la clé et je la déploie).

Sans clé, l'écran affiche seulement les liens vers les sites.

## 5. Importer la liste des licences RBQ (module Réno, recommandé)

1. Télécharge le CSV « Liste des licences actives de la RBQ » sur https://www.donneesquebec.ca/recherche/dataset/licencesactives
2. `node preparer-licences.mjs fichier-telecharge.csv` → crée `licences_rbq.csv`.
3. Table Editor > `licences_rbq` > Insert > Import data from CSV. À refaire régulièrement (mise à jour quotidienne).

## 6. App iPhone et Android (dossier `app-native`)

Projet Capacitor 8, identifiant `ca.habitascan.app`. Il emballe l'app web du dossier parent : `npm run sync` la recopie après chaque changement.
Tout le pas-à-pas (Google Play, App Store, textes des fiches, captures, questionnaires de confidentialité) est dans **`app-native/STORES.md`**.

- **Android** : se construit sur ce PC (Android Studio). Clé de signature hors du dépôt, dans `Téléchargementshabitascan-cles`.
- **iPhone** : demande un Mac avec Xcode et l'Apple Developer Program (99 $ US par an).
- Pas encore inclus : la réception d'une annonce partagée depuis Facebook ou Kijiji (bouton « Partager » du téléphone). L'app web la gère déjà ; l'app native pourra l'ajouter plus tard.

## 6 b. Mémoire collective (signalements)

Chaque signalement d'un utilisateur à l'identité confirmée avertit les suivants : le **lien** de l'annonce (table `signalements`), et maintenant les **numéros de téléphone**, **courriels** et **photos** de l'annonceur (table `signalements_cles`).
- Les numéros et courriels ne sont jamais conservés en clair : seulement une empreinte SHA-256 (fonction `empreinte_contact`).
- Les photos ne quittent pas le téléphone : seule une empreinte visuelle de 64 bits est envoyée ; deux photos sont jugées identiques à 6 bits d'écart au plus (même photo redimensionnée ou recompressée).
- À 3 signalements (`SEUIL_ROUGE` dans `src/app/03-signalements.js`), l'avertissement passe au rouge : « Ce numéro de téléphone a déjà été signalé 3 fois ».
- Console admin, onglet Signalements : voir et retirer ces signalements.
- Migration : `supabase/migrations/20261119_memoire_collective.sql` (à coller dans SQL Editor si elle n'est pas encore appliquée).

**Annonce recopiée ailleurs** (autre site, autre lien, autre numéro) : chaque vérification garde l'empreinte des photos du logement et du texte de l'annonce (table `verifications`, colonnes `photos` et `texte_empreinte`). La fonction `retrouver_annonce` retrouve la même annonce vérifiée par d'autres : autre prix ou autre ville = jaune ; déjà « Ne paie pas » = jaune ou rouge ; même prix sans alerte = simple information (un vrai propriétaire publie souvent sur plusieurs sites). Migration : `supabase/migrations/20261119b_annonces_recopiees.sql` (déjà appliquée).

**Sans historique (copies jamais vérifiées dans l'app)** : à chaque vérification, l'app cherche aussi les copies sur le web. Fonction `chercher-copies` (Tavily, secret `TAVILY_API_KEY`) : une phrase distinctive du texte de l'annonce est cherchée sur les sites d'annonces ; seules les pages qui contiennent vraiment le même texte (au moins la moitié des suites de 3 mots) sont retenues. Fonction `recherche-image` (Google Vision, secret `GOOGLE_VISION_KEY`) : renvoie aussi le titre des pages où la photo apparaît. Le prix lu dans ces titres est comparé au loyer demandé.

**Captures d'écran** : l'app repère automatiquement la zone de la photo dans une capture (là où les couleurs sont variées) et calcule l'empreinte sur cette zone ; elle reconnaît donc la même photo vue sur deux sites différents.

## 7. Espace admin et confidentialité

**Espace admin** : connecte-toi dans l'app avec le compte déclaré admin (section 1). Un bouton « Espace admin » apparaît à l'accueil, visible seulement pour toi. Il a 4 onglets :
- **Chiffres** : utilisateurs, nouveaux sur 7 jours, vérifications, résultats « Ne paie pas », signalements, identités à vérifier.
- **Identités** : voir les photos d'une pièce d'identité (lien valable 5 minutes), puis Confirmer ou Refuser. La décision supprime les photos (engagement Loi 25).
- **Signalements** : annonces signalées, avec le nombre et les motifs. « Retirer » efface les signalements d'une annonce honnête.
- **Montants** : laissez-passer, assurance, épicerie, garderie et loyers SCHL. Change-les chaque année sans toucher au code.

**Numéro de lot automatique** (écran « Vérifier le propriétaire ») : déploie `supabase functions deploy info-adresse`. Elle utilise le géocodeur Adresses Québec et la couche des lots du cadastre, deux services publics gratuits. Sans elle, l'app essaie d'appeler ces services directement.

**Suppression du compte** : chaque utilisateur peut supprimer son compte depuis l'accueil. Déploie la fonction : `supabase functions deploy supprimer-compte`. Elle efface les photos, l'historique, les signalements, puis le compte.

**Pages du site /confidentialite et /conditions** : générées à partir des écrans de l'app par `node outils/pages-legales.mjs` (Chrome requis), pour que le texte soit identique. À relancer après toute modification de ces textes dans `app.js`.

**Politique de confidentialité** : elle s'affiche dans l'app (lien sur l'accueil, l'inscription et la page de la pièce d'identité). Avant la mise en ligne, remplis les crochets de `RESPONSABLE` au début de la section « Politique de confidentialité » dans `app.js` (nom, titre, entreprise, courriel, adresse, date), et les durées de conservation entre crochets.

## 7c. Vérification approfondie payante (Stripe)

Le client paie par carte sur une page Stripe ; HabitaScan ne voit jamais le numéro de carte.
1. Crée un compte sur https://stripe.com (Canada), puis active les paiements (renseignements d'entreprise et compte bancaire).
2. Produits > Ajouter un produit : « Vérification approfondie HabitaScan », prix unique de 15 $ CAD (le même montant que « Prix de la vérification approfondie » dans Admin → Montants).
3. Liens de paiement > Créer : choisis ce produit. Dans « Après le paiement », choisis « Rediriger vers votre site » : `https://habitascan.vercel.app/?paye=1`.
4. Copie le lien (https://buy.stripe.com/…) et colle-le dans l'app : Espace admin > Montants > Paiement Stripe. Mets le même prix dans « Prix de la vérification approfondie ».
5. Développeurs > Webhooks > Ajouter un point de terminaison : `https://oyiiaqyepihkawzkkjpi.supabase.co/functions/v1/stripe-webhook`, événement `checkout.session.completed`. Copie le « secret de signature » (whsec_…) et ajoute-le dans Supabase > Edge Functions > Secrets sous le nom `STRIPE_WEBHOOK_SECRET`.
6. Les demandes payées apparaissent dans Espace admin > Demandes. Consulte le Registre foncier, puis choisis le verdict. Sans webhook, utilise « Marquer payée » après avoir vu le paiement dans Stripe.
7. Remboursement : fais-le dans Stripe (Paiements > Rembourser), puis « Marquer remboursée » dans l'app.

## 7d. Conditions, mesure d'usage, limites anti-abus, courriel

- **Conditions d'utilisation** : écran « Conditions » dans l'app, accepté à l'inscription et avant chaque paiement. Remplis le bloc `RESPONSABLE` (début de la section « Politique de confidentialité » dans `app.js`) : il sert aussi aux conditions.
- **Mesure d'usage anonyme** : Espace admin > Chiffres > « Utilisation (anonyme) ». Compte les écrans ouverts par jour, sans lien avec les comptes, et les erreurs techniques (15 dernières).
- **Limites par personne et par jour** : 20 recherches de logements, 40 recherches de numéro de lot, 20 recherches de photos, 5 demandes de vérification approfondie. Elles protègent tes crédits Brave et Google. Pour les changer : fonction `consommer_quota` dans Supabase.
- **Courriel** : le service intégré de Supabase n'envoie que 2 courriels par heure. Branche Resend (ou un autre fournisseur SMTP) en suivant le document « HabitaScan : préparation du lancement », puis colle les deux modèles décrits en 1 b) (Confirm signup et Magic Link).

## 7e. Analyse intelligente (IA)

Option que chaque utilisateur active lui-même (case « Analyse intelligente » sur l'écran Vérifier). L'IA (Claude Haiku 5.5, API Anthropic) lit les captures et le texte, remplit les champs et repère les signaux d'arnaque, chacun avec une citation exacte. Le verdict reste calculé par les règles : les signaux de l'IA donnent au plus un avertissement jaune. Si l'IA échoue, l'app revient à la lecture simple.
1. Crée un compte sur https://platform.claude.com, ajoute un moyen de paiement et une limite de dépenses, puis crée une clé d'API.
2. Envoie-moi la clé, ou ajoute-la dans Supabase > Edge Functions > Secrets sous le nom `ANTHROPIC_API_KEY`.
3. Limite : 20 analyses par personne et par jour (fonction `consommer_quota`).
4. Avant le lancement : ajoute Anthropic à ton évaluation des facteurs relatifs à la vie privée (transfert hors Québec).

## 8. Ce qui est stocké

| Donnée | Où | Qui la voit |
| --- | --- | --- |
| Courriel ou numéro | Supabase Auth, `profiles` | L'utilisateur, toi |
| Photos de la pièce d'identité (si signalement) | Stockage privé `pieces-identite` | Toi seulement, supprimées après vérification |
| Historique : ville, chambres, prix, lien, résultat | `verifications` | L'utilisateur (et toi). Pour un même lien, les autres voient seulement un nombre |
| Signalements : lien, raison | `signalements` | L'auteur (et toi). Les autres voient seulement un nombre |
| Texte de l'annonce, conversation | Nulle part : restent sur le téléphone | Personne |
| Capture d'écran | Lue sur le téléphone ; envoyée à Google Vision seulement si la recherche de photos est activée, jamais conservée | Google (traitement), personne d'autre |
| Vérifications Réno : travaux, licence, résultat | `verifications` | L'utilisateur (et toi) |
| Compte de taxes montré par un annonceur (« Vérifier le propriétaire ») | Lu sur le téléphone, jamais envoyé | Personne |
| Recherche « Trouver » : ville, chambres, budget | Envoyés à Brave Search pour la recherche, jamais conservés | Brave (traitement) |
| Montants du budget | `parametres` | Tout le monde (lecture), toi (modification) |
| Demandes de vérification approfondie : adresse, lot, nom de l'interlocuteur, lien, verdict | `demandes_verif` | Le client (sa demande), toi |
| Paiement (carte, nom, courriel) | Stripe | Stripe seulement |
| Compteurs d'utilisation par jour, erreurs techniques | `evenements`, `erreurs_app` | Toi seulement |
| Quotas d'usage par jour | `quotas` | Personne (usage interne) |
| Captures et texte envoyés à l'analyse intelligente (si activée) | Nulle part : envoyés à Anthropic pour l'analyse, jamais enregistrés par HabitaScan | Anthropic (traitement) |
| Loyers SCHL, licences RBQ | `loyers_reference`, `licences_rbq` | Tout le monde (lecture) |

Avant le lancement, la politique de confidentialité doit mentionner Google Vision et Brave Search (transfert hors Québec : Loi 25, évaluation des facteurs relatifs à la vie privée).

## 9. Ce qui reste à faire

- Tester sur une cinquantaine de vraies annonces : fausses alertes, arnaques ratées, qualité de la lecture automatique.
- Ajuster les seuils (prix : 25 % sous la moyenne ; signalements : jaune dès 1, rouge dès 3).
- Faire valider les textes, les signalements et la politique de confidentialité par un avocat (Loi 25, risque de diffamation).
- Mettre à jour les montants du budget chaque année (laissez-passer, assurance, épicerie) et les loyers SCHL chaque automne.
- Vérification automatique de la pièce d'identité (service payant), si le volume augmente.

## Fichiers

- `app.html` (servie à `/app`) et `app.js` : l'app web. **app.js est généré** à partir de `src/app/` (voir « Développement ») : ne le modifie pas directement.
- `index.html` : la page d'accueil du site (`/`) ; `admin.html` : la console d'administration
- `supabase/schema.sql` : structure complète de la base ; `supabase/migrations/` : historique des changements
- `supabase/functions/_shared/commun.ts` : code commun à toutes les fonctions (CORS, réponses, quota quotidien)
- `supabase/functions/recherche-image/index.ts` : recherche des photos (Google Vision)
- `supabase/functions/chercher-annonces/index.ts` : recherche d'annonces (Tavily, ou Brave Search)
- `supabase/functions/chercher-copies/index.ts` : la même annonce publiée ailleurs (Tavily)
- `supabase/functions/lire-identite/index.ts` : lecture automatique de la pièce d'identité (IA)
- `supabase/functions/admin-supprimer-compte/index.ts` : suppression d'un compte depuis la console
- `supabase/functions/supprimer-compte/index.ts` : suppression du compte par l'utilisateur
- `courriel-code.html` et `courriel-inscription.html` : modèles des courriels de code (Magic Link et Confirm signup)
- `icon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png` : logo et icônes
- `supabase/functions/analyser-annonce/index.ts` : analyse intelligente (IA)
- `supabase/functions/stripe-webhook/index.ts` : confirme les paiements Stripe
- `supabase/functions/info-adresse/index.ts` : adresse → numéro de lot (services publics du Québec)
- `preparer-licences.mjs` : prépare la liste des licences RBQ
- `app-native/` : app iPhone et Android (Capacitor)
- `sw.js`, `manifest.webmanifest`, `icon.svg` : installation sur le téléphone

## Développement

### Où est le code de l'app
L'app est découpée en morceaux dans `src/app/`, numérotés dans l'ordre (`01-config-et-annonceur.js`, `02-lecture-annonce.js`, …, `17-demarrage.js`). `app.js` est leur assemblage, dans un seul bloc `{ … }` : un nom déclaré dans un morceau est visible dans tous les autres, et aucun ne se mélange aux variables du navigateur.

Après une modification dans `src/app/` : `cd outils && npm run assembler` (ou `npm run format`, qui met aussi le code en forme), puis ajoute `app.js` au commit.

### Vérifier avant de pousser
Une fois : `cd outils && npm install`. Ensuite : `cd outils && npm run verifier`. Cette commande vérifie :
- la mise en forme (Prettier) et les erreurs courantes (ESLint : nom mal écrit, clé en double, code inatteignable…) ;
- que `app.js` correspond bien à `src/app/` ;
- les tests (`tests/`) : verdict, mots repérés et négations, budget (net ou brut), lecture du prix et des chambres, liens Kijiji, liens sûrs, empreintes de texte, message-filtre, sécurité du Markdown des pages légales, absence de clés secrètes, et l'affichage de chaque écran dans Chrome.

Les mêmes vérifications tournent sur GitHub à chaque PR (`.github/workflows/verifications.yml`), plus la vérification des types des fonctions Supabase (Deno). Ne fusionne pas une PR dont une vérification est rouge.

### Fonctions Supabase
Chaque fonction importe `../_shared/commun.ts`. Au déploiement, envoie les deux fichiers (`index.ts` et `../_shared/commun.ts`). Avec la CLI Supabase : `supabase functions deploy <nom>` les inclut tout seul. Les appels depuis un navigateur ne sont acceptés que depuis le site, ses aperçus Vercel et l'app native (liste `ORIGINES` dans `commun.ts`).

### Comparer l'affichage avant et après une réorganisation
`node outils/ecrans.mjs avant.json` sur l'ancienne version, puis `node outils/ecrans.mjs apres.json` sur la nouvelle : le HTML de chaque écran est enregistré, et les deux fichiers doivent être identiques.

## 7f. Historique détaillé, Mon compte, lieu de connexion (v7)

- **Mes vérifications** : l'accueil montre les 3 dernières ; « Tout voir » ouvre la liste complète (100 dernières, filtre Logement / Réno). Chaque vérification est cliquable : verdict, date, ville, chambres, loyer, lien de l'annonce, toutes les raisons avec les articles de loi, et « Retirer de mon historique ».
- **Mon compte** (bouton en haut de l'accueil) : courriel et statut, historique, partage du lieu, conditions, confidentialité, déconnexion, suppression du compte. Le bouton **Espace admin** n'apparaît que pour un compte inscrit dans la table `admins`, et l'app renvoie à l'accueil toute personne non admin qui tente d'ouvrir l'écran admin. Les fonctions `admin_*` refusent aussi toute personne non admin côté serveur.
- **Lieu de connexion** : la fonction Vercel `api/lieu.js` lit les en-têtes de géolocalisation que Vercel ajoute à chaque requête (`x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city`). Elle ne garde pas l'adresse IP et ne la renvoie pas. L'app ne l'appelle que si la personne a activé « Partager ma ville approximative » : la fonction est désactivée par défaut (Loi 25, art. 8.1 et 9.1). Une entrée au plus par 30 minutes, conservation 90 jours, 20 entrées au plus par personne, et tout est effacé quand la personne désactive le partage.
- **Admin → onglet Connexions** : nombre de personnes qui partagent, répartition par ville sur 30 jours, dernière connexion par personne (courriel, ville, appareil, nombre de connexions), avec une recherche.
- Base de données : déjà à jour.
- **À faire valider par l'avocat** : la base légale et la formulation du consentement au partage du lieu.

## 7g. Annonce publiée par le locataire actuel, profil sur toutes les plateformes (v8)

- Question du formulaire : « Est-ce le locataire actuel qui annonce (cession de bail ou sous-location) ? ». Elle est cochée automatiquement si le texte parle de cession, de sous-location ou de « sublet ».
- Si le locataire demande de l'argent en cession : signal rouge. Le locataire qui part ne peut rien exiger du nouveau locataire (avis de cession du TAL, TAL-802).
- « Vérifier le propriétaire » a un 3e choix, **Locataire actuel** : on demande son bail (son nom et l'adresse), puis on compare le propriétaire écrit sur le bail avec le Registre foncier. On rappelle aussi l'accord écrit du propriétaire (délai de 15 jours, art. 1870 et 1871 C.c.Q.).
- La vérification approfondie accepte le rôle `locataire` (contrainte de la base mise à jour, migration `demandes_role_locataire`) : l'équipe compare le propriétaire écrit sur le bail avec le propriétaire inscrit.
- Le profil de l'annonceur fonctionne pour Facebook, Kijiji, LesPAC, Craigslist et les réseaux sociaux. La section s'ouvre dès qu'un lien est reconnu. Nouvelle question : « Veut-il continuer la conversation ailleurs dès le début ? ».

## 8. Console d'administration (habitascan.vercel.app/admin)

Une seule app : la console fait partie du même site, avec la même connexion et la même base de données. Elle est faite pour un ordinateur ; l'espace admin du téléphone donne un lien vers elle.

- **Connexion** : courriel puis code à 6 chiffres. Seuls les comptes de la table `admins` entrent. Chaque fonction refuse aussi les autres comptes côté serveur.
- **Tableau de bord** : utilisateurs, vérifications, revenus, demandes payées à traiter (avec alerte de retard), graphiques sur 30 jours, résultats, éléments à surveiller.
- **Vérifications payées** : liste filtrable ; fiche avec la marche à suivre au Registre foncier, verdict et note pour le client, remboursement.
- **Utilisateurs** : recherche, filtres, fiche complète (vérifications, demandes, connexions, utilisation du jour), suspension avec motif, réactivation, suppression du compte et de ses données (fonction `admin-supprimer-compte`).
- **Vérifications** : toutes les vérifications, avec filtres et le détail des raisons.
- **Identités, Signalements, Connexions** : modération.
- **Réglages** : prix, délai, lien Stripe, limites anti-abus ; activer ou désactiver l'IA, la recherche d'annonces et la vérification payante ; quotas par fonction ; message en haut de l'accueil ; courriel de soutien ; montants du simulateur de budget.
- **Loyers de référence** : modifier les loyers moyens de la SCHL et ajouter une ville.
- **Administrateurs** : ajouter ou retirer un admin (impossible de se retirer soi-même ou de retirer le dernier).
- **Journal** : chaque action d'un admin (qui, quoi, quand, avant et après).
- **Erreurs techniques**, et **export CSV** des listes.

Base de données : les changements sont appliqués directement dans Supabase, qui garde l'historique (Supabase → Database → Migrations). Le dépôt GitHub ne contient que l'app.

## 9. Vérification complète (service payant)

- Gratuit pour tous : l'analyse automatique de l'annonce.
- Payant : la **vérification complète** par ton équipe, avec un rapport écrit envoyé dans l'app, dans le délai promis ou remboursé.
- Le rapport couvre 4 points : le propriétaire au Registre foncier ; l'entreprise propriétaire (statut et dirigeants au registre des entreprises) ; les photos réutilisées ; les autres annonces du même logement. Il se termine par un verdict global (« Tu peux continuer », « Continue avec précaution », « Arrête ») et des recommandations.
- Dans la console : **Vérifications payées** → ouvrir une demande → remplir la grille → « Envoyer le rapport au client ». Le brouillon peut être enregistré avant l'envoi.
- **Prix** : console → Réglages → Tarifs et délais. Le montant du lien de paiement Stripe doit être le même.
- Le rapport ne contient jamais le nom d'une personne ni de document sur le propriétaire (Loi 25) : seulement les résultats.

## 10. Zéro question, message-filtre, site public

- **Zéro question à l'annonceur** : « Vérifier le propriétaire » part de l'adresse seule (numéro de lot, Registre foncier, registre des entreprises). Au moment de signer, l'app compare le nom écrit sur le bail (ou sur l'accord écrit du propriétaire, pour une cession) avec le propriétaire inscrit. La vérification complète ne demande plus que l'adresse ; le rapport donne le nom du propriétaire inscrit à retrouver sur le bail.
- **Message-filtre** (sur chaque résultat) : un message poli, en français ou en anglais, qui annonce les règles normales (visite d'abord, premier mois à la signature). L'utilisateur colle la réponse de l'annonceur et l'app y repère les signaux connus (dépôt, virement, « à l'étranger », clés par la poste, refus de visite, papiers demandés, pression). L'analyse se fait sur le téléphone.
- **Site public** : `/` (français), `/en` (anglais), `/guides/verifier-un-proprietaire`, `/guides/arnaques-courantes`, `/a-propos`. Le prix et le délai affichés viennent des réglages de la console. `robots.txt` et `sitemap.xml` sont inclus.
- **À compléter dans `a-propos.html`** : nom légal de l'entreprise, ville, NEQ, responsable, courriel (les crochets [ ]).
- **Anglais** : le site public et le message-filtre sont en anglais ; l'app elle-même est encore en français.

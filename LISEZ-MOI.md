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

## 1. Mettre la base à jour (une fois, dans l'ordre)

(La migration v3 rend le contact facultatif pour les anciens essais de sessions anonymes ; sans effet si elles restent désactivées.)

SQL Editor > New query, colle puis « Run » :
1. `migration-reno.sql`
2. `migration-v3-compte-facultatif-signalements.sql`
3. `migration-v4-admin-confidentialite.sql`
4. Donne-toi le rôle admin (remplace le courriel par celui de ton compte, après t'être connecté une première fois dans l'app) :
   `insert into public.admins (user_id) select id from auth.users where email = 'toi@exemple.ca';`

## 2. Réglages Supabase (une fois)

**a) Connexions anonymes : laisser désactivé**
Authentication > Sign In / Providers > « Allow anonymous sign-ins » : désactivé. Le compte est obligatoire.

**b) Code à 6 chiffres par courriel (obligatoire)**
Authentication > Emails > Templates > **« Magic Link »** : remplace le contenu par :

```
<h2>Ton code HabitaScan</h2>
<p>Entre ce code dans l'app : <strong>{{ .Token }}</strong></p>
<p>Il expire dans 1 heure. Si tu n'as rien demandé, ignore ce courriel.</p>
```

**c) Adresse de l'app (obligatoire)** : Authentication > URL Configuration > Site URL : l'adresse Netlify.

**d) Envoi de courriels en volume (avant le lancement)** : Authentication > Emails > SMTP Settings.

**e) Codes par SMS (facultatif, payant)** : Authentication > Sign In / Providers > Phone (Twilio).

**f) Limiter les abus** : Authentication > Rate Limits : garde une limite basse pour l'envoi de codes.

## 3. Mettre l'app web en ligne (2 minutes, gratuit)

1. Décompresse ce dossier.
2. Va sur https://app.netlify.com/drop et glisse le dossier (sans `app-native` ni `supabase`).
3. Sur ton téléphone, ouvre l'adresse puis « Ajouter à l'écran d'accueil ».
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

Les projets Android et iOS sont déjà générés avec Capacitor 8 ; le partage depuis Facebook ou Kijiji passe par le plugin `@capgo/capacitor-share-target`.

Ce qu'il te faut :
- **Android** : Android Studio (gratuit) et un compte Google Play Console (25 $ US une fois). Les comptes personnels récents doivent faire un test fermé avec au moins 12 testeurs pendant 14 jours avant la publication.
- **iPhone** : un Mac avec Xcode et l'Apple Developer Program (99 $ US par année).

Étapes :
```
cd app-native
npm install
npm run android   # ouvre Android Studio : Build > Generate Signed Bundle
npm run ios       # ouvre Xcode (sur Mac)
```
Sur iPhone, une étape se fait à la main dans Xcode : File > New > Target > **Share Extension**, avec le groupe d'apps `group.ca.verifqc.app` (voir la documentation du plugin `@capgo/capacitor-share-target`). Sur Android, la réception du partage est déjà configurée.

Change `appId` (`ca.verifqc.app`) et `appName` dans `capacitor.config.json` quand le nom final est choisi.

## 7. Espace admin et confidentialité

**Espace admin** : connecte-toi dans l'app avec le compte déclaré admin (section 1). Un bouton « Espace admin » apparaît à l'accueil, visible seulement pour toi. Il a 4 onglets :
- **Chiffres** : utilisateurs, nouveaux sur 7 jours, vérifications, résultats « Ne paie pas », signalements, identités à vérifier.
- **Identités** : voir les photos d'une pièce d'identité (lien valable 5 minutes), puis Confirmer ou Refuser. La décision supprime les photos (engagement Loi 25).
- **Signalements** : annonces signalées, avec le nombre et les motifs. « Retirer » efface les signalements d'une annonce honnête.
- **Montants** : laissez-passer, assurance, épicerie, garderie et loyers SCHL. Change-les chaque année sans toucher au code.

**Numéro de lot automatique** (écran « Vérifier le propriétaire ») : déploie `supabase functions deploy info-adresse`. Elle utilise le géocodeur Adresses Québec et la couche des lots du cadastre, deux services publics gratuits. Sans elle, l'app essaie d'appeler ces services directement.

**Suppression du compte** : chaque utilisateur peut supprimer son compte depuis l'accueil. Déploie la fonction : `supabase functions deploy supprimer-compte`. Elle efface les photos, l'historique, les signalements, puis le compte.

**Politique de confidentialité** : elle s'affiche dans l'app (lien sur l'accueil, l'inscription et la page de la pièce d'identité). Avant la mise en ligne, remplis les crochets de `RESPONSABLE` au début de la section « Politique de confidentialité » dans `app.js` (nom, titre, entreprise, courriel, adresse, date), et les durées de conservation entre crochets.

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
| Loyers SCHL, licences RBQ | `loyers_reference`, `licences_rbq` | Tout le monde (lecture) |

Avant le lancement, la politique de confidentialité doit mentionner Google Vision et Brave Search (transfert hors Québec : Loi 25, évaluation des facteurs relatifs à la vie privée).

## 9. Ce qui reste à faire

- Tester sur une cinquantaine de vraies annonces : fausses alertes, arnaques ratées, qualité de la lecture automatique.
- Ajuster les seuils (prix : 25 % sous la moyenne ; signalements : jaune dès 1, rouge dès 3).
- Faire valider les textes, les signalements et la politique de confidentialité par un avocat (Loi 25, risque de diffamation).
- Mettre à jour les montants du budget chaque année (laissez-passer, assurance, épicerie) et les loyers SCHL chaque automne.
- Vérification automatique de la pièce d'identité (service payant), si le volume augmente.

## Fichiers

- `index.html`, `app.js` : l'app web
- `migration-reno.sql`, `migration-v3-compte-facultatif-signalements.sql`, `migration-v4-admin-confidentialite.sql` : mises à jour de la base
- `supabase/functions/recherche-image/index.ts` : recherche des photos (Google Vision)
- `supabase/functions/chercher-annonces/index.ts` : recherche d'annonces (Brave Search)
- `supabase/functions/supprimer-compte/index.ts` : suppression du compte par l'utilisateur
- `supabase/functions/info-adresse/index.ts` : adresse → numéro de lot (services publics du Québec)
- `preparer-licences.mjs` : prépare la liste des licences RBQ
- `app-native/` : app iPhone et Android (Capacitor)
- `sw.js`, `manifest.webmanifest`, `icon.svg` : installation sur le téléphone

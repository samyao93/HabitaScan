# Publier HabitaScan sur Google Play et l'App Store

L'app mobile est l'app web (`app.html`, l'app construite à partir de `src/`, `app.css`) emballée avec Capacitor 8.
Identifiant de l'app : **`ca.habitascan.app`** (ne peut plus changer après la première publication).

## 1. Avant de publier : 3 points bloquants

1. **Politique de confidentialité incomplète.** Dans `src/legal/confidentialite.js`, le bloc `RESPONSABLE = {nom:"[Prénom Nom]", …}`
   contient encore des crochets. Remplis-les (nom, titre, entreprise, courriel, adresse, date).
   Les deux stores exigent une politique réelle à une adresse publique : **https://habitascan.vercel.app/confidentialite**.
2. **Accès pour les vérificateurs des stores.** Apple et Google testent l'app et doivent pouvoir se connecter.
   La connexion se fait par code reçu par courriel : ils ne peuvent pas recevoir ton courriel.
   Solution simple : dans Supabase, **Authentication > Sign In / Providers > Phone**, active « Test OTP »
   avec un numéro fictif et un code fixe (par exemple +1 555 010 0000 → 123456), puis donne ce numéro
   et ce code dans les notes de vérification (« App Review Information » chez Apple, « Accès à l'app » chez Google).
   Cela demande d'activer la connexion par téléphone.
3. **Paiement de la « Vérification complète ».** Le paiement par carte (Stripe) passe par le navigateur.
   Apple et Google acceptent un paiement hors store pour un **service rendu par des personnes**,
   mais un vérificateur peut considérer le rapport comme un contenu numérique et refuser l'app.
   Si c'est le cas, l'option la plus rapide est de masquer l'offre payante dans l'app mobile
   (elle reste sur le site). Prévois de répondre en expliquant que le rapport est produit par une personne
   qui consulte des registres publics.

## 2. Mettre à jour l'app mobile après un changement de l'app web

```
cd app-native
npm install          # la première fois seulement
npm run sync         # copie l'app web dans les projets Android et iOS
```
Puis augmente le numéro de version :
- **Android** : `android/app/build.gradle` → `versionCode` (+1 à chaque envoi) et `versionName`.
- **iPhone** : dans Xcode, onglet « General » → Version et Build.

## 3. Google Play

**Ce qu'il te faut** : un compte Google Play Console (25 $ US, une fois) et Android Studio (déjà installé).

**Construire le fichier à envoyer** (déjà fait pour la version 1.0.0) :
```
cd app-native/android
gradlew bundleRelease
```
Le fichier est `android/app/build/outputs/bundle/release/app-release.aab`.
Il est signé avec la clé de `Téléchargements\habitascan-cles` (voir `LISEZ-MOI-CLE.txt` dans ce dossier).
Sans le fichier `android/keystore.properties` (jamais sur GitHub), il faut signer dans Android Studio :
Build > Generate Signed App Bundle.

**Tester sur ton téléphone Android** : copie `android/app/build/outputs/apk/release/app-release.apk`
sur le téléphone et ouvre-le (autorise l'installation d'apps inconnues).

**Dans Play Console** :
1. Créer une app : nom « HabitaScan », langue par défaut Français (Canada), App, Gratuite.
2. **Test fermé obligatoire** pour un compte personnel récent : au moins 12 testeurs pendant 14 jours
   avant de pouvoir publier en production. Envoie le `.aab` dans « Test fermé ».
3. Remplis la fiche (section 5), la « Sécurité des données » (section 6), la classification du contenu
   (questionnaire : aucune violence, aucun contenu sensible → « Tout public »), le public cible (18 ans et plus),
   et l'adresse de la politique de confidentialité.
4. « Accès à l'app » : donne le numéro de test et le code (point 2 de la section 1).

## 4. App Store (iPhone)

**Ce qu'il te faut** : un **Mac** avec Xcode et l'Apple Developer Program (99 $ US par an).
Impossible de compiler une app iPhone sous Windows.

Sur le Mac :
```
cd app-native
npm install
npm run ios          # copie l'app web et ouvre Xcode
```
Dans Xcode :
1. Cible « App » > Signing & Capabilities : choisis ton équipe Apple (Team). Bundle Identifier : `ca.habitascan.app`.
2. Product > Archive, puis Distribute App > App Store Connect.
3. Dans App Store Connect : remplis la fiche (section 5), la confidentialité (section 6), l'adresse de la politique,
   et « App Review Information » (numéro de test et code, point 2 de la section 1).

Déjà configuré : icône sans transparence, écran de démarrage clair et sombre, messages d'autorisation
pour l'appareil photo et les photos (en français), déclaration de chiffrement standard (pas de questionnaire d'exportation).

## 5. Fiche du store (textes prêts à coller)

**Nom** : HabitaScan
**Sous-titre (Apple, 30 caractères)** : Avant de payer, vérifie
**Description courte (Google, 80 caractères)** : Repère les fausses annonces de logement au Québec avant d'envoyer un dollar.
**Catégorie** : Style de vie (Apple) · Maison et intérieur (Google)
**Mots-clés (Apple, 100 caractères)** : logement,location,arnaque,fraude,annonce,propriétaire,bail,appartement,québec,montréal,kijiji

**Description longue (FR)** :

> Ne paie jamais pour un logement qui n'existe pas.
>
> HabitaScan aide les locataires du Québec à repérer les fausses annonces de logement avant d'envoyer de l'argent.
> Ajoute une capture d'écran de l'annonce Kijiji, Facebook ou LesPAC : en une minute, l'app te donne un verdict clair.
>
> CE QUE FAIT HABITASCAN
> • Analyse de l'annonce : loyer comparé aux moyennes de la SCHL, profil de l'annonceur, photos recherchées sur le web, phrases typiques d'arnaque.
> • Message-filtre : un message poli, prêt à copier, qui fait réagir les fraudeurs. L'app analyse la réponse.
> • Vrai propriétaire : à partir de l'adresse, trouve le propriétaire au Registre foncier et compare-le au nom écrit sur le bail.
> • Budget d'installation : combien prévoir pour t'installer et quel loyer tu peux payer, ville par ville.
> • Entrepreneur en rénovation : vérifie sa licence RBQ.
> • Vérification complète par notre équipe, avec un rapport écrit.
>
> DISCRET ET CONFIDENTIEL
> L'annonceur ne sait jamais que tu l'as vérifié. Tes captures restent sur ton téléphone. Conforme à la Loi 25.
>
> Rappel : au Québec, aucun dépôt ne peut être exigé ; seul le premier mois de loyer peut être demandé, à la signature du bail.
> HabitaScan ne remplace pas un avis juridique et ne garantit pas qu'une annonce est fiable : visite toujours, et signe le bail avant de payer.

**Captures d'écran** : dossier `store/captures/`
- `android/` : 1080 × 1920 (Google Play, téléphone)
- `iphone/` : 1290 × 2796 (App Store, iPhone 6,7 po ; Apple les adapte aux autres tailles)

**Coordonnées** : site https://habitascan.vercel.app · politique https://habitascan.vercel.app/confidentialite ·
courriel de soutien : celui réglé dans la console admin.

## 6. Questionnaires de confidentialité (à vérifier avant d'envoyer)

Réponses basées sur le fonctionnement actuel de l'app (voir le tableau des données dans `LISEZ-MOI.md`) :

| Donnée | Collectée ? | Usage | Liée à la personne |
|---|---|---|---|
| Courriel ou numéro de téléphone | Oui | Connexion au compte | Oui |
| Historique des vérifications (ville, chambres, prix, résultat, lien) | Oui | Fonctionnement de l'app | Oui |
| Photo de pièce d'identité (seulement pour signaler) | Oui, facultatif | Vérification d'identité, supprimée après décision | Oui |
| Ville approximative de connexion | Seulement si activée | Sécurité du compte | Oui |
| Paiement | Traité par Stripe, pas par HabitaScan | Achat de la vérification complète | Oui |
| Captures d'annonce | Non (restent sur le téléphone), sauf analyse intelligente activée : envoyées pour la lecture puis non conservées | Fonctionnement | Non |

- Données vendues : **non**. Publicité : **non**. Suivi entre apps (Apple « Tracking ») : **non**.
- Chiffrement en transit : **oui** (HTTPS). Suppression du compte : **oui**, dans l'app (Mon compte > Supprimer mon compte).

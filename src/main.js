/* Point d'entrée de l'app : initialisations dans l'ordre, puis démarrage. */
import { chargerParametres } from "./admin/parametres.js";
import { ajouterParametresApprofondie } from "./approfondie/api.js";
import { chargerLoyers, chargerRegistre } from "./chargement.js";
import { ecouterModeConnexion } from "./compte/liaisons.js";
import { chargerProfil, ouvrirSession } from "./compte/session.js";
import { etat } from "./etat.js";
import { ecouterChoixIA } from "./ia/liaisons.js";
import { chargerPages, chargerTextes } from "./legal/pages.js";
import { ecouterErreurs } from "./mesure/mesure.js";
import { go } from "./navigation/routeur.js";
import { ecouterPartageNatif, lirePartageDansAdresse } from "./partage.js";
import { app, top } from "./utils/dom.js";

lirePartageDansAdresse();
ajouterParametresApprofondie();
ecouterErreurs();
ecouterChoixIA();
ecouterModeConnexion();
ecouterPartageNatif();

(async () => {
  try {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  } catch (e) {}
  go("analyse");
  try {
    await Promise.all([chargerLoyers(), chargerRegistre(), chargerParametres(), chargerTextes(), chargerPages()]);
    await ouvrirSession();
    await chargerProfil();
    const vq = new URLSearchParams(location.search).get("v");
    go(
      ["confidentialite", "conditions"].includes(vq)
        ? vq
        : etat.session
          ? etat.fiche.partage
            ? "verifier"
            : "accueil"
          : "bienvenue",
    );
  } catch (e) {
    app.innerHTML = `${top()}<p class="err">Impossible de joindre le serveur. Vérifie ta connexion et recharge la page.</p>`;
  }
})();

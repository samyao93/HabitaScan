/* Liaisons de l'historique, du compte et du lieu de connexion. */
import { remplirAdminConnexions } from "../admin/remplissage.js";
import { plateforme } from "../annonce/profil.js";
import { CLE_LIEU_REP, LIEU } from "../compte/lieu.js";
import { etat } from "../etat.js";
import { HIS } from "./api.js";
import { go } from "../navigation/routeur.js";
import { $, app } from "../utils/dom.js";

export function lierHistoriqueCompteLieu(v) {
  if (v === "verifier" && $("#lien") && typeof plateforme === "function")
    $("#lien").addEventListener("change", () => {
      const p = plateforme({ lien: $("#lien").value });
      const d = app.querySelector("details.profil");
      if (!p || !d) return;
      d.open = true;
      d.querySelector("summary").textContent = `Vérifier le profil de l'annonceur sur ${p.nom} (facultatif)`;
      const h = d.querySelector(".hint");
      if (h) h.textContent = p.aide;
    });
  app.querySelectorAll("[data-va-de]").forEach(
    (b) =>
      (b.onclick = () => {
        etat.fiche.retourVA = b.dataset.vaDe;
        go("approfondie");
      }),
  );
  app.querySelectorAll("[data-verif]").forEach(
    (b) =>
      (b.onclick = () => {
        etat.fiche.verifId = b.dataset.verif;
        etat.fiche.retourVerif = v === "historique" ? "historique" : "accueil";
        go("detailVerif");
      }),
  );
  if (v === "historique")
    app.querySelectorAll("[data-hfiltre]").forEach(
      (b) =>
        (b.onclick = () => {
          etat.fiche.hfiltre = b.dataset.hfiltre;
          go("historique");
        }),
    );
  if (v === "detailVerif" && $("#h-suppr")) {
    const b = $("#h-suppr");
    b.onclick = async () => {
      if (!b.dataset.ok) {
        b.dataset.ok = "1";
        b.textContent = "Confirmer : retirer définitivement";
        return;
      }
      b.disabled = true;
      try {
        await HIS.supprimer(etat.fiche.verifId);
        go("historique");
      } catch (e) {
        b.disabled = false;
        b.textContent = "Réessayer";
        const er = $("#err");
        if (er) er.textContent = "Le retrait n'a pas fonctionné. Réessaie.";
      }
    };
  }
  if (v === "compte" && $("#lieu-ok")) {
    const c = $("#lieu-ok"),
      m = $("#lieu-msg");
    c.onchange = async () => {
      c.disabled = true;
      try {
        const g = await LIEU.definir(c.checked);
        try {
          localStorage.setItem(CLE_LIEU_REP, "1");
        } catch (e) {}
        m.textContent = !c.checked
          ? "Désactivé. Ton historique de lieux a été effacé."
          : g && g.ville
            ? `Activé. Ville notée pour cette connexion : ${g.ville}${g.region ? " (" + g.region + ")" : ""}. Seuls les administrateurs la voient.`
            : "Activé. Ta ville approximative sera notée à chaque connexion. Seuls les administrateurs la voient.";
      } catch (e) {
        c.checked = !c.checked;
        m.textContent = "Le changement n'a pas fonctionné. Réessaie.";
      }
      c.disabled = false;
    };
  }
  if (v === "accueil" && $("#inv-lieu")) {
    const fin = async (oui) => {
      try {
        localStorage.setItem(CLE_LIEU_REP, "1");
      } catch (e) {}
      if (oui) {
        try {
          await LIEU.definir(true);
        } catch (e) {}
      }
      const el = $("#inv-lieu");
      if (el) el.outerHTML = oui ? `<p class="hint centre">Merci. Tu peux changer ce choix dans Mon compte.</p>` : "";
    };
    $("#inv-oui").onclick = () => fin(true);
    $("#inv-non").onclick = () => fin(false);
  }
  if (v === "admin" && etat.fiche.onglet === "connexions") {
    const el = $("#adm");
    if (el)
      remplirAdminConnexions(el).catch(() => {
        el.innerHTML = `<p class="err">Chargement impossible.</p>`;
      });
  }
}

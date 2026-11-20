/* Liaisons de l'inscription, du code et de la déconnexion. */
import { chargerProfil, envoyerCode, msgAuth, ouvrirSession } from "./session.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { go } from "../navigation/routeur.js";
import { $, app, busy, err } from "../utils/dom.js";
import { LS } from "../utils/stockage.js";

export function ecouterModeConnexion() {
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest && e.target.closest("[data-mode]");
      if (b) etat.fiche.modeCx = b.dataset.mode === "connexion";
    },
    true,
  );
}

/* Écran « inscription » */
export function lierInscription(v) {
  $("#f-ins").onsubmit = async (e) => {
    e.preventDefault();
    err("");
    const val = $("#ident").value.trim();
    etat.fiche.ident = val;
    if ((etat.fiche.canal || "courriel") === "courriel") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return err("Entre une adresse courriel valide.");
      etat.fiche.cible = { email: val.toLowerCase() };
      etat.fiche.affiche = val;
    } else {
      const d = val.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      if (d.length !== 10) return err("Entre un numéro de 10 chiffres.");
      etat.fiche.cible = { phone: "+1" + d };
      etat.fiche.affiche = d.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2-$3");
    }
    busy(true, "Envoi…");
    const { error } = await envoyerCode();
    if (error) {
      busy(false, "Réessayer");
      return err(msgAuth(error));
    }
    go("code");
  };
}

/* Écran « code » */
export function lierCode(v) {
  const ins = [...app.querySelectorAll(".otp input")];
  ins[0].focus();
  ins.forEach((x, i) => {
    x.oninput = () => {
      x.value = x.value.replace(/\D/g, "").slice(-1);
      if (x.value && i < 5) ins[i + 1].focus();
    };
    x.onkeydown = (e) => {
      if (e.key === "Backspace" && !x.value && i) ins[i - 1].focus();
    };
    x.onpaste = (e) => {
      const d = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      if (d.length) {
        e.preventDefault();
        d.split("").forEach((c, j) => (ins[j].value = c));
        ins[Math.min(d.length, 5)].focus();
      }
    };
  });
  let t = 60;
  const tick = setInterval(() => {
    t--;
    const s = $("#t");
    if (!s) {
      clearInterval(tick);
      return;
    }
    s.textContent = t;
    if (t <= 0) {
      clearInterval(tick);
      $("#renvoi").disabled = false;
      $("#renvoi").textContent = "Renvoyer le code";
    }
  }, 1000);
  $("#renvoi").onclick = async () => {
    const { error } = await envoyerCode();
    if (error) return err(msgAuth(error));
    go("code");
  };
  $("#f-code").onsubmit = async (e) => {
    e.preventDefault();
    err("");
    const token = ins.map((x) => x.value).join("");
    if (token.length < 6) return err("Entre les 6 chiffres.");
    busy(true, "Vérification…");
    const { error } = await sb.auth.verifyOtp({ ...etat.fiche.cible, token, type: etat.fiche.typeCode });
    if (error) {
      busy(false, "Valider");
      return err(msgAuth(error));
    }
    clearInterval(tick);
    etat.fiche = {};
    await ouvrirSession();
    await chargerProfil();
    const pa = LS.get("vl_partage");
    if (pa) {
      LS.set("vl_partage", null);
      etat.fiche = { annonce: pa.annonce, lien: pa.lien, partage: true };
      return go("verifier");
    }
    const sig = LS.get("vl_sig");
    if (sig) {
      if (etat.profil && etat.profil.identite_statut === "confirmee") {
        etat.fiche = sig;
        return go("signaler");
      }
      return go(etat.profil && etat.profil.identite_statut === "en_attente" ? "attente" : "identite");
    }
    go("accueil");
  };
}

/* Écran « compte » */
export function lierDeconnexion(v) {
  if (!$("#deco")) return;
  $("#deco").onclick = async () => {
    await sb.auth.signOut();
    etat.profil = null;
    etat.historique = [];
    etat.fiche = {};
    etat.session = false;
    etat.lieuNote = false;
    go("bienvenue");
  };
}

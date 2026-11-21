/* Badge « Annonce vérifiée » : liaisons de l'écran du propriétaire et de l'onglet admin. */
import { BADGE } from "./api.js";
import { remplirAdminBadges } from "./admin.js";
import { htmlMesBadges } from "./ecrans.js";
import { etat } from "../etat.js";
import { go } from "../navigation/routeur.js";
import { fusionContacts } from "../memoire/contacts.js";
import { chiffresLot } from "../proprietaire/regles.js";
import { $, err } from "../utils/dom.js";

const ERREURS = {
  "identite non confirmee": "Ton identité doit d'abord être confirmée.",
  "contact requis": "Entre le téléphone ou le courriel de tes annonces.",
  "trop de demandes": "Trop de demandes aujourd'hui. Réessaie demain.",
  "trop de badges": "Tu as atteint le nombre maximum de badges pour un compte. Écris-nous.",
  "badge ferme": "Les demandes de badge sont fermées pour le moment.",
  "compte suspendu": "Ton compte est suspendu.",
};

const ERREURS_CODE = {
  mauvais_code: (r) =>
    `Code incorrect. ${r.restants} essai${r.restants > 1 ? "s" : ""} restant${r.restants > 1 ? "s" : ""}.`,
  bloque: () => "Trop d'essais : ce badge est bloqué. Écris-nous pour recevoir une nouvelle lettre.",
  code_expire: () => "Ce code a plus de 60 jours. Écris-nous pour recevoir une nouvelle lettre.",
  pas_de_lettre: () => "Aucune lettre en attente pour ce badge.",
};

async function remplirMesBadges(msg) {
  const el = $("#mes-badges");
  if (!el) return;
  let L = [];
  try {
    L = await BADGE.mes();
  } catch (e) {}
  if (!$("#mes-badges")) return;
  el.innerHTML = htmlMesBadges(L, msg);
  el.querySelectorAll("form[data-confirmer]").forEach(
    (f) =>
      (f.onsubmit = async (e) => {
        e.preventDefault();
        const b = f.querySelector("button"),
          code = f.querySelector("input").value.trim();
        if (code.replace(/[^A-Za-z0-9]/g, "").length !== 8)
          return remplirMesBadges("Le code de la lettre a 8 caractères, par exemple ABCD-EFGH.");
        b.disabled = true;
        try {
          const r = await BADGE.confirmer(f.dataset.confirmer, code);
          remplirMesBadges(
            r && r.ok
              ? `Bravo, ton badge est actif : ${r.code}. Ajoute le texte ci-dessous à tes annonces.`
              : (ERREURS_CODE[r && r.erreur] || (() => "La validation n'a pas fonctionné. Réessaie."))(r || {}),
          );
        } catch (x) {
          b.disabled = false;
          remplirMesBadges("La validation n'a pas fonctionné. Réessaie.");
        }
      }),
  );
  el.querySelectorAll("[data-copier-badge]").forEach(
    (b) =>
      (b.onclick = async () => {
        const t = b.parentNode.querySelector("[data-texte-badge]");
        try {
          await navigator.clipboard.writeText(t.value);
          b.textContent = "Texte copié";
        } catch (e) {
          t.select();
        }
      }),
  );
}

function lierFormulaire(F) {
  const B = F.B;
  const f = $("#f-badge");
  if (!f) return;
  const garder = () => {
    B.adresse = $("#b-adresse").value;
    B.ville = $("#b-ville").value;
    B.lot = chiffresLot($("#b-lot").value);
    B.type = $("#b-type").value;
    B.nom = $("#b-nom").value;
    B.neq = $("#b-neq").value;
    B.tels = $("#b-tels").value;
    B.cour = $("#b-cour").value;
  };
  $("#b-type").onchange = () => {
    garder();
    $("#l-neq").hidden = B.type !== "entreprise";
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    garder();
    if (B.adresse.trim().length < 6 || !/\d/.test(B.adresse)) return err("Entre l'adresse complète, avec le numéro.");
    if (B.ville.trim().length < 2) return err("Entre la ville de l'immeuble.");
    if (B.lot && !/^\d{7,8}$/.test(B.lot)) return err("Le numéro de lot a 7 chiffres. Laisse vide si tu ne l'as pas.");
    if (B.nom.trim().length < 2) return err("Entre le nom inscrit au Registre foncier.");
    if (B.type === "entreprise" && !/^\d{10}$/.test(B.neq.replace(/\D/g, "")))
      return err("Le NEQ de l'entreprise a 10 chiffres (registre des entreprises).");
    const c = fusionContacts({}, { tels: B.tels.split(/[,;]/), courriels: B.cour.split(/[,;\s]+/) });
    if (B.tels.trim() && !c.tels.length) return err("Ce numéro de téléphone n'est pas valide (10 chiffres).");
    if (B.cour.trim() && !c.courriels.length) return err("Ce courriel n'est pas valide.");
    if (!$("#b-ok").checked) return err("Coche la case pour continuer.");
    const b = $("#go");
    b.disabled = true;
    b.textContent = "Envoi…";
    try {
      await BADGE.demander({ ...B, tels: c.tels, courriels: c.courriels });
      F.B = { msg: "Demande reçue. Nous consultons le Registre foncier, puis une lettre part par la poste." };
      go("badge");
    } catch (x) {
      b.disabled = false;
      b.textContent = "Envoyer ma demande";
      const m = String((x && x.message) || "");
      err(Object.entries(ERREURS).find(([k]) => m.includes(k))?.[1] || "La demande n'a pas pu être envoyée. Réessaie.");
    }
  };
}

export function lierBadges(v) {
  if (v === "badge") {
    const msg = etat.fiche.B && etat.fiche.B.msg;
    if (msg) delete etat.fiche.B.msg;
    lierFormulaire(etat.fiche);
    remplirMesBadges(msg);
  }
  if (v === "admin" && etat.fiche.onglet === "badges") {
    const el = $("#adm");
    if (el)
      remplirAdminBadges(el).catch(() => {
        el.innerHTML = `<p class="err">Chargement impossible.</p>`;
      });
  }
}

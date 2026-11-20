/* Liaisons du signalement d'une annonce. */
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { peutSignaler } from "../memoire/memoire.js";
import { go } from "../navigation/routeur.js";
import { lierSignaler, validerSignal } from "./signalements.js";
import { $, busy, err } from "../utils/dom.js";
import { LS } from "../utils/stockage.js";

/* Écran « resultat » */
export function lierBoutonSignaler(v) {
  if (!$("#signaler")) return;
  $("#signaler").onclick = () => {
    const sig = {
      lienN: etat.fiche.lienN,
      ville: etat.fiche.ville,
      contacts: etat.fiche.contacts,
      photos: etat.fiche.photos,
    };
    LS.set("vl_sig", sig);
    if (etat.anonyme) return go("inscription");
    const st = etat.profil && etat.profil.identite_statut;
    if (st === "confirmee") {
      etat.fiche = sig;
      return go("signaler");
    }
    go(st === "en_attente" ? "attente" : "identite");
  };
}

/* Écran « signaler » */
export function lierSignalement(v) {
  if (!peutSignaler(etat.fiche)) {
    const sig = LS.get("vl_sig");
    if (sig) etat.fiche = sig;
  }
  lierSignaler(etat.fiche);
  $("#f-sig").onsubmit = async (e) => {
    e.preventDefault();
    err("");
    const m = validerSignal(etat.fiche);
    if (m) return err(m);
    busy(true, "Envoi…");
    let ok = false;
    if (etat.fiche.lienN) {
      const { error } = await sb.from("signalements").insert({ lien: etat.fiche.lienN, motif: etat.fiche.motif });
      if (!error || String(error.code).includes("23505")) ok = true;
    }
    const c = etat.fiche.contacts || { tels: [], courriels: [] };
    if (c.tels.length || c.courriels.length || (etat.fiche.photos || []).length) {
      const { error } = await sb.rpc("signaler_cles", {
        p_motif: etat.fiche.motif,
        p_tels: c.tels,
        p_courriels: c.courriels,
        p_photos: etat.fiche.photos || [],
      });
      if (!error) ok = true;
    }
    if (!ok) {
      busy(false, "Réessayer");
      return err("Le signalement n'a pas pu être envoyé. Réessaie.");
    }
    LS.set("vl_sig", null);
    etat.fiche = {};
    go("signalOk");
  };
}

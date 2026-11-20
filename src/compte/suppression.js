/* Suppression du compte (Loi 25). */
import { ADM } from "../admin/api.js";
import { nouveauF } from "../etat.js";
import { go } from "../navigation/routeur.js";
import { $, err, top } from "../utils/dom.js";

export const vueSupprimer = () => `${top("compte", "Supprimer mon compte")}
<h2>Supprimer mon compte</h2>
<div class="card"><p>Ton compte, ton historique, tes signalements et, s'il y en a, les photos de ta pièce d'identité seront supprimés. C'est définitif.</p>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="sup-ok" style="width:22px;min-height:22px;margin-top:2px">Je comprends que la suppression est définitive.</label>
<p class="err" id="e" hidden></p>
<button class="btn danger" id="go">Supprimer définitivement</button></div>`;

export function lierSupprimer() {
  $("#go").onclick = async () => {
    if (!$("#sup-ok").checked) return err("Coche la case pour confirmer.");
    const b = $("#go");
    b.disabled = true;
    b.textContent = "Suppression…";
    try {
      await ADM.supprimerCompte();
      nouveauF({});
      go("bienvenue");
    } catch (x) {
      b.disabled = false;
      b.textContent = "Réessayer";
      err("La suppression n'a pas fonctionné. Réessaie, ou écris à la personne responsable.");
    }
  };
}

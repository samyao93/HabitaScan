/* Liaisons de l'alerte « annonce signalée » : « Compris » sur l'accueil, interrupteur de Mon compte. */
import { definirAlertes, marquerAlertesVues } from "./alertes.js";
import { $ } from "../utils/dom.js";

export function lierAlertes(v) {
  if (v === "accueil" && $("#alertes-vues")) {
    $("#alertes-vues").onclick = () => {
      const el = $("#alertes");
      if (el) el.remove();
      marquerAlertesVues();
    };
  }
  if (v === "compte" && $("#alertes-ok")) {
    const c = $("#alertes-ok"),
      m = $("#alertes-msg");
    c.onchange = async () => {
      c.disabled = true;
      try {
        await definirAlertes(c.checked);
        m.textContent = c.checked
          ? "Activé. Tu seras prévenu dans l'app."
          : "Désactivé. Tu ne seras plus prévenu si une annonce vérifiée est signalée.";
      } catch (e) {
        c.checked = !c.checked;
        m.textContent = "Le changement n'a pas fonctionné. Réessaie.";
      }
      c.disabled = false;
    };
  }
}

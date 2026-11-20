/* Vérification complète : liaisons. */
import { remplirAdminDemandes } from "../admin/remplissage.js";
import { VAP } from "./api.js";
import { STATUTS, VCFG, VERDICTS, htmlRapport, prixTxt } from "./rapport.js";
import { etat, nouveauF } from "../etat.js";
import { MES } from "../mesure/mesure.js";
import { go } from "../navigation/routeur.js";
import { chiffresLot } from "../proprietaire/regles.js";
import { $, err, esc } from "../utils/dom.js";

function lierApprofondie(F) {
  const A = F.VA;
  const garder = () => {
    A.adresse = $("#va-adresse").value;
    A.lot = chiffresLot($("#va-lot").value);
    A.nom = $("#va-nom").value;
    A.lien = $("#va-lien").value;
  };
  $("#f-va").onsubmit = async (e) => {
    e.preventDefault();
    garder();
    if (A.adresse.trim().length < 6 || !/\d/.test(A.adresse))
      return err("Entre l'adresse complète, avec le numéro et la ville.");
    if (A.lot && !/^\d{7,8}$/.test(A.lot))
      return err("Le numéro de lot a 7 chiffres, par exemple 1 234 567. Laisse vide si tu ne l'as pas.");
    if (!$("#va-ok").checked) return err("Coche la case pour continuer.");
    if (!VAP.demo && !VCFG.lien) return err("Le paiement n'est pas encore ouvert. Réessaie bientôt.");
    const b = $("#go");
    b.disabled = true;
    b.textContent = "Préparation du paiement…";
    try {
      const id = await VAP.creer({
        adresse: A.adresse.trim(),
        lot: A.lot || null,
        nom_interlocuteur: A.nom.trim() || null,
        role: A.role,
        lien: A.lien.trim() || null,
      });
      try {
        MES.noter("demande_creee");
      } catch (e) {}
      if (VAP.demo) {
        nouveauF({});
        return go("accueil");
      }
      const u = new URL(VCFG.lien);
      u.searchParams.set("client_reference_id", id);
      const c = VAP.courriel();
      if (c) u.searchParams.set("prefilled_email", c);
      location.href = u.toString();
    } catch (x) {
      b.disabled = false;
      b.textContent = `Payer ${prixTxt()} par carte`;
      err("La demande n'a pas pu être créée. Réessaie.");
    }
  };
}

async function remplirMesApprofondies() {
  const el = $("#mes-approf");
  if (!el) return;
  const paye = /[?&]paye=1/.test(location.search);
  if (paye)
    try {
      history.replaceState(null, "", location.pathname);
    } catch (e) {}
  let L = [];
  try {
    L = await VAP.mes();
  } catch (e) {}
  if (!$("#mes-approf")) return;
  if (!L.length && !paye) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="card"><h2>Vérifications complètes</h2>${paye ? `<p class="lu">Paiement reçu. Ton rapport arrive ici en ${VCFG.delai} h maximum.</p>` : ""}
${L.map((d) => {
  const s = STATUTS[d.statut] || ["i", d.statut];
  const v = d.verdict && VERDICTS[d.verdict];
  return `<div class="demande"><p><b>${esc(d.adresse)}</b><span class="tag ${s[0]}">${s[1]}</span></p>
${d.statut === "terminee" ? (d.rapport || d.verdict_global ? htmlRapport(d) : v ? `<ul class="reasons"><li><span class="dot ${v[0]}"></span><div>${v[1]}${d.note ? `<div class="law">${esc(d.note)}</div>` : ""}</div></li></ul>` : "") : ""}
${d.statut === "payee" ? `<p class="hint">Rapport au plus tard ${VCFG.delai} h après le paiement.</p>${VAP.demo ? `<button type="button" class="lienbtn" data-simrapport="${esc(d.id)}">(Démo) Voir un exemple de rapport</button>` : ""}` : ""}
${d.statut === "a_payer" && VAP.demo ? `<button type="button" class="lienbtn" data-simpaye="${esc(d.id)}">(Démo) Simuler le paiement</button>` : ""}</div>`;
}).join("")}</div>`;
  el.querySelectorAll("[data-simpaye]").forEach(
    (b) =>
      (b.onclick = async () => {
        await VAP.simulerPaiement(b.dataset.simpaye);
        remplirMesApprofondies();
      }),
  );
  el.querySelectorAll("[data-simrapport]").forEach(
    (b) =>
      (b.onclick = async () => {
        await VAP.simulerRapport(b.dataset.simrapport);
        remplirMesApprofondies();
      }),
  );
}

export function lierApprofondies(v) {
  if (v === "approfondie") lierApprofondie(etat.fiche);
  if (v === "accueil") remplirMesApprofondies();
  if (v === "admin" && etat.fiche.onglet === "demandes") {
    const el = $("#adm");
    if (el)
      remplirAdminDemandes(el).catch(() => {
        el.innerHTML = `<p class="err">Chargement impossible.</p>`;
      });
  }
  if (v === "admin" && (etat.fiche.onglet || "chiffres") === "montants") {
    setTimeout(() => {
      const el = $("#adm");
      if (!el || el.querySelector("#va-lienpay")) return;
      el.insertAdjacentHTML(
        "afterbegin",
        `<div class="card"><h2>Paiement Stripe</h2><label>Lien de paiement Stripe (Payment Link)<span class="ligne"><input id="va-lienpay" inputmode="url" placeholder="https://buy.stripe.com/…" value="${esc(VCFG.lien)}"><button type="button" class="btn ghost petit" id="va-sauverlien">Enregistrer</button></span></label><p class="hint">Le prix et le délai se changent plus bas, dans « Budget ». Le prix affiché doit être le même que celui du lien Stripe.</p></div>`,
      );
      $("#va-sauverlien").onclick = async () => {
        const val = $("#va-lienpay").value.trim();
        if (val && !/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(val)) {
          $("#va-sauverlien").textContent = "Lien invalide";
          return;
        }
        try {
          await VAP.sauverTexte("lien_paiement", val);
          VCFG.lien = val;
          $("#va-sauverlien").textContent = "Enregistré";
        } catch (x) {
          $("#va-sauverlien").textContent = "Erreur";
        }
      };
    }, 0);
  }
}

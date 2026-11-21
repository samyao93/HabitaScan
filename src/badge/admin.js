/* Badge « Annonce vérifiée » : onglet Badges de l'espace admin. */
import { BADGE } from "./api.js";
import { STATUTS_BADGE } from "./regles.js";
import { fmtLot } from "../proprietaire/regles.js";
import { esc } from "../utils/dom.js";
import { L_INFOLOT, L_REGISTRE, lien } from "../utils/liens.js";

const jour = (d) => String(d || "").slice(0, 10);

/* Lettre à imprimer : le code n'est montré qu'une fois. */
const htmlLettre = (
  b,
  code,
) => `<div class="rule" style="text-align:left" role="status"><b>Code de la lettre : <span class="num">${esc(code)}</span></b> (affiché une seule fois)
<p>Adresse de l'enveloppe : celle du propriétaire inscrit au <b>dernier acte de vente</b> ou au <b>rôle d'évaluation</b>. Jamais une adresse donnée par le demandeur, par courriel ou par téléphone.</p>
<textarea readonly rows="7">${esc(`Bonjour,

Vous avez demandé le badge « Annonce vérifiée » HabitaScan pour l'immeuble du ${b.adresse}${b.ville ? `, ${b.ville}` : ""}.
Pour l'activer, ouvrez l'app HabitaScan, touchez « Tu es propriétaire ? Obtiens le badge » et entrez ce code : ${code}
Ce code est valable 60 jours. Si vous n'avez rien demandé, ignorez cette lettre et écrivez-nous : quelqu'un a peut-être tenté d'usurper votre nom.

L'équipe HabitaScan`)}</textarea></div>`;

export async function remplirAdminBadges(el) {
  const L = await BADGE.adminListe();
  if (!el.isConnected) return;
  el.innerHTML = L.length
    ? L.map((b) => {
        const s = STATUTS_BADGE[b.statut] || ["i", b.statut];
        const ouvert = ["demande", "lettre_envoyee", "bloque"].includes(b.statut);
        return `<div class="card" data-badge="${esc(b.id)}"><p><b>${esc(b.adresse)}${b.ville ? `, ${esc(b.ville)}` : ""}</b> <span class="tag ${s[0]}">${s[1]}</span></p>
<p class="hint">${esc(b.contact || "")} · demandé le ${esc(jour(b.created_at))}${b.lettre_envoyee_le ? ` · lettre le ${esc(jour(b.lettre_envoyee_le))}` : ""}${b.essais ? ` · ${esc(b.essais)} essai(s) raté(s)` : ""}</p>
<p>Nom déclaré (Registre foncier) : <b>${esc(b.nom_proprietaire)}</b>${b.type_proprietaire === "entreprise" ? ` · entreprise, NEQ <span class="num">${esc(b.neq || "?")}</span>` : ""}${b.lot ? ` · lot <span class="num">${esc(fmtLot(b.lot))}</span>` : ""}</p>
<p>Identité confirmée du compte : <b>${esc(b.identite || "(aucun nom gardé)")}</b></p>
${b.alerte_nom ? `<ul class="reasons"><li><span class="dot r"></span><div>Le prénom et l'initiale de la pièce d'identité ne se retrouvent pas dans le nom déclaré. Exige une explication (copropriété, nom d'usage) avant d'envoyer la lettre.</div></li></ul>` : ""}
<p class="hint">Contacts reconnus : ${(b.contacts_affiches || []).map(esc).join(", ")}${b.code_public ? ` · badge <span class="num">${esc(b.code_public)}</span>, jusqu'au ${esc(jour(b.expire_le))}` : ""}${b.motif ? ` · ${esc(b.motif)}` : ""}</p>
${
  ouvert
    ? `<p class="hint">À vérifier : le propriétaire inscrit du lot (${lien(L_INFOLOT, "Infolot")}, puis ${lien(L_REGISTRE, "Registre foncier")}) ${b.type_proprietaire === "entreprise" ? `est l'entreprise, et la personne en est dirigeante au ${lien("https://www.registreentreprises.gouv.qc.ca/", "registre des entreprises")}` : "est bien cette personne"}. Note l'adresse du propriétaire inscrite à l'acte ou au rôle d'évaluation, pour la lettre.</p>
<button class="btn" data-lettre="${esc(b.id)}">${b.statut === "demande" ? "Registre conforme : créer le code de la lettre" : "Lettre perdue : créer un nouveau code"}</button>`
    : ""
}
<div data-sortie></div>
${
  b.statut !== "refuse" && b.statut !== "revoque"
    ? `<label>Motif (montré au propriétaire)<input data-motif autocomplete="off" maxlength="300"></label>
<button type="button" class="btn ghost" data-decider="${b.statut === "verifie" ? "revoque" : "refuse"}">${b.statut === "verifie" ? "Retirer le badge" : "Refuser la demande"}</button>`
    : ""
}</div>`;
      }).join("")
    : `<div class="card"><p>Aucune demande de badge.</p></div>`;
  el.querySelectorAll("[data-lettre]").forEach(
    (bt) =>
      (bt.onclick = async () => {
        const carte = bt.closest("[data-badge]"),
          b = L.find((x) => x.id === bt.dataset.lettre);
        bt.disabled = true;
        try {
          const code = await BADGE.adminLettre(b.id);
          carte.querySelector("[data-sortie]").innerHTML = htmlLettre(b, code);
          bt.hidden = true;
        } catch (x) {
          bt.disabled = false;
          bt.textContent = "Erreur, réessaie";
        }
      }),
  );
  el.querySelectorAll("[data-decider]").forEach(
    (bt) =>
      (bt.onclick = async () => {
        const carte = bt.closest("[data-badge]");
        bt.disabled = true;
        try {
          await BADGE.adminDecider(carte.dataset.badge, bt.dataset.decider, carte.querySelector("[data-motif]").value);
          remplirAdminBadges(el);
        } catch (x) {
          bt.disabled = false;
          bt.textContent = "Erreur, réessaie";
        }
      }),
  );
}

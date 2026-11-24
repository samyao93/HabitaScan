/* Blocs du résultat : coût mensuel réel (modifiable), frais ponctuels, questions à poser à la visite. */
import {
  A_CHARGE,
  AUCUN,
  INCLUS,
  INCONNU,
  POSTES,
  calculerCout,
  lireDepenses,
  lireFraisPonctuels,
  questionsVisite,
} from "./regles.js";
import { repereLmm } from "../prix/lmm.js";
import { $, esc, money } from "../utils/dom.js";

const L1904 =
  'Code civil du Québec, art. 1904 · <a href="https://www.quebec.ca/nouvelles/actualites/details/exiger-un-depot-de-garantie-est-illegal" target="_blank" rel="noopener">Québec.ca</a>';

/* Lit l'annonce, les captures et la conversation de la fiche (appelé avant l'analyse). */
export function preparerCouts(F) {
  const texte = [F.annonce, F.ocrTxt, F.txt].filter(Boolean).join("\n");
  F.depenses = lireDepenses(texte);
  F.frais = lireFraisPonctuels(texte);
}

const OPTIONS = [
  [INCLUS, "Incluse"],
  [A_CHARGE, "À ma charge"],
  [AUCUN, "Aucune"],
  [INCONNU, "Non précisée"],
];

function ligneDepense(p, d) {
  const etatTxt =
    d.statut === INCLUS
      ? "incluse"
      : d.statut === AUCUN
        ? p.cle === "stationnement"
          ? "aucun stationnement prévu"
          : "aucune"
        : d.statut === A_CHARGE
          ? d.montant > 0
            ? `<span class="num">${money(d.montant)}</span> par mois`
            : "à ta charge, <b>montant non précisé</b>"
          : "<b>non précisée</b> dans l'annonce";
  return `<li class="depense"><div class="dep-tete"><b>${esc(p.nom)}</b> : ${etatTxt}</div><div class="grid2">
<label class="mini">Statut<select data-dep="${p.cle}">${OPTIONS.map(([v, t]) => `<option value="${v}" ${d.statut === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
<label class="mini" ${d.statut === A_CHARGE ? "" : "hidden"}>Montant par mois<input data-dep-m="${p.cle}" inputmode="numeric" placeholder="Inconnu" value="${d.montant > 0 ? d.montant : ""}"></label></div></li>`;
}

function blocLmm(F, c) {
  const r = repereLmm(F.ville, F.ch, c.total, c.minimum);
  if (!r) return "";
  const ch = r.ch === 3 ? "3 chambres" : `${r.ch} chambre${r.ch > 1 ? "s" : ""}`;
  return `<p class="soft"><b>Repère, services compris :</b> <span class="num">${money(r.lmm)}</span> par mois pour ${ch} (${esc(r.region)}). ${esc(r.texte)}</p>
<p class="law">${esc(r.source)}, ${esc(r.periode)}. ${esc(r.note)}${r.ch === 3 ? " Pour 4 chambres et plus, le repère est plus élevé." : ""}</p>`;
}

function contenuCout(F) {
  const dep = F.depenses || {};
  const c = calculerCout(F.prixN, dep);
  return `<h2>Coût mensuel réel</h2>
<div class="verdict ${c.minimum ? "y" : "g"}"><strong>${c.minimum ? "Au moins " : ""}<span class="num">${money(c.total)}</span> par mois</strong><span>Loyer de ${money(F.prixN)}${c.total > F.prixN ? ` + ${money(c.total - F.prixN)} de dépenses connues` : ""}.${c.minimum ? ` Non précisé : ${esc(c.inconnues.join(", ").toLowerCase())}. Ces dépenses ne sont pas comptées : demande leur montant à la visite.` : ""}</span></div>
${blocLmm(F, c)}
<ul class="reasons depenses">${POSTES.map((p) => ligneDepense(p, dep[p.cle] || { statut: INCONNU })).join("")}</ul>
<p class="hint">Lu automatiquement dans l'annonce : corrige si tu en sais plus, le total se met à jour. L'assurance habitation est toujours à ta charge, en plus.</p>`;
}

export function blocCout(F) {
  if (!(F.prixN > 0)) return "";
  return `<div class="card" id="cout">${contenuCout(F)}</div>${blocFrais(F)}`;
}

function blocFrais(F) {
  const frais = F.frais || [];
  return `<div class="card"><h2>Frais ponctuels</h2><ul class="reasons">
<li><span class="dot g"></span><div><b>Premier mois de loyer</b> : <span class="num">${money(F.prixN)}</span>, payable à la signature du bail, jamais avant.</div></li>
${frais.map((f) => `<li><span class="dot y"></span><div><b>${esc(f.nom)}</b>${f.montant ? ` : <span class="num">${money(f.montant)}</span>` : ""} (mentionné dans l'annonce). Ne peut pas être exigé : seul le premier mois de loyer peut l'être.<div class="law">${L1904}</div></div></li>`).join("")}
</ul>${frais.length ? "" : `<p class="hint">Aucun autre frais mentionné dans l'annonce. Prévois aussi le déménagement et l'ouverture du compte d'électricité.</p>`}</div>`;
}

export function blocQuestions(F) {
  const q = questionsVisite(F.depenses || {}, F.frais || [], F);
  return `<div class="card"><h2>Questions à poser à la visite</h2><ol class="questions">${q.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`;
}

/* Modifier une dépense met à jour le total sans recharger l'écran. */
export function lierCout(F) {
  const zone = $("#cout");
  if (!zone) return;
  const maj = (e) => {
    const t = e.target;
    const k = t.dataset.dep || t.dataset.depM;
    if (!k) return;
    const d = (F.depenses[k] = F.depenses[k] || { statut: INCONNU, montant: null });
    if (t.dataset.dep) d.statut = t.value;
    else {
      const n = parseInt(String(t.value).replace(/\D/g, ""), 10);
      d.montant = n > 0 && n < 5000 ? n : null;
      if (e.type === "input") return; // on recalcule à la sortie du champ, pour ne pas perdre le curseur
    }
    if (d.statut !== A_CHARGE) d.montant = null;
    zone.innerHTML = contenuCout(F);
  };
  zone.addEventListener("change", maj);
  zone.addEventListener("input", maj);
}

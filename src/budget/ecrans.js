/* Budget : écran, résultat et comparaison des villes. */
import { ASSURANCE, EPICERIE, GARDE, TRANSIT, budgetDefaut, calculerBudget } from "./regles.js";
import { etat } from "../etat.js";
import { CHOIX_CH, indiceCh, loyerSchl } from "../prix/reference.js";
import { esc, top } from "../utils/dom.js";
import { L_1904, L_SCHL30, lienExt } from "../utils/liens.js";
import { m0 } from "../utils/texte.js";

function comparerVilles(B, R) {
  const ch = indiceCh(B.ch);
  return `<h3 class="sous">Comparer les villes</h3><p class="hint">Pour ${ch === 0 ? "un studio" : ch === 3 ? "3 chambres et plus" : ch + " chambre" + (ch > 1 ? "s" : "")}. Loyer médian SCHL (octobre 2025) et laissez-passer 2026.</p>
<table class="tvilles"><thead><tr><th>Ville</th><th>Loyer médian</th><th>Transport</th>${R.revMois ? "<th>30 %</th>" : ""}</tr></thead><tbody>
${Object.keys(etat.loyers)
  .map((v) => {
    const r = loyerSchl(v, ch),
      m = r ? r.loyer : 0,
      t = TRANSIT[v],
      ok = R.revMois && m + R.elec <= R.revMois * 0.3;
    return `<tr${v === B.ville ? ' class="ici"' : ""}><td>${esc(v)}</td><td class="num">${m ? m0(m) : "—"}</td><td class="num">${t ? String(t.p).replace(".", ",") + " $" : "—"}</td>${R.revMois ? `<td>${m ? (ok ? '<span class="ok">Oui</span>' : '<span class="non">Non</span>') : "—"}</td>` : ""}</tr>`;
  })
  .join("")}
</tbody></table>${R.revMois ? `<p class="hint">« Oui » : le loyer médian et ton électricité restent sous 30 % de ton revenu.</p>` : ""}`;
}

export function resultatBudget(B) {
  const R = calculerBudget(B);
  if (!R.mensuel) return `<p class="hint">Entre le loyer visé pour voir ton budget.</p>`;
  const c = !R.revMois ? "g" : R.ratio <= 0.3 ? "g" : R.ratio <= 0.4 ? "y" : "r";
  return `<div class="tuiles"><div class="tuile fort"><span>Total pour ${R.mois} mois</span><b class="num">${m0(R.total)}</b></div>
<div class="tuile"><span>Par mois</span><b class="num">${m0(R.mensuel)}</b></div><div class="tuile"><span>Frais uniques</span><b class="num">${m0(R.uniques)}</b></div>${R.base ? `<div class="tuile"><span>${R.baseNet ? "Salaire net" : "Revenu avant impôt"} pour ${R.mois} mois</span><b class="num">${m0(R.revPeriode)}</b></div><div class="tuile"><span>${R.restePeriode < 0 ? "Manque" : "Reste"} après ${R.mois} mois</span><b class="num" style="color:${R.restePeriode < 0 ? "var(--red)" : "inherit"}">${m0(Math.abs(R.restePeriode))}</b></div>` : ""}</div>
${R.base && !R.baseNet ? `<p class="hint">Calculé sur ton revenu <b>avant impôt</b> : l'impôt n'est pas déduit, le reste réel sera plus bas. Ajoute ton salaire net pour un calcul exact.</p>` : ""}
<p class="hint">Total : déménagement et meubles, plus ${R.mois} mois de dépenses. Le premier mois de loyer y est compris. Ne le paie qu'au moment de signer le bail, après avoir confirmé que tu parles au vrai propriétaire, et par un moyen qui laisse une trace (chèque ou virement, avec un reçu). Il ne peut rien exiger d'autre d'avance : aucun dépôt (${lienExt(L_1904, "art. 1904 C.c.Q.")}).</p>
${
  R.base
    ? (() => {
        const cr =
          R.reste < 0
            ? "r"
            : R.reste < R.base * 0.1 || (R.loyer + R.elec) / R.base > (R.baseNet ? 0.5 : 0.3)
              ? "y"
              : "g";
        return `<div class="verdict ${cr}"><strong>${R.reste < 0 ? "Il te manque" : "Il te reste"} <span class="num">${m0(Math.abs(R.reste))}</span> par mois</strong><span>${R.baseNet ? "Salaire net" : "Revenu avant impôt"} de ${m0(R.base)} par mois, moins tes dépenses mensuelles de ${m0(R.mensuel)}${cr === "g" ? " : de la marge pour l'épargne, les imprévus et les loisirs." : cr === "y" ? " : c'est serré, garde une réserve pour les imprévus." : ". Réduis le loyer visé ou pense à une colocation."} Le loyer et l'électricité font ${Math.round(((R.loyer + R.elec) / R.base) * 100)} % de ton ${R.baseNet ? "salaire net" : "revenu avant impôt"}.${R.baseNet ? "" : " Avec l'impôt, il te restera moins : ajoute ton salaire net pour le chiffre exact."}</span></div>`;
      })()
    : ""
}
${R.revMois ? `<div class="verdict ${c}"><strong>Loyer maximum conseillé : <span class="num">${m0(R.max)}</span></strong><span>30 % de ton revenu avant impôt, moins l'électricité (${lienExt(L_SCHL30, "règle de la SCHL")}). Ton loyer visé et l'électricité font ${Math.round(R.ratio * 100)} % de ton revenu${c === "g" ? " : c'est dans la norme." : c === "y" ? " : le budget sera serré." : " : cherche moins cher ou une colocation."}</span></div>` : R.base ? "" : `<p class="hint">Ajoute ton revenu pour connaître le loyer maximum conseillé.</p>`}
<h3 class="sous">Où va ton argent chaque mois</h3>
<div class="barres">${R.postes
    .sort((a, b) => b.v - a.v)
    .map(
      (p) =>
        `<div class="barre"><span>${p.n}</span><span class="num">${m0(p.v)}</span><i style="width:${Math.max(2, Math.round((p.v / R.mensuel) * 100))}%"></i></div>`,
    )
    .join("")}</div>
${R.ref ? `<p class="hint">Loyer ${R.ref.stat} à ${esc(B.ville)} : <b class="num">${m0(R.ref.loyer)}</b> (SCHL, Enquête sur les logements locatifs, ${esc(R.ref.periode)}).</p>` : ""}
${R.revMois ? `<button class="btn" id="b-annonces">Chercher des logements jusqu'à ${m0(R.max)}</button>` : `<button class="btn" id="b-annonces">Chercher des logements à ${esc(B.ville)}</button>`}
${comparerVilles(B, R)}`;
}

export function vueBudget(F, back) {
  const B = budgetDefaut(F);
  const t = TRANSIT[B.ville];
  const champ = (k, l, ph, aide) =>
    `<label>${l}<input id="b-${k}" data-b="${k}" inputmode="decimal" autocomplete="off" placeholder="${ph}" value="${esc(B[k] || "")}">${aide ? `<span class="hint">${aide}</span>` : ""}</label>`;
  const choix = (k, l, vals) =>
    `<label>${l}<select id="b-${k}" data-b="${k}">${vals.map(([v, t]) => `<option value="${v}" ${String(B[k]) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  const n = (a) => [...Array(a[1] - a[0] + 1)].map((_, i) => [i + a[0], String(i + a[0])]);
  return `${top(back, "Budget")}
<h2>Mon budget d'installation 2026</h2>
<p class="soft">Combien prévoir pour t'installer et combien tu peux payer de loyer. Chaque montant par défaut a sa source, et tu peux le changer.</p>
<div class="card"><h2>Ta situation</h2>
<div class="grid2">${choix(
    "ville",
    "Ville",
    Object.keys(etat.loyers).map((v) => [v, v]),
  )}${choix("ch", "Chambres", CHOIX_CH)}</div>
<div class="grid2">${choix("adultes", "Adultes", n([1, 4]))}${choix("enfants", "Enfants", n([0, 5]))}</div>
${+B.enfants ? choix("garderie", "Enfants en garderie (0 à 5 ans)", n([0, +B.enfants])) : ""}
<div class="grid2">${champ("revenu", "Revenu du ménage avant impôt", "45 000")}${choix("unite", "Par", [
    ["an", "année"],
    ["mois", "mois"],
  ])}</div>
<div class="grid2">${champ("net", "Salaire net du ménage (facultatif)", "2 900")}${choix("netUnite", "Par", [
    ["mois", "mois"],
    ["2sem", "2 semaines"],
    ["an", "année"],
  ])}</div>
<p class="hint" style="margin-top:-6px">Le montant qui arrive vraiment dans ton compte, après impôts et retenues (voir ton talon de paie). Il sert à calculer ce qui te reste chaque mois.</p>
${champ("loyer", "Loyer visé par mois", "1 200", "Par défaut : loyer médian SCHL de la ville.")}
${choix("mois", "Prévoir l'argent pour", [
  ["1", "1 mois"],
  ["3", "3 mois"],
  ["6", "6 mois"],
])}
</div>
<div class="card" id="bres" aria-live="polite">${resultatBudget(B)}</div>
<div class="card"><h2>Chaque mois</h2>
${champ("elec", "Électricité", "80", "Demande au propriétaire le montant des factures d'Hydro-Québec de l'an dernier, ou si le chauffage est inclus.")}
${champ("epicerie", "Épicerie", "366", `Estimation : ${lienExt(EPICERIE.u, EPICERIE.s)} = 366 $ par personne.`)}
${champ("transport", "Transport", t ? String(t.p) : "0", t ? `Un laissez-passer par adulte : ${lienExt(t.u, t.s)}. Mets ton coût d'auto si tu conduis.` : "Mets ton laissez-passer ou ton coût d'auto.")}
${champ("internet", "Internet et cellulaire", "90", "Selon tes forfaits.")}
${+B.garderie ? champ("garde", "Garde d'enfants", "0", `Par défaut : ${lienExt(GARDE.u, GARDE.s)}, × ${GARDE.jours} jours par mois. En garderie non subventionnée, mets ton tarif.`) : ""}
${champ("assurance", "Assurance locataire", "31", `Par défaut : ${lienExt(ASSURANCE.u, ASSURANCE.s)}.`)}
${champ("abonnements", "Abonnements (télé, musique, gym…)", "0")}
</div>
<div class="card"><h2>Une seule fois</h2>
${champ("demenagement", "Déménagement", "500", "Camion, déménageurs, billets ou essence.")}
${champ("meubles", "Meubles et articles de base", "800", "Lit, électroménagers s'ils ne sont pas fournis, vaisselle, vêtements d'hiver.")}
</div>
<button class="btn ghost" data-go="verifier" id="nouv">Vérifier une annonce que j'ai trouvée</button>`;
}

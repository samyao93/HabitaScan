/* Repère du coût mensuel réel : loyer médian du marché (LMM) 2026 de la Société d'habitation du Québec,
   ajusté et services compris. Il se compare au loyer + dépenses, jamais au loyer seul d'une annonce. */
import LMM from "./lmm-shq.json";

/* { lmm, region, periode, source, note, ecart, texte } ou null. total : coût mensuel connu ; minimum : des dépenses
   manquent encore (le total est un minimum, donc on ne dit jamais « sous le repère »). */
export function repereLmm(ville, ch, total, minimum, lmm = LMM) {
  const v = lmm.villes && lmm.villes[ville];
  const n = Math.min(Math.max(+ch || 1, 1), 3);
  const val = v && v.loyers[n - 1];
  if (!val || !(total > 0)) return null;
  const p = Math.round(((total - val) / val) * 100);
  let texte;
  if (minimum && p < 3)
    texte = "Des dépenses ne sont pas encore connues : compare de nouveau quand tu auras leur montant.";
  else if (Math.abs(p) < 3) texte = "Ton coût est au même niveau que ce repère.";
  else if (p > 0) texte = `Ton coût est ${minimum ? "déjà au moins " : ""}${p} % au-dessus de ce repère.`;
  else texte = `Ton coût est ${-p} % sous ce repère.`;
  return {
    lmm: val,
    region: v.region,
    periode: lmm.periode,
    source: lmm.source,
    note: lmm.note,
    ecart: p,
    texte,
    ch: n,
  };
}

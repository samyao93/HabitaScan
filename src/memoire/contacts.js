/* Mémoire collective : numéros et courriels de l'annonceur, règle de paiement. */

/* Une fois par ouverture de l'app, seulement si la personne l'a activé */
export const REGLE_PAIEMENT =
  "Paie seulement par chèque ou virement au nom du propriétaire inscrit au Registre foncier. Jamais en argent comptant, par carte-cadeau, cryptomonnaie, ni à une autre personne.";

export const RE_TEL = /(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})\b/g,
  RE_COURRIEL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

export function extraireContacts(...textes) {
  const t = textes.filter(Boolean).join("\n"),
    tels = new Set(),
    cour = new Set();
  for (const m of t.matchAll(RE_TEL)) tels.add(m[1] + m[2] + m[3]);
  for (const m of t.matchAll(RE_COURRIEL)) cour.add(m[0].toLowerCase());
  return { tels: [...tels].slice(0, 5), courriels: [...cour].slice(0, 5) };
}

export function fusionContacts(a, b) {
  a = a || {};
  b = b || {};
  const tels = [...(a.tels || []), ...(b.tels || []).map((x) => String(x).replace(/\D/g, "").slice(-10))].filter((x) =>
    /^\d{10}$/.test(x),
  );
  const cour = [...(a.courriels || []), ...(b.courriels || []).map((x) => String(x).trim().toLowerCase())].filter((x) =>
    /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x),
  );
  return { tels: [...new Set(tels)].slice(0, 5), courriels: [...new Set(cour)].slice(0, 5) };
}

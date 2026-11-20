/* Vérif-Réno : liaisons du formulaire et du résultat. */
import { chargerProfil } from "../compte/session.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { go } from "../navigation/routeur.js";
import { analyserReno, validerReno } from "./regles.js";
import { $, app, err } from "../utils/dom.js";
import { chiffres } from "../utils/texte.js";

/* Liaisons communes du formulaire. */
function lierReno(F) {
  app.querySelectorAll("[data-trav]").forEach(
    (b) =>
      (b.onclick = () => {
        F.travaux = b.dataset.trav;
        app.querySelectorAll("[data-trav]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      }),
  );
  app.querySelectorAll("[data-yn=domicile]").forEach((b) =>
    b.addEventListener("click", () => {
      $("#q-recu").hidden = F.domicile !== "oui";
    }),
  );
}

export function lireReno(F) {
  ["licence", "nom", "recu"].forEach((k) => {
    const el = $("#" + k);
    if (el) F[k] = el.value;
  });
}

function lierResultatReno(F) {
  const o = $("#opc");
  if (o && F.nom)
    o.addEventListener("click", () => {
      try {
        navigator.clipboard.writeText(F.nom);
      } catch (e) {}
    });
}

/* Écran « reno » */
export function lierEcranReno(v) {
  lierReno(etat.fiche);
  $("#f-reno").onsubmit = async (e) => {
    e.preventDefault();
    lireReno(etat.fiche);
    err("");
    const m = validerReno(etat.fiche);
    if (m) return err(m);
    const lic = chiffres(etat.fiche.licence);
    etat.fiche.titre = "Vérification";
    etat.fiche.msg = "Analyse de la soumission…";
    go("analyse");
    let R; /* undefined = registre pas encore importé : l'app renvoie au registre officiel */
    if (lic && etat.registrePret) {
      const { data, error } = await sb
        .from("licences_rbq")
        .select("numero,nom,autres_noms,sous_categories,mandataire")
        .eq("numero", lic)
        .maybeSingle();
      if (!error) R = data || null;
    }
    etat.fiche.res = analyserReno(etat.fiche, R);
    const brut = etat.fiche.res.items.map((i) => ({
      c: i.c,
      t: String(i.t).slice(0, 1500),
      law: String(i.law || "").slice(0, 800),
    }));
    const ins = !etat.session
      ? Promise.resolve()
      : sb.from("verifications").insert({
          module: "reno",
          travaux: etat.fiche.travaux,
          licence: lic || null,
          couleur: etat.fiche.res.c,
          raisons: brut,
        });
    await Promise.all([ins, new Promise((r) => setTimeout(r, 700))]);
    await chargerProfil();
    go("renoResultat");
  };
}

/* Écran « renoResultat » */
export function lierEcranRenoResultat(v) {
  lierResultatReno(etat.fiche);
  $("#nouv").onclick = () => {
    etat.fiche = {};
    go("reno");
  };
}

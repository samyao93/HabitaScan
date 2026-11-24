/* Trouver un logement : liaisons de l'écran. */
import { nouveauF } from "../etat.js";
import { MES } from "../mesure/mesure.js";
import { go } from "../navigation/routeur.js";
import { carteResultat, liensSites } from "./ecrans.js";
import { ANN, trierResultats } from "./regles.js";
import { $, err, esc } from "../utils/dom.js";
import { m0, nombre } from "../utils/texte.js";

export function lierTrouver(F) {
  const f = F.filtre;
  const afficher = () => {
    const el = $("#liste");
    if (!el) return;
    const R = F.resultats || [];
    el.innerHTML =
      (F.noteRecherche ? `<p class="demo">${F.noteRecherche}</p>` : "") +
      (R.length
        ? `<p class="hint">${R.length} annonce${R.length > 1 ? "s" : ""} trouvée${R.length > 1 ? "s" : ""}. Le tri lit seulement le titre et l'extrait : ouvre l'annonce, puis touche « Vérifier ».</p>` +
          R.map(carteResultat).join("")
        : `<div class="card"><p>Aucune annonce trouvée pour ces critères.</p><p class="hint">Augmente le budget ou change le nombre de chambres, ou cherche directement sur les sites ci-dessous.</p></div>`);
    el.querySelectorAll("[data-verif]").forEach(
      (b) =>
        (b.onclick = () => {
          const r = R[+b.dataset.verif];
          nouveauF({
            lien: r.url,
            ville: f.ville,
            ch: String(r.ch ?? (f.ch || "2")),
            prix: r.prix ? String(r.prix) : "",
            annonce: `${r.titre || ""}\n${r.extrait || ""}`,
            lu: `<b>Repris de la recherche :</b> ${esc(r.source.n)}${r.prix ? `, ${m0(r.prix)}` : ""}. Ajoute des captures de l'annonce complète et de la conversation pour une vérification complète.`,
          });
          go("verifier");
        }),
    );
    $("#sites").innerHTML = liensSites(f);
  };
  const chercher = async () => {
    f.ville = $("#t-ville").value;
    f.ch = $("#t-ch").value;
    f.max = nombre($("#t-max").value) || "";
    if (!f.max) return err("Entre ton budget maximum.");
    err("");
    try {
      MES.noter("recherche_lancee");
    } catch (e) {}
    const b = $("#go");
    b.disabled = true;
    b.textContent = "Recherche…";
    $("#liste").innerHTML = `<p class="hint">Recherche des annonces récentes…</p>`;
    try {
      const brut = await ANN.chercher(f);
      F.resultats = trierResultats(brut, f);
      F.noteRecherche = ANN.note || "";
    } catch (x) {
      F.resultats = [];
      F.noteRecherche =
        x && x.message === "quota"
          ? "Tu as atteint la limite de recherches pour aujourd'hui. Réessaie demain, ou cherche directement sur les sites ci-dessous."
          : "La recherche n'a pas fonctionné. Réessaie, ou cherche directement sur les sites ci-dessous.";
    }
    if (!$("#f-tr")) return;
    b.disabled = false;
    b.textContent = "Chercher";
    afficher();
  };
  $("#f-tr").onsubmit = (e) => {
    e.preventDefault();
    chercher();
  };
  /* Les liens suivent les critères dès qu'un champ change. */
  const majLiens = () => {
    f.ville = $("#t-ville").value;
    f.ch = $("#t-ch").value;
    f.max = nombre($("#t-max").value) || "";
    const s = $("#sites");
    if (s) s.innerHTML = liensSites(f);
  };
  ["t-ville", "t-ch", "t-max"].forEach((i) => {
    const el = $("#" + i);
    if (el) {
      el.addEventListener("input", majLiens);
      el.addEventListener("change", majLiens);
    }
  });
  if (F.resultats) afficher();
  else if (f.max) chercher();
  else $("#sites").innerHTML = liensSites(f);
}

/* Vérifier le propriétaire : liaisons de l'écran. */
import { lireCapture } from "../annonce/lecture.js";
import { MES } from "../mesure/mesure.js";
import { go } from "../navigation/routeur.js";
import { INFO, comparerProprio } from "./regles.js";
import { $, app } from "../utils/dom.js";

export function lierProprio(F) {
  const P = F.P;
  const garder = () => {
    P.adr = $("#padr").value;
    P.nomReg = $("#preg").value.trim();
    P.nomBail = $("#pbail").value.trim();
  };
  const recomparer = () => {
    if (P.texte && P.nomReg) P.cmp = comparerProprio(P.texte, P.nomReg, P.adr);
  };
  ["#padr", "#preg", "#pbail"].forEach(
    (s) =>
      ($(s).onchange = () => {
        const avant = P.adr;
        garder();
        if (P.adr !== avant) P.geo = null;
        recomparer();
        go("proprio");
      }),
  );
  $("#b-lot").onclick = async () => {
    garder();
    if (P.adr.trim().length < 6 || !/\d/.test(P.adr)) {
      P.geo = { trouve: false, erreur: "Entre l'adresse complète, avec le numéro et la ville." };
      return go("proprio");
    }
    P.chercheLot = true;
    go("proprio");
    try {
      MES.noter("lot_cherche");
    } catch (e) {}
    try {
      P.geo = await INFO.adresse(P.adr.trim());
    } catch (e) {
      P.geo = { trouve: false, erreur: "La recherche automatique n'a pas fonctionné ici." };
    }
    P.chercheLot = false;
    if ($("#f-pro")) go("proprio");
  };
  const inp = app.querySelector("input[data-taxe]");
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    garder();
    const r = new FileReader();
    r.onload = () => {
      P.photo = r.result;
      P.cmp = null;
      P.lecture = "Lecture du document…";
      go("proprio");
      lireCapture(P.photo)
        .then((t) => {
          P.texte = t;
          recomparer();
          P.lecture = null;
        })
        .catch(() => {
          P.lecture = "La lecture automatique n'a pas fonctionné ici. Écris le nom toi-même ci-dessus.";
        })
        .finally(() => {
          if ($("#f-sig")) go("proprio");
        });
    };
    r.readAsDataURL(f);
  };
}

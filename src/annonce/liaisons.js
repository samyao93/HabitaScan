/* Liaisons des écrans « Vérifier une annonce » et « Résultat ». */
import { partagerCarte } from "./carte-verdict.js";
import { appliquerLecture, extraireAnnonce, lireCapture, rechercheImages } from "./lecture.js";
import { normaliser } from "./regles.js";
import { analyser } from "./verdict.js";
import { badgeDeLAnnonce } from "../badge/api.js";
import { chargerProfil } from "../compte/session.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { iaActif } from "../ia/analyse.js";
import { lancerIA } from "../ia/liaisons.js";
import { extraireContacts, fusionContacts } from "../memoire/contacts.js";
import { chercherCopies } from "../memoire/copies-web.js";
import { empreinteTexte, empreintesCaptures, empreintesPhotos } from "../memoire/empreintes.js";
import { memoire, retrouverAnnonce } from "../memoire/memoire.js";
import { go } from "../navigation/routeur.js";
import { $, err, keep } from "../utils/dom.js";

/* Écran « verifier » */
export function lierFormulaireVerifier(v) {
  $("#lire").onclick = () => {
    keep();
    etat.fiche.coller = true;
    if (iaActif() && !etat.fiche.iaOff) {
      go("verifier");
      return lancerIA(true);
    }
    appliquerLecture(extraireAnnonce(etat.fiche.annonce, Object.keys(etat.loyers)));
    go("verifier");
  };
  if (etat.fiche.partage) {
    etat.fiche.partage = false;
    appliquerLecture(extraireAnnonce(etat.fiche.annonce, Object.keys(etat.loyers)));
    return go("verifier");
  }
  if (etat.fiche.ocr && iaActif() && !etat.fiche.iaOff) {
    etat.fiche.ocr = false;
    lancerIA(false);
  }
  if (etat.fiche.ocr) {
    etat.fiche.ocr = false;
    etat.fiche.lu = null;
    const n = (etat.fiche.captures || []).length;
    $("#f-ver").insertAdjacentHTML(
      "afterbegin",
      `<p class="lu" role="status">Lecture de ${n > 1 ? n + " captures" : "la capture"}…</p>`,
    );
    (async () => {
      let tout = "";
      for (const c of etat.fiche.captures || []) tout += "\n" + (await lireCapture(c));
      return tout;
    })()
      .then((txt) => {
        const ici = $("#f-ver");
        if (ici) keep();
        etat.fiche.ocrTxt = txt.trim();
        appliquerLecture(extraireAnnonce(etat.fiche.ocrTxt, Object.keys(etat.loyers)));
        if (ici) go("verifier");
      })
      .catch(() => {
        etat.fiche.lu = "La lecture des captures n'a pas fonctionné ici. Remplis les champs, ou colle le texte.";
        etat.fiche.coller = true;
        if ($("#f-ver")) go("verifier");
      });
  }
}

/* Écran « verifier » */
export function lierCapturesVerifier(v) {
  $("#ch").value = etat.fiche.ch || "2";
  $("#f-ver").onsubmit = async (e) => {
    e.preventDefault();
    keep();
    err("");
    etat.fiche.prixN = parseInt(String(etat.fiche.prix).replace(/\D/g, ""), 10);
    if (!etat.fiche.prixN || etat.fiche.prixN < 100) return err("Entre le loyer demandé.");
    if (!etat.fiche.argent || !etat.fiche.visite || !etat.fiche.cession) return err("Réponds aux trois questions.");
    if (etat.fiche.cession === "oui" && !etat.fiche.accord)
      return err("Dis-nous si le propriétaire a accepté par écrit.");
    etat.fiche.lienN = normaliser(etat.fiche.lien);
    if (etat.fiche.lien && etat.fiche.lien.trim() && !etat.fiche.lienN)
      return err("Ce lien n'est pas valide. Colle l'adresse complète de l'annonce, ou laisse le champ vide.");
    etat.fiche.titre = "Vérification";
    etat.fiche.msg = "Analyse de l'annonce…";
    go("analyse");
    etat.fiche.stats = null;
    etat.fiche.nbSig = 0;
    etat.fiche.images = null;
    if (etat.fiche.lienN && etat.session) {
      const [a, b] = await Promise.all([
        sb.rpc("stats_lien", { p_lien: etat.fiche.lienN }),
        sb.rpc("nb_signalements", { p_lien: etat.fiche.lienN }),
      ]);
      etat.fiche.stats = a.data && a.data[0];
      etat.fiche.nbSig = +b.data || 0;
    }

    etat.fiche.contacts = fusionContacts(
      extraireContacts(etat.fiche.contact, etat.fiche.annonce, etat.fiche.ocrTxt, etat.fiche.txt),
      {
        tels: (etat.fiche.ia || {}).telephones,
        courriels: (etat.fiche.ia || {}).courriels,
      },
    );
    etat.fiche.photos = [
      ...new Set([
        ...(await empreintesPhotos(etat.fiche.photosLog, true)),
        ...(await empreintesCaptures(etat.fiche.captures)),
      ]),
    ].slice(0, 12);
    etat.fiche.texteEmp = empreinteTexte(
      etat.fiche.annonce && etat.fiche.annonce.length > 80
        ? etat.fiche.annonce
        : etat.fiche.ocrTxt || etat.fiche.annonce,
    );
    const img = (etat.fiche.photosLog || [])[0] || etat.fiche.zonePhoto || etat.fiche.capture;
    [etat.fiche.mem, etat.fiche.copie, etat.fiche.images, etat.fiche.copiesWeb] = await Promise.all([
      memoire(etat.fiche.contacts, etat.fiche.photos),
      retrouverAnnonce(),
      img ? rechercheImages(img) : null,
      chercherCopies(),
    ]);
    etat.fiche.badge = await badgeDeLAnnonce(etat.fiche);
    etat.fiche.res = analyser();
    const brut = etat.fiche.res.items.map((i) => ({
      c: i.c,
      t: String(i.t).slice(0, 1500),
      law: String(i.law || "").slice(0, 800),
    }));
    const base = {
      ville: etat.fiche.ville,
      chambres: +etat.fiche.ch,
      prix: etat.fiche.prixN,
      couleur: etat.fiche.res.c,
      raisons: brut,
      lien: etat.fiche.lienN,
    };
    const ins = !etat.session
      ? Promise.resolve()
      : sb
          .from("verifications")
          .insert({
            ...base,
            photos: etat.fiche.photos.length ? etat.fiche.photos : null,
            texte_empreinte: etat.fiche.texteEmp || null,
          })
          .then((r) => (r && r.error ? sb.from("verifications").insert(base) : r));
    await Promise.all([ins, new Promise((r) => setTimeout(r, 900))]);
    await chargerProfil();
    go("resultat");
  };
}

/* Écran « resultat » */
export function lierResultat(v) {
  $("#nouv").onclick = () => {
    etat.fiche = {};
    go("verifier");
  };
  const bc = $("#b-carte");
  if (bc)
    bc.onclick = async () => {
      bc.disabled = true;
      try {
        const r = await partagerCarte(etat.fiche);
        if (r === "telecharge") $("#carte-info").textContent = "Image enregistrée dans tes téléchargements.";
      } catch (e) {
        $("#carte-info").textContent = "L'image n'a pas pu être créée sur cet appareil.";
      }
      bc.disabled = false;
    };
}

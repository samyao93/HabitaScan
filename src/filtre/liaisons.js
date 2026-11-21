/* Message-filtre : liaisons. */
import { etat } from "../etat.js";
import { TEXTES_FILTRE, analyserReponse, fusionFiltre } from "./regles.js";
import { analyserFil, appliquerFil, decouperConversation, messagesIA } from "./conversation.js";
import { CLE_IA, IA_ADAPT, iaActif } from "../ia/analyse.js";
import { extraireContacts, fusionContacts } from "../memoire/contacts.js";
import { itemsMemoire, memoire } from "../memoire/memoire.js";
import { MES } from "../mesure/mesure.js";
import { go } from "../navigation/routeur.js";
import { $, app } from "../utils/dom.js";
import { reduireImage } from "../utils/images.js";

export const MAX_CAPTURES_CONVERSATION = 8;

export function lierMessageFiltre(v) {
  if (v !== "resultat" || !$("#f-msg")) return;
  app.querySelectorAll("[data-flang]").forEach(
    (b) =>
      (b.onclick = () => {
        etat.fiche.flang = b.dataset.flang;
        etat.fiche.frepTxt = $("#f-rep").value;
        go("resultat");
        setTimeout(() => {
          const e = $("#f-msg");
          if (e) e.scrollIntoView({ block: "center" });
        }, 0);
      }),
  );
  const msg = () => $("#f-msg").textContent;
  $("#f-copier").onclick = async () => {
    const b = $("#f-copier");
    try {
      await navigator.clipboard.writeText(msg());
      b.textContent = "Copié ✓";
    } catch (e) {
      const r = document.createRange();
      r.selectNodeContents($("#f-msg"));
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      b.textContent = "Sélectionné : copie-le";
    }
    setTimeout(() => {
      if (b.isConnected) b.textContent = "Copier le message";
    }, 2500);
  };
  const p = $("#f-partager");
  if (p) p.onclick = () => navigator.share({ text: msg() }).catch(() => {});
  const fc = $("#f-caps");
  if (fc)
    fc.onchange = () => {
      etat.fiche.frepTxt = $("#f-rep").value;
      /* Dans l'ordre de la discussion : les captures sont nommées et datées au moment où on les prend. */
      etat.fiche.fcaps = [...fc.files]
        .sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name))
        .slice(0, MAX_CAPTURES_CONVERSATION);
      go("resultat");
      setTimeout(() => {
        const e = $("#f-msg");
        if (e) e.scrollIntoView({ block: "center" });
      }, 0);
    };
  const fia = $("#f-ia");
  if (fia)
    fia.onchange = () => {
      try {
        localStorage.setItem(CLE_IA, fia.checked ? "1" : "0");
      } catch (e) {}
    };
  $("#f-lire").onclick = async () => {
    const t = $("#f-rep").value.trim(),
      caps = etat.fiche.fcaps || [];
    if (t.length < 3 && !caps.length) {
      $("#f-rep").focus();
      return;
    }
    etat.fiche.frepTxt = t;
    /* Conversation entière collée : seuls les messages de l'annonceur comptent pour le verdict. */
    let msgs = decouperConversation(t);
    const ann = msgs.filter((m) => m.auteur === "annonceur");
    let A = analyserReponse(ann.length && ann.length < msgs.length ? ann.map((m) => m.texte).join("\n") : t);
    const b = $("#f-lire");
    if (iaActif()) {
      b.disabled = true;
      b.textContent = caps.length > 1 ? `Lecture de ${caps.length} captures…` : "Analyse de la conversation…";
      try {
        const images = [];
        for (const c of caps) images.push(await reduireImage(c));
        const r = await IA_ADAPT.analyser({ images, texte: t, mode: "conversation" });
        A = fusionFiltre(A, r);
        if (messagesIA(r.messages).length) msgs = messagesIA(r.messages);
        etat.fiche.contacts = fusionContacts(etat.fiche.contacts, { tels: r.telephones, courriels: r.courriels });
        try {
          MES.noter("ia_conversation");
        } catch (e) {}
      } catch (x) {
        A.s +=
          x && x.message === "quota"
            ? " (Limite d'analyses IA atteinte pour aujourd'hui : analyse simple utilisée.)"
            : " (L'analyse intelligente n'a pas fonctionné : analyse simple utilisée.)";
      }
    }
    /* Mémoire collective : les numéros et courriels donnés dans la conversation. */
    const cc = extraireContacts(t);
    etat.fiche.contacts = fusionContacts(etat.fiche.contacts, cc);
    const m = await memoire(
      cc.tels.length || cc.courriels.length ? etat.fiche.contacts : { tels: [], courriels: [] },
      [],
    );
    itemsMemoire(m).forEach((x) => A.signaux.unshift({ c: x.c, m: x.t }));
    /* Suivi message par message : pression qui monte, autre messagerie, pièce d'identité. */
    A = appliquerFil(A, analyserFil(msgs), TEXTES_FILTRE);
    if (A.signaux.some((z) => z.c === "r") && A.c !== "r") {
      A.c = "r";
      A.t = TEXTES_FILTRE.r[0];
      A.s = TEXTES_FILTRE.r[1];
    }
    etat.fiche.frep = A;
    try {
      MES.noter("filtre_analyse");
    } catch (e) {}
    go("resultat");
    setTimeout(() => {
      const e = $("#f-res");
      if (e) e.scrollIntoView({ block: "center" });
    }, 0);
  };
}

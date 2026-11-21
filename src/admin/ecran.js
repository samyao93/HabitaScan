/* Espace admin dans l'app : écran et liaisons. */
import { ADM } from "./api.js";
import { PARAMS, nb } from "./parametres.js";
import { etat } from "../etat.js";
import { ALERTES_ID } from "../identite/identite.js";
import { go } from "../navigation/routeur.js";
import { $, app, esc, top } from "../utils/dom.js";
import { urlWeb } from "../utils/liens.js";
import { m0 } from "../utils/texte.js";

export function vueAdmin() {
  const onglet = etat.fiche.onglet || "chiffres";
  const o = (k, t) => `<button type="button" data-onglet="${k}" aria-pressed="${onglet === k}">${t}</button>`;
  return `${top("compte", "Admin")}
<h2>Espace admin</h2>${ADM.demo ? `<p class="demo">Démo : données fictives, rien n'est envoyé.</p>` : ""}
${ADM.console ? `<a class="btn" href="${ADM.console}" target="_blank" rel="noopener">Ouvrir la console complète (ordinateur) ↗</a><p class="hint">Utilisateurs, réglages, quotas, loyers, administrateurs, journal : tout se gère dans la console.</p>` : ""}
<div class="seg seg6" role="group" aria-label="Section">${o("chiffres", "Chiffres")}${o("demandes", "Demandes")}${o("connexions", "Connexions")}${o("identites", "Identités")}${o("signalements", "Signalements")}${o("badges", "Badges")}${o("montants", "Montants")}</div>
<div id="adm" aria-live="polite"><p class="hint">Chargement…</p></div>`;
}

export async function lierAdmin() {
  const onglet = etat.fiche.onglet || "chiffres";
  app.querySelectorAll("[data-onglet]").forEach(
    (b) =>
      (b.onclick = () => {
        etat.fiche.onglet = b.dataset.onglet;
        go("admin");
      }),
  );
  const el = () => $("#adm");
  const echec = () => {
    if (el()) el().innerHTML = `<p class="err">Chargement impossible. Vérifie que ton compte est admin.</p>`;
  };
  try {
    if (onglet === "chiffres") {
      const s = await ADM.stats();
      if (!el()) return;
      const tuile = (t, v, fort) =>
        `<div class="tuile${fort ? " fort" : ""}"><span>${t}</span><b class="num">${nb(v)}</b></div>`;
      el().innerHTML = `<div class="tuiles">${tuile("Utilisateurs", s.utilisateurs, true)}${tuile("Nouveaux, 7 jours", s.nouveaux_7j)}${tuile("Vérifications, 7 jours", s.verifications_7j)}
${tuile("Vérifications au total", s.verifications)}${tuile("Résultats « Ne paie pas »", s.rouges)}${tuile("Signalements", s.signalements)}${tuile("Identités à vérifier", s.identites_attente)}</div>`;
    }
    if (onglet === "identites") {
      const L = await ADM.identites();
      if (!el()) return;
      el().innerHTML = L.length
        ? L.map(
            (
              p,
            ) => `<div class="card" data-id="${esc(p.id)}"><p><b>${esc(p.contact || "(sans contact)")}</b></p><p class="hint">Envoyée le ${esc(String(p.soumise_le || "").slice(0, 10))}${p.doc_type ? ` · ${esc(p.doc_type)}` : ""}</p>
${p.prenom_declare || p.nom_declare ? `<p><b>Nom déclaré :</b> ${esc([p.prenom_declare, p.nom_declare].filter(Boolean).join(" "))}</p>` : ""}
${
  p.lue_le
    ? `<p><b>Lu par l'IA :</b> ${esc([p.prenom, p.nom].filter(Boolean).join(" ") || "nom non lu")}${p.naissance_annee ? ` · né(e) en ${esc(p.naissance_annee)}` : ""} · expire ${p.expire_le ? esc(p.expire_le) : "(non lue)"}${p.emetteur ? ` · ${esc(p.emetteur)}` : ""}</p>
${(p.alertes || []).length ? `<ul class="reasons">${p.alertes.map((a) => `<li><span class="dot r"></span><div>${esc(ALERTES_ID[a] || a)}</div></li>`).join("")}</ul>` : `<p class="hint">Aucune alerte automatique.</p>`}`
    : `<p class="hint">Pas de lecture automatique : vérification manuelle.</p>`
}
<div class="vignettes photos"><button type="button" class="btn ghost" data-voir="${esc(p.id)}">Voir les photos</button></div>
<div class="grid2"><button class="btn" data-decider="${esc(p.id)}" data-statut="confirmee">Confirmer</button><button class="btn ghost" data-decider="${esc(p.id)}" data-statut="refusee">Refuser</button></div>
<p class="hint">La décision supprime les photos.</p></div>`,
          ).join("")
        : `<div class="card"><p>Aucune pièce d'identité à vérifier.</p></div>`;
      el()
        .querySelectorAll("[data-voir]")
        .forEach(
          (b) =>
            (b.onclick = async () => {
              b.disabled = true;
              try {
                const urls = await ADM.photos(b.dataset.voir);
                b.parentNode.innerHTML = urls.length
                  ? urls
                      .filter(urlWeb)
                      .map(
                        (u) =>
                          `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Pièce d'identité"></a>`,
                      )
                      .join("")
                  : `<p class="hint">Aucune photo trouvée.</p>`;
              } catch (x) {
                b.disabled = false;
                b.textContent = "Réessayer";
              }
            }),
        );
      el()
        .querySelectorAll("[data-decider]")
        .forEach(
          (b) =>
            (b.onclick = async () => {
              b.disabled = true;
              try {
                await ADM.decider(b.dataset.decider, b.dataset.statut);
                go("admin");
              } catch (x) {
                b.disabled = false;
                b.textContent = "Réessayer";
              }
            }),
        );
    }
    if (onglet === "signalements") {
      const L = await ADM.signalements();
      if (!el()) return;
      el().innerHTML = L.length
        ? L.map(
            (s) => `<div class="card"><p><a href="${esc(s.lien)}" target="_blank" rel="noopener">${esc(s.lien)}</a></p>
<p><b>${nb(s.nb)} signalement${s.nb > 1 ? "s" : ""}</b>${s.dernier ? ` · dernier le ${esc(String(s.dernier).slice(0, 10))}` : ""}</p><p class="hint">${esc((s.motifs || []).join(", "))}</p>
<button class="btn ghost" data-retirer="${esc(s.lien)}">Retirer ces signalements (annonce honnête)</button></div>`,
          ).join("")
        : `<div class="card"><p>Aucun signalement.</p></div>`;
      el()
        .querySelectorAll("[data-retirer]")
        .forEach(
          (b) =>
            (b.onclick = async () => {
              b.disabled = true;
              try {
                await ADM.retirerSignalements(b.dataset.retirer);
                go("admin");
              } catch (x) {
                b.disabled = false;
                b.textContent = "Réessayer";
              }
            }),
        );
    }
    if (onglet === "montants") {
      if (!el()) return;
      const villes = Object.keys(etat.loyers);
      el().innerHTML = `<div class="card"><h2>Budget</h2><p class="hint">Change un montant quand le tarif change (chaque année). Indique la source dans tes notes.</p>
${PARAMS.map((p) => `<label>${p.n}<span class="ligne"><input data-param="${p.cle}" inputmode="decimal" value="${String(p.get()).replace(".", ",")}"><button type="button" class="btn ghost petit" data-sauver="${p.cle}">Enregistrer</button></span></label>`).join("")}</div>
<div class="card"><h2>Loyers moyens SCHL</h2><p class="hint">À mettre à jour chaque année avec l'Enquête sur les logements locatifs.</p>
<table class="tvilles"><thead><tr><th>Ville</th><th>1 ch.</th><th>2 ch.</th><th>3 ch.+</th></tr></thead><tbody>
${villes.map((v) => `<tr><td>${esc(v)}</td>${[0, 1, 2].map((i) => `<td><input class="mini" data-loyer="${esc(v)}" data-ch="${i + 1}" inputmode="numeric" value="${etat.loyers[v][i] || ""}"></td>`).join("")}</tr>`).join("")}</tbody></table>
<p class="hint" id="adm-msg" role="status"></p></div>`;
      const msg = (t) => {
        const m = $("#adm-msg");
        if (m) m.textContent = t;
      };
      el()
        .querySelectorAll("[data-sauver]")
        .forEach(
          (b) =>
            (b.onclick = async () => {
              const k = b.dataset.sauver,
                inp = el().querySelector(`[data-param="${k}"]`),
                v = parseFloat(inp.value.replace(",", "."));
              if (!(v > 0)) return msg("Montant invalide.");
              b.disabled = true;
              try {
                await ADM.sauverParametre(k, v);
                PARAMS.find((p) => p.cle === k).set(v);
                b.textContent = "Enregistré";
              } catch (x) {
                b.textContent = "Erreur";
              }
              b.disabled = false;
            }),
        );
      el()
        .querySelectorAll("[data-loyer]")
        .forEach(
          (inp) =>
            (inp.onchange = async () => {
              const v = parseInt(inp.value.replace(/\D/g, ""), 10);
              if (!(v >= 200 && v <= 10000)) return msg("Loyer invalide.");
              try {
                await ADM.sauverLoyer(inp.dataset.loyer, +inp.dataset.ch, v);
                etat.loyers[inp.dataset.loyer][+inp.dataset.ch - 1] = v;
                msg(`${inp.dataset.loyer}, ${inp.dataset.ch} ch. : ${m0(v)} enregistré.`);
              } catch (x) {
                msg("Erreur d'enregistrement.");
              }
            }),
        );
    }
  } catch (x) {
    echec();
  }
}

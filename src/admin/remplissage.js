/* Espace admin : tableaux (demandes, mesure, connexions). */
import { ADM } from "./api.js";
import { nb } from "./parametres.js";
import { VAP } from "../approfondie/api.js";
import { STATUTS, VERDICTS, htmlRapport } from "../approfondie/rapport.js";
import { lieuTexte } from "../compte/lieu.js";
import { etat } from "../etat.js";
import { MES } from "../mesure/mesure.js";
import { fmtLot } from "../proprietaire/regles.js";
import { $, esc } from "../utils/dom.js";
import { lienExt } from "../utils/liens.js";
import { dateLongue } from "../utils/texte.js";

/* Onglet admin « Demandes » */
export async function remplirAdminDemandes(el) {
  const L = await VAP.adminListe();
  if (!el.isConnected) return;
  el.innerHTML = L.length
    ? L.map((d) => {
        const s = STATUTS[d.statut] || ["i", d.statut];
        const v = d.verdict && VERDICTS[d.verdict];
        return `<div class="card"><p><b>${esc(d.adresse)}</b> <span class="tag ${s[0]}">${s[1]}</span></p>
<p class="hint">${esc(d.contact || "")} · demandée le ${esc(
          String(d.created_at || "")
            .slice(0, 16)
            .replace("T", " "),
        )}${d.paye_le ? ` · payée le ${esc(String(d.paye_le).slice(0, 16).replace("T", " "))}` : ""}${d.montant ? ` · ${esc(String(d.montant))} $` : ""}</p>
<p>Interlocuteur : <b>${esc(d.nom_interlocuteur)}</b> (${d.role === "gestionnaire" ? "dit être gestionnaire" : d.role === "locataire" ? "propriétaire nommé par le locataire" : "dit être propriétaire"})${d.lot ? ` · lot <span class="num">${esc(fmtLot(d.lot))}</span>` : ""}</p>
${d.lien ? `<p class="hint">${lienExt(esc(d.lien), "Annonce")}</p>` : ""}
${d.statut === "terminee" && (d.rapport || d.verdict_global) ? htmlRapport(d) : v ? `<ul class="reasons"><li><span class="dot ${v[0]}"></span><div>${v[1]}${d.note ? `<div class="law">${esc(d.note)}</div>` : ""}</div></li></ul>` : ""}
${d.statut === "a_payer" ? `<button class="btn ghost" data-maj="${esc(d.id)}" data-statut="payee">Marquer payée (vu dans Stripe)</button>` : ""}
${d.statut === "payee" ? `${ADM.console ? `<a class="btn" href="${ADM.console}" target="_blank" rel="noopener">Remplir le rapport dans la console ↗</a>` : ""}<p class="hint">Le rapport complet (registre, entreprise, photos, autres annonces, verdict) se remplit dans la console, sur ordinateur.</p>` : ""}
${["payee", "terminee"].includes(d.statut) ? `<button type="button" class="lienbtn" data-maj="${esc(d.id)}" data-statut="remboursee">Marquer remboursée</button>` : ""}</div>`;
      }).join("")
    : `<div class="card"><p>Aucune demande.</p></div>`;
  el.querySelectorAll("[data-maj]").forEach(
    (b) =>
      (b.onclick = async () => {
        const id = b.dataset.maj,
          n = el.querySelector(`[data-note="${id}"]`);
        b.disabled = true;
        try {
          await VAP.adminMaj(id, b.dataset.statut, b.dataset.verdict || null, n ? n.value.trim() : "");
          remplirAdminDemandes(el);
        } catch (x) {
          b.disabled = false;
          b.textContent = "Erreur, réessaie";
        }
      }),
  );
}

/* Entonnoir dans l'onglet Chiffres de l'admin */
const ETAPES = [
  ["vue_bienvenue", "Écran d'accueil (avant connexion)"],
  ["vue_accueil", "Accueil (connecté)"],
  ["vue_verifier", "Vérification commencée"],
  ["vue_resultat", "Vérification terminée"],
  ["vue_proprio", "Vérifier le propriétaire"],
  ["vue_approfondie", "Offre payante ouverte"],
  ["demande_creee", "Demande payante créée"],
  ["vue_budget", "Budget"],
  ["vue_trouver", "Trouver un logement"],
  ["recherche_lancee", "Recherches lancées"],
  ["vue_reno", "Vérif-Réno"],
];

export async function remplirMesure() {
  let M;
  try {
    M = await MES.admin();
  } catch (e) {
    return;
  }
  const el = $("#adm");
  if (!el || !M || el.querySelector("#mesure")) return;
  const n = (o, k) => Number((o || {})[k] || 0).toLocaleString("fr-CA");
  el.insertAdjacentHTML(
    "beforeend",
    `<div class="card" id="mesure"><h2>Utilisation (anonyme)</h2>
<table class="tvilles"><thead><tr><th>Étape</th><th>7 jours</th><th>30 jours</th></tr></thead><tbody>
${ETAPES.map(([k, l]) => `<tr><td>${l}</td><td class="num">${n(M.j7, k)}</td><td class="num">${n(M.j30, k)}</td></tr>`).join("")}
<tr><td><b>Vérifications payées</b></td><td></td><td class="num"><b>${Number(M.payees30 || 0).toLocaleString("fr-CA")}</b></td></tr></tbody></table>
<p class="hint">Compte d'ouvertures d'écrans, sans lien avec les comptes. Le taux à surveiller : « Vérification terminée » ÷ « Vérification commencée ».</p></div>
<div class="card"><h2>Erreurs techniques</h2><p>${Number(M.erreurs7 || 0)} erreur${M.erreurs7 > 1 ? "s" : ""} sur 7 jours.</p>
${(M.dernieres || []).length ? `<ul class="liste">${M.dernieres.map((e) => `<li><span class="hint">${esc(String(e.cree_le).slice(0, 16).replace("T", " "))} · ${esc(e.vue || "")}</span><br>${esc(e.message)}</li>`).join("")}</ul>` : `<p class="hint">Aucune erreur.</p>`}</div>`,
  );
}

/* Onglet admin « Connexions » */
export async function remplirAdminConnexions(el) {
  const [s, res, L] = await Promise.all([ADM.partageStats(), ADM.lieuxResume(), ADM.connexions()]);
  if (!$("#adm")) return;
  const q = (etat.fiche.qcx || "").toLowerCase();
  const filtre = L.filter((x) => !q || [x.contact, x.ville, x.region, x.pays].join(" ").toLowerCase().includes(q)).sort(
    (a, b) => new Date(b.derniere) - new Date(a.derniere),
  );
  el.innerHTML = `<div class="tuiles"><div class="tuile fort"><span>Partagent leur ville</span><b class="num">${nb(s.partagent)}</b></div><div class="tuile"><span>Comptes</span><b class="num">${nb(s.total)}</b></div></div>
<p class="hint">Seules les personnes qui ont activé le partage apparaissent. Ville déduite de l'adresse IP par l'hébergeur : approximative (un réseau mobile ou un VPN peut indiquer une autre ville).</p>
<div class="card"><h2>Par ville, 30 derniers jours</h2>${res.length ? `<div class="hist">${res.map((r) => `<div><span>${esc(lieuTexte({ ville: r.ville, region: r.region, pays: "CA" }))}</span><span class="num">${nb(r.personnes)} pers.</span></div>`).join("")}</div>` : `<p class="soft">Aucune donnée.</p>`}</div>
<div class="card"><h2>Dernière connexion par personne</h2>
<label class="sr" for="qcx">Rechercher</label><input id="qcx" type="search" placeholder="Courriel ou ville" value="${esc(etat.fiche.qcx || "")}">
${filtre.length ? `<div class="cxlist">${filtre.map((x) => `<div class="cx"><p><b>${esc(x.contact || "(sans courriel)")}</b><span class="soft">${esc(dateLongue(x.derniere))}</span></p><p>${esc(lieuTexte(x))}${x.appareil ? ` · <span class="soft">${esc(x.appareil)}</span>` : ""} · <span class="soft">${nb(x.nb)} connexion${x.nb > 1 ? "s" : ""}</span></p></div>`).join("")}</div>` : `<p class="soft">Aucun résultat.</p>`}</div>`;
  const i = $("#qcx");
  if (i)
    i.oninput = () => {
      etat.fiche.qcx = i.value;
      clearTimeout(i._t);
      i._t = setTimeout(() => {
        remplirAdminConnexions(el).then(() => {
          const j = $("#qcx");
          if (j) {
            j.focus();
            j.setSelectionRange(j.value.length, j.value.length);
          }
        });
      }, 250);
    };
}

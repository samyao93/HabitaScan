/* HabitaScan : carte publique des arnaques par quartier (page /carte).
   Les chiffres viennent de la fonction carte_arnaques de Supabase, déjà agrégés et anonymisés (seuil minimal
   de personnes différentes par secteur). La position des secteurs vient de carte-secteurs.json
   (centre approximatif de chaque région de tri d'acheminement, construit par outils/importer-secteurs.mjs). */
(function () {
  var SB = "https://oyiiaqyepihkawzkkjpi.supabase.co",
    CLE = "sb_publishable_LhDVlSvpyM-bkW-QSp0lsw_wgNIsELX";
  var MOTIFS = {
    argent_avant_bail: "Argent demandé avant le bail",
    faux_proprietaire: "Faux propriétaire",
    logement_inexistant: "Logement inexistant",
    photos_volees: "Photos volées",
    autre: "Autre",
  };
  var $ = function (s) {
    return document.querySelector(s);
  };
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function nomSecteur(l) {
    return l.rta || "Autres secteurs";
  }
  function motifsTexte(l) {
    var m = Object.entries(l.motifs || {}).sort(function (a, b) {
      return b[1] - a[1];
    });
    return m.length
      ? m
          .map(function (x) {
            return (MOTIFS[x[0]] || x[0]) + " (" + x[1] + ")";
          })
          .join(", ")
      : "Motifs variés";
  }
  function etat(t) {
    $("#etat").textContent = t;
    $("#etat").hidden = !t;
  }

  var lignes = [],
    secteurs = {},
    carte = null,
    couche = null;

  function rpc() {
    return fetch(SB + "/rest/v1/rpc/carte_arnaques", {
      method: "POST",
      headers: { apikey: CLE, "Content-Type": "application/json" },
      body: "{}",
    }).then(function (r) {
      if (!r.ok) throw new Error("rpc " + r.status);
      return r.json();
    });
  }
  function parametres() {
    return fetch(SB + "/rest/v1/parametres?select=cle,valeur&cle=in.(carte_seuil_min,carte_mois)", {
      headers: { apikey: CLE },
    })
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .catch(function () {
        return [];
      });
  }
  function positions() {
    return fetch("/carte-secteurs.json")
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      });
  }

  function filtrees() {
    var v = $("#ville").value;
    return lignes.filter(function (l) {
      return !v || l.ville === v;
    });
  }

  function dessinerTableau(L) {
    $("#tableau tbody").innerHTML = L.map(function (l) {
      return (
        "<tr><td><b>" +
        esc(nomSecteur(l)) +
        "</b></td><td>" +
        esc(l.ville || "") +
        "</td><td>" +
        l.personnes +
        (l.personnes > 1 ? " personnes" : " personne") +
        "</td><td>" +
        esc(motifsTexte(l)) +
        "</td></tr>"
      );
    }).join("");
  }

  function dessinerCarte(L) {
    var places = L.filter(function (l) {
      return l.rta && secteurs[l.rta];
    });
    $("#sans-carte").hidden = places.length > 0 || !L.length;
    if (!window.L || !places.length) {
      $("#carte").hidden = true;
      return;
    }
    $("#carte").hidden = false;
    if (!carte) {
      carte = window.L.map("carte", { scrollWheelZoom: false }).setView([46.8, -71.8], 6);
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 15,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(carte);
    }
    if (couche) couche.remove();
    var max = Math.max.apply(
      null,
      places.map(function (l) {
        return l.personnes;
      }),
    );
    couche = window.L.featureGroup(
      places.map(function (l) {
        var p = secteurs[l.rta];
        return window.L.circleMarker([p[0], p[1]], {
          radius: 8 + 22 * Math.sqrt(l.personnes / max),
          color: "#c2301a",
          weight: 1.5,
          fillColor: "#c2301a",
          fillOpacity: 0.35,
        }).bindPopup(
          "<b>" +
            esc(l.rta) +
            "</b>" +
            (p[2] ? " · " + esc(p[2]) : "") +
            "<br>" +
            l.personnes +
            " personne" +
            (l.personnes > 1 ? "s" : "") +
            "<br>" +
            esc(motifsTexte(l)),
        );
      }),
    ).addTo(carte);
    carte.fitBounds(couche.getBounds(), { padding: [30, 30], maxZoom: 12 });
  }

  function dessiner() {
    var L = filtrees();
    dessinerTableau(L);
    dessinerCarte(L);
  }

  function csv() {
    var q = function (s) {
      return '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    };
    var entetes = ["secteur", "ville", "personnes"].concat(Object.keys(MOTIFS));
    var corps = filtrees().map(function (l) {
      return [q(l.rta || "autres"), q(l.ville), l.personnes]
        .concat(
          Object.keys(MOTIFS).map(function (k) {
            return (l.motifs || {})[k] || "";
          }),
        )
        .join(",");
    });
    var texte = "﻿" + entetes.join(",") + "\n" + corps.join("\n") + "\n";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texte], { type: "text/csv;charset=utf-8" }));
    a.download = "habitascan-arnaques-par-secteur-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  Promise.all([rpc(), positions(), parametres()])
    .then(function (r) {
      lignes = r[0] || [];
      secteurs = r[1] || {};
      (r[2] || []).forEach(function (p) {
        var cible = p.cle === "carte_mois" ? "[data-mois]" : "[data-seuil]";
        document.querySelectorAll(cible).forEach(function (e) {
          e.textContent = Math.max(p.cle === "carte_mois" ? 1 : 3, +p.valeur);
        });
      });
      if (!lignes.length) {
        etat(
          "Pas encore assez de signalements pour afficher un secteur sans risquer d'identifier quelqu'un. La carte se remplira au fil des signalements.",
        );
        return;
      }
      etat("");
      var villes = lignes
        .map(function (l) {
          return l.ville;
        })
        .filter(function (v, i, a) {
          return v && a.indexOf(v) === i;
        })
        .sort(function (a, b) {
          return a.localeCompare(b, "fr");
        });
      $("#ville").insertAdjacentHTML(
        "beforeend",
        villes
          .map(function (v) {
            return '<option value="' + esc(v) + '">' + esc(v) + "</option>";
          })
          .join(""),
      );
      $("#ville").onchange = dessiner;
      $("#csv").onclick = csv;
      $("#outils").hidden = false;
      $("#tableau").hidden = false;
      dessiner();
    })
    .catch(function () {
      etat("Les données ne sont pas disponibles pour le moment. Réessaie plus tard.");
    });
})();

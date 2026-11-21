/* Choix de la langue de l'app, avant son chargement : app.js (français) ou app-en.js (anglais).
   Ordre : ?lang=en ou ?lang=fr dans l'adresse (retenu), choix déjà fait sur cet appareil,
   sinon l'anglais seulement si le téléphone n'a aucune langue française. */
(function () {
  var l = null;
  try {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "fr") localStorage.setItem("hs_langue", q);
    l = localStorage.getItem("hs_langue");
  } catch (e) {}
  if (l !== "en" && l !== "fr") {
    var ls = navigator.languages || [navigator.language || ""];
    var fr = false, en = false;
    for (var i = 0; i < ls.length; i++) {
      if (/^fr/i.test(ls[i])) fr = true;
      if (/^en/i.test(ls[i])) en = true;
    }
    l = en && !fr ? "en" : "fr";
  }
  document.documentElement.lang = l === "en" ? "en-CA" : "fr-CA";
  document.documentElement.dataset.langue = l;
  var s = document.createElement("script");
  s.src = l === "en" ? "app-en.js" : "app.js";
  s.async = false;
  document.body.appendChild(s);
})();

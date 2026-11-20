/* Partage reçu dans l'app native (iPhone/Android), voir app-native/partage-natif.js. */
window.recevoirPartage = (t) => {
  if (!t) return;
  F = { annonce: String(t).slice(0, 5000), partage: true };
  const l = normaliser(t);
  if (l) F.lien = l;
  go("verifier");
};
(async () => {
  try {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  } catch (e) {}
  go("analyse");
  try {
    await Promise.all([chargerLoyers(), chargerRegistre(), chargerParametres(), chargerTextes(), chargerPages()]);
    await ouvrirSession();
    await chargerProfil();
    const vq = new URLSearchParams(location.search).get("v");
    go(
      ["confidentialite", "conditions"].includes(vq)
        ? vq
        : SESSION
          ? F.partage
            ? "verifier"
            : "accueil"
          : "bienvenue",
    );
  } catch (e) {
    app.innerHTML = `${top()}<p class="err">Impossible de joindre le serveur. Vérifie ta connexion et recharge la page.</p>`;
  }
})();

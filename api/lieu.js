// HabitaScan : renvoie la ville approximative de la personne, déduite de son adresse IP par Vercel.
// Aucune adresse IP n'est conservée ni renvoyée. L'app n'appelle cette fonction que si la personne l'a accepté.
module.exports = (req, res) => {
  const h = req.headers;
  const dec = v => { try { return v ? decodeURIComponent(String(v)) : ""; } catch (e) { return ""; } };
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).end(JSON.stringify({
    pays: dec(h["x-vercel-ip-country"]).slice(0, 2),
    region: dec(h["x-vercel-ip-country-region"]).slice(0, 3),
    ville: dec(h["x-vercel-ip-city"]).slice(0, 80)
  }));
};

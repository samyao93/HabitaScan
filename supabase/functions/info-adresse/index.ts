// Adresse → numéro de lot, avec les services publics du gouvernement du Québec (données ouvertes) :
// 1. géocodeur Adresses Québec (MRNF, licence CC-BY 4.0) ;
// 2. couche « Lots du cadastre rénové » (champ NO_LOT).
// Aucun nom de propriétaire n'est recherché : les rôles en données ouvertes caviardent les noms,
// et il est interdit de les réidentifier.
import { avantTraitement, json, quotaOk } from "../_shared/commun.ts";

const GEO = "https://servicescarto.mern.gouv.qc.ca/pes/rest/services/Territoire/AdressesQuebec_Geocodage/GeocodeServer/findAddressCandidates";
const CAD = "https://geo.environnement.gouv.qc.ca/donnees/rest/services/Reference/Cadastre_allege/MapServer/0/query";

Deno.serve(async (req) => {
  const refus = avantTraitement(req);
  if (refus) return refus;
  if (!(await quotaOk(req, "info-adresse"))) return json(req, { error: "quota" }, 429);
  let adresse = "";
  try { adresse = String((await req.json()).adresse || "").trim(); } catch { return json(req, { error: "requete" }, 400); }
  if (adresse.length < 6 || adresse.length > 200) return json(req, { error: "adresse" }, 400);
  try {
    const g = await (await fetch(`${GEO}?SingleLine=${encodeURIComponent(adresse)}&outSR=4326&maxLocations=1&f=json`, { signal: AbortSignal.timeout(8000) })).json();
    const c = g?.candidates?.[0];
    if (!c?.location || (c.score != null && c.score < 80)) return json(req, { trouve: false });
    const q = await (await fetch(`${CAD}?geometry=${c.location.x},${c.location.y}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NO_LOT&returnGeometry=false&f=json`, { signal: AbortSignal.timeout(8000) })).json();
    const lots = [...new Set((q?.features || []).map((f: { attributes?: { NO_LOT?: string } }) => String(f.attributes?.NO_LOT || "").replace(/\D/g, "")).filter(Boolean))];
    return json(req, { trouve: true, adresse: c.address || adresse, lots });
  } catch {
    return json(req, { error: "service" }, 502);
  }
});

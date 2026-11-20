/* Configuration : Supabase (clé publiable), liens officiels, seuils de prix. */

const SUPABASE_URL = "https://oyiiaqyepihkawzkkjpi.supabase.co";

const SUPABASE_KEY = "sb_publishable_LhDVlSvpyM-bkW-QSp0lsw_wgNIsELX";

export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* Seuils à valider avec les tests sur de vraies annonces. */
export const BAS = 0.75,
  HAUT = 1.4;

// L'app se charge dans un vrai navigateur (Chrome sans interface) et chaque écran s'affiche sans erreur.
// Ignoré si Chrome n'est pas installé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cheminChrome, rendreEcrans } from "../outils/ecrans.mjs";

test(
  "chaque écran de l'app s'affiche, avec et sans session",
  { skip: !cheminChrome() && "Chrome absent", timeout: 120000 },
  async () => {
    const r = await rendreEcrans();
    assert.deepEqual(r.erreursChargement, [], "erreurs au chargement de l'app");
    assert.deepEqual(r.erreursRendu, [], "erreurs JavaScript pendant le rendu");
    const ecrans = Object.keys(r.sansSession);
    assert.ok(ecrans.length >= 20, `seulement ${ecrans.length} écrans`);
    // Écrans publics : visibles sans session
    for (const v of ["bienvenue", "inscription", "code", "confidentialite", "conditions", "victime"])
      assert.ok(
        r.sansSession[v].length > 200 && !r.sansSession[v].startsWith("ERREUR"),
        `écran ${v} vide ou en erreur`,
      );
    // Avec session : tous les écrans qui n'attendent pas un résultat d'analyse
    for (const v of ecrans.filter((x) => !["resultat", "renoResultat"].includes(x)))
      assert.ok(!r.avecSession[v].startsWith("ERREUR"), `écran ${v} : ${r.avecSession[v]}`);
    // Écran privé sans session : renvoie vers l'accueil
    assert.equal(r.sansSession.accueil, r.sansSession.bienvenue);
  },
);

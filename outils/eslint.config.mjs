// Vérification automatique du code JavaScript (ESLint). Lancement : cd outils && npm run lint
// Les morceaux de src/app/ partagent un même bloc (voir assembler-app.mjs) : un nom déclaré dans un morceau
// est connu de tous les autres. La liste de ces noms est calculée ici, à partir du code lui-même.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as espree from "espree";
import globals from "globals";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_APP = join(RACINE, "src", "app");

/** Noms déclarés au premier niveau d'un morceau (const, let, function, class). */
function nomsDeclares(code) {
  const noms = [];
  const ajouter = (motif) => {
    if (!motif) return;
    if (motif.type === "Identifier") noms.push(motif.name);
    else if (motif.type === "ObjectPattern") motif.properties.forEach((p) => ajouter(p.value || p.argument));
    else if (motif.type === "ArrayPattern") motif.elements.forEach(ajouter);
    else if (motif.type === "RestElement") ajouter(motif.argument);
    else if (motif.type === "AssignmentPattern") ajouter(motif.left);
  };
  for (const n of espree.parse(code, { ecmaVersion: "latest", sourceType: "script" }).body) {
    if (n.type === "VariableDeclaration") n.declarations.forEach((d) => ajouter(d.id));
    else if ((n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") && n.id) noms.push(n.id.name);
  }
  return noms;
}

const nomsApp = Object.fromEntries(
  readdirSync(DOSSIER_APP)
    .filter((f) => f.endsWith(".js"))
    .flatMap((f) => nomsDeclares(readFileSync(join(DOSSIER_APP, f), "utf8")))
    .map((n) => [n, "writable"]),
);

// Règles recommandées d'ESLint qui repèrent de vraies erreurs (et non une question de style).
const REGLES = {
  "constructor-super": "error",
  "for-direction": "error",
  "getter-return": "error",
  "no-async-promise-executor": "error",
  "no-class-assign": "error",
  "no-compare-neg-zero": "error",
  "no-cond-assign": "error",
  "no-const-assign": "error",
  "no-constant-binary-expression": "error",
  "no-constant-condition": ["error", { checkLoops: false }],
  "no-control-regex": "off",
  "no-debugger": "error",
  "no-dupe-args": "error",
  "no-dupe-class-members": "error",
  "no-dupe-else-if": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-empty-character-class": "error",
  "no-empty-pattern": "error",
  "no-ex-assign": "error",
  "no-fallthrough": "error",
  "no-func-assign": "error",
  "no-import-assign": "error",
  "no-invalid-regexp": "error",
  "no-irregular-whitespace": ["error", { skipStrings: true, skipTemplates: true, skipRegExps: true }],
  "no-loss-of-precision": "error",
  "no-misleading-character-class": "error",
  "no-new-native-nonconstructor": "error",
  "no-obj-calls": "error",
  "no-prototype-builtins": "off",
  "no-redeclare": "error",
  "no-self-assign": "error",
  "no-self-compare": "error",
  "no-setter-return": "error",
  "no-shadow-restricted-names": "error",
  "no-sparse-arrays": "error",
  "no-this-before-super": "error",
  "no-undef": "error",
  "no-unexpected-multiline": "error",
  "no-unreachable": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "no-unsafe-optional-chaining": "error",
  "no-unused-labels": "error",
  "no-unused-private-class-members": "error",
  "no-useless-backreference": "error",
  "no-with": "error",
  "require-yield": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  "no-unused-vars": ["error", { vars: "local", args: "none", caughtErrors: "none" }],
};

export default [
  { ignores: ["**/node_modules/**", "app-native/**", "supabase/**", "app.js"] },
  {
    // Code de l'app (navigateur), assemblé dans un bloc
    files: ["src/app/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...nomsApp,
        supabase: "readonly",
        hsMarkdown: "readonly",
        // Chargés à part : theme.js (hsTheme), la lecture de texte sur les captures (Tesseract), l'app native (Capacitor)
        hsTheme: "readonly",
        Tesseract: "readonly",
        Capacitor: "readonly",
      },
    },
    // Un nom déclaré dans un morceau et utilisé seulement dans un autre n'est pas « inutilisé ».
    rules: { ...REGLES, "no-redeclare": ["error", { builtinGlobals: false }] },
  },
  {
    files: ["md.js", "theme.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser, Capacitor: "readonly" },
    },
    rules: REGLES,
  },
  {
    files: ["sw.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "script", globals: globals.serviceworker },
    rules: REGLES,
  },
  {
    files: ["outils/*.mjs", "tests/*.mjs", "app-native/*.mjs", "preparer-licences.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
    rules: REGLES,
  },
  {
    files: ["api/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "commonjs", globals: globals.node },
    rules: REGLES,
  },
];

// md.js affiche les pages légales modifiées dans la console : le texte doit être rendu sans permettre d'injecter du code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const contexte = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL("../md.js", import.meta.url), "utf8"), contexte);
const md = (s, o) => contexte.window.hsMarkdown(s, o);

test("titres, listes, gras, liens et tableaux", () => {
  const h = md(
    "# Titre\n\n## Section\n\n- un\n- **deux**\n\n[site](https://exemple.ca)\n\n| A | B |\n|---|---|\n| 1 | 2 |",
  );
  assert.match(h, /<h1>Titre<\/h1>/);
  assert.match(h, /<h2>Section<\/h2>/);
  assert.match(h, /<li><strong>deux<\/strong><\/li>|<li><b>deux<\/b><\/li>/);
  assert.match(h, /<a href="https:\/\/exemple\.ca"/);
  assert.match(h, /<table/);
});

test("sections en cartes", () => {
  const h = md("# Page\n\n## Un\n\ntexte\n\n## Deux\n\ntexte", { sections: true });
  assert.equal((h.match(/<div class="card">/g) || []).length, 2);
});

test("le HTML écrit dans le texte est affiché comme du texte", () => {
  const h = md('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
  assert.ok(!/<script/i.test(h), h);
  assert.ok(!/<img/i.test(h), h);
  assert.match(h, /&lt;script&gt;/);
});

test("les liens dangereux ne deviennent pas des liens", () => {
  for (const u of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x"]) {
    const h = md(`[clique](${u})`);
    assert.ok(!/<a /i.test(h), `${u} → ${h}`);
  }
  assert.match(md("[écrire](mailto:info@exemple.ca)"), /<a href="mailto:info@exemple\.ca"/);
  assert.match(md("[page](/conditions)"), /<a href="\/conditions"/);
});

test("un guillemet dans une adresse ne permet pas d'ajouter un attribut", () => {
  const h = md('[x](https://exemple.ca/" onmouseover="alert(1))');
  assert.ok(!/onmouseover="/.test(h), h);
});

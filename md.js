/* HabitaScan : Markdown simple → HTML, partagé par le site, l'app et la console admin.
   Pris en charge : # / ## / ### titres, paragraphes, listes « - », **gras**, *italique*, [texte](lien),
   tableaux « | a | b | » (avec ligne de séparation). Un retour à la ligne dans un paragraphe reste un retour à la ligne ;
   une ligne vide sépare les paragraphes.
   Le texte est d'abord échappé : aucun HTML saisi n'est exécuté. Liens acceptés : https, mailto, tel et /chemin.
   Option sections:true : chaque section « ## » est placée dans un bloc <div class="card">. */
(function () {
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function enLigne(t) {
    let h = esc(t);
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      const u = url.replace(/&amp;/g, "&");
      if (!/^(https:\/\/|mailto:|tel:|\/)/i.test(u)) return txt;
      const ext = /^https:\/\//i.test(u);
      return `<a href="${esc(u)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${txt}</a>`;
    });
    h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
    return h;
  }
  function cellules(l) {
    return l
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  }
  function md(src, opt) {
    opt = opt || {};
    const L = String(src || "")
        .replace(/\r/g, "")
        .split("\n"),
      out = [];
    let i = 0;
    while (i < L.length) {
      const l = L[i];
      if (!l.trim()) {
        i++;
        continue;
      }
      let m = l.match(/^(#{1,3})\s+(.*)$/);
      if (m) {
        const n = m[1].length;
        out.push({ t: "h", n, h: `<h${n}>${enLigne(m[2])}</h${n}>` });
        i++;
        continue;
      }
      if (/^\s*\|/.test(l) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) {
        const tete = cellules(l);
        i += 2;
        const lignes = [];
        while (i < L.length && /^\s*\|/.test(L[i])) {
          lignes.push(cellules(L[i]));
          i++;
        }
        out.push({
          t: "b",
          h: `<table><thead><tr>${tete.map((c) => `<th>${enLigne(c)}</th>`).join("")}</tr></thead><tbody>${lignes.map((r) => `<tr>${r.map((c) => `<td>${enLigne(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
        });
        continue;
      }
      if (/^\s*[-*]\s+/.test(l)) {
        const items = [];
        while (i < L.length && /^\s*[-*]\s+/.test(L[i])) {
          items.push(`<li>${enLigne(L[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
          i++;
        }
        out.push({ t: "b", h: `<ul class="liste">${items.join("")}</ul>` });
        continue;
      }
      const p = [];
      while (
        i < L.length &&
        L[i].trim() &&
        !/^(#{1,3})\s+/.test(L[i]) &&
        !/^\s*[-*]\s+/.test(L[i]) &&
        !/^\s*\|/.test(L[i])
      ) {
        p.push(L[i]);
        i++;
      }
      out.push({ t: "b", h: `<p>${p.map((x) => enLigne(x.trim())).join("<br>")}</p>` });
    }
    if (!opt.sections) return out.map((o) => o.h).join("\n");
    let h = "",
      ouvert = false;
    for (const o of out) {
      if (o.t === "h" && o.n === 2) {
        if (ouvert) h += "</div>";
        h += `<div class="card">${o.h}`;
        ouvert = true;
      } else h += o.h;
    }
    return h + (ouvert ? "</div>" : "");
  }
  window.hsMarkdown = md;
})();

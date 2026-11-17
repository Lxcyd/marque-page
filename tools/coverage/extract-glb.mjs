// Extrait les livres cites a La Grande Librairie depuis la page Wikipedia FR.
// Usage : node extract-glb.mjs > glb-books.json
const UA = { "User-Agent": "marque-page/0.1 (github.com/Lxcyd/marque-page)" };
const url = "https://fr.wikipedia.org/w/api.php?action=parse&page=La_Grande_Librairie&prop=wikitext&format=json&formatversion=2";
const wt = (await (await fetch(url, { headers: UA })).json()).parse.wikitext;

const link = (s) => s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/'''?/g, "").replace(/<[^>]+>/g, "").trim();
const books = [];
let season = null, date = null;
for (const line of wt.split("\n")) {
  const s = line.match(/^===\s*Saison (\d+)/); if (s) { season = +s[1]; continue; }
  if (!season) continue;
  if (line.startsWith("==") && !line.startsWith("===")) { season = null; continue; }
  const d = line.match(/^;\s*(.+?)(?:\s+-\s+|$)/); if (d) { date = d[1].trim(); continue; }
  let m;
  // * [[Auteur]], ''Titre''   |   * Auteur, pour ''Titre''
  if ((m = line.match(/^\*\s+([^*'][^,]*?),\s*(?:pour\s+)?''([^']+(?:'[^']+)*)''/))) books.push({ season, date, author: link(m[1]), title: link(m[2]) });
  // ** ''Titre'' de [[Auteur]]
  else if ((m = line.match(/^\*\*.*?''([^']+(?:'[^']+)*)''\s+d(?:e|')\s*(.+)$/))) books.push({ season, date, author: link(m[2]).replace(/\s*\(.*$/, "").replace(/[,;.].*$/, ""), title: link(m[1]) });
}
// "Stendhal adapté en comédie musicale", "Alice Ferney par X" -> l'auteur seul
for (const b of books) b.author = b.author.split(/\s+(?:et|adaptée?|représentée?|portée?|par|sous|pour)\s/)[0].trim();
// dedoublonne
const seen = new Set();
const out = books.filter((b) => { const k = (b.title + "|" + b.author).toLowerCase(); if (seen.has(k) || !b.author || b.author.length > 60) return false; seen.add(k); return true; });
console.log(JSON.stringify(out, null, 1));
console.error(`${out.length} livres ; par saison :`, Object.entries(out.reduce((a, b) => ((a[b.season] = (a[b.season] || 0) + 1), a), {})).map(([k, v]) => `S${k}:${v}`).join(" "));

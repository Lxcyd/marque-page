// Lit en flux l'export des auteurs d'Open Library et ecrit data/ol-authors.tsv (cle \t nom).
// Les editions ne portent que des cles d'auteur (/authors/OL123A) : ce fichier les resout.
// Usage : node tools/import/ol-authors.mjs
import { createWriteStream, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";

const URL_DUMP = "https://openlibrary.org/data/ol_dump_authors_latest.txt.gz";
mkdirSync(new URL("../../data/", import.meta.url), { recursive: true });
const out = createWriteStream(new URL("../../data/ol-authors.tsv", import.meta.url));

const res = await fetch(URL_DUMP, { headers: { "User-Agent": "marque-page/0.1 (github.com/Lxcyd/marque-page)" } });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
let n = 0;
const rl = createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of rl) {
  const a = JSON.parse(line.slice(line.lastIndexOf("\t", line.indexOf("{")) + 1));
  const name = (a.name ?? a.personal_name)?.replace(/[\t\n\r]+/g, " ").trim();
  if (!name) continue;
  out.write(`${a.key}\t${name}\n`);
  if (++n % 2_000_000 === 0) console.error(`${n.toLocaleString()} auteurs`);
}
out.end();
console.log(`${n.toLocaleString()} auteurs`);

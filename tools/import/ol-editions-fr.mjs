// Lit en flux l'export des editions d'Open Library (~12,6 Go .gz, rien n'est stocke)
// et garde les editions en francais dans data/ol-editions-fr.jsonl.
// Usage : node tools/import/ol-editions-fr.mjs
import { createWriteStream, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";

const URL_DUMP = "https://openlibrary.org/data/ol_dump_editions_latest.txt.gz";
mkdirSync(new URL("../../data/", import.meta.url), { recursive: true });
const out = createWriteStream(new URL("../../data/ol-editions-fr.jsonl", import.meta.url));

const res = await fetch(URL_DUMP, { headers: { "User-Agent": "marque-page/0.1 (github.com/Lxcyd/marque-page)" } });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const total = Number(res.headers.get("content-length") ?? 0);
let downloaded = 0;
const body = Readable.fromWeb(res.body);
body.on("data", (c) => (downloaded += c.length));

const stats = { lines: 0, fr: 0, isbn: 0, cover: 0, authors: 0, work: 0, pages: 0, publisher: 0, date: 0, description: 0 };
const t0 = Date.now();
const rl = createInterface({ input: body.pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of rl) {
  stats.lines++;
  if (stats.lines % 2_000_000 === 0) {
    const pct = total ? ((100 * downloaded) / total).toFixed(1) : "?";
    console.error(`${pct}% · ${stats.lines.toLocaleString()} lignes · ${stats.fr.toLocaleString()} FR · ${((Date.now() - t0) / 60000).toFixed(0)} min`);
  }
  if (!line.includes('"/languages/fre"')) continue;
  const e = JSON.parse(line.slice(line.lastIndexOf("\t", line.indexOf("{")) + 1));
  if (!e.languages?.some((l) => l.key === "/languages/fre")) continue;
  const isbn = e.isbn_13?.[0] ?? e.isbn_10?.[0];
  const rec = {
    key: e.key,
    work: e.works?.[0]?.key,
    title: e.subtitle ? `${e.title} : ${e.subtitle}` : e.title,
    authors: (e.authors ?? []).map((a) => a.key).filter(Boolean),
    by: e.by_statement,
    isbn,
    publisher: e.publishers?.[0],
    date: e.publish_date,
    pages: e.number_of_pages,
    cover: e.covers?.find((c) => c > 0),
    description: typeof e.description === "string" ? e.description : e.description?.value,
    subjects: e.subjects?.slice(0, 8),
  };
  stats.fr++;
  if (rec.isbn) stats.isbn++;
  if (rec.cover) stats.cover++;
  if (rec.authors.length || rec.by) stats.authors++;
  if (rec.work) stats.work++;
  if (rec.pages) stats.pages++;
  if (rec.publisher) stats.publisher++;
  if (rec.date) stats.date++;
  if (rec.description) stats.description++;
  out.write(JSON.stringify(rec) + "\n");
}
out.end();
const pct = (n) => `${((100 * n) / stats.fr).toFixed(0)} %`;
console.log(JSON.stringify(stats));
console.log(
  `editions FR : ${stats.fr.toLocaleString()} sur ${stats.lines.toLocaleString()} | ISBN ${pct(stats.isbn)} · couverture ${pct(stats.cover)} · auteur ${pct(stats.authors)} · oeuvre ${pct(stats.work)} · editeur ${pct(stats.publisher)} · date ${pct(stats.date)} · pages ${pct(stats.pages)} · synopsis ${pct(stats.description)}`,
);

// Importe data/ol-works-fr.jsonl dans Turso, les fiches les plus completes d'abord,
// par lots, avec reprise (data/load-progress.json) et compte des lignes ecrites.
// Plan starter : 10 M de lignes ecrites / mois -> toujours fixer un plafond.
// Usage : npx tsx --env-file=.env.local tools/import/load.mts <nb d'oeuvres max>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { upsertBooks } from "../../src/lib/catalog";
import { isFrenchIsbn } from "../../src/lib/isbn";
import type { Book } from "../../src/lib/types";

const max = Number(process.argv[2]);
if (!max) throw new Error("usage : load.mts <nb d'oeuvres max>");
const data = (f: string) => new URL(`../../data/${f}`, import.meta.url);
const progressFile = data("load-progress.json");
const done: number = existsSync(progressFile) ? JSON.parse(readFileSync(progressFile, "utf8")).done : 0;

const prio = (b: Book) =>
  (b.cover ? 8 : 0) + (b.description ? 4 : 0) + (isFrenchIsbn(b.isbn) ? 3 : 0) + (b.publisher ? 1 : 0) +
  (Number(b.year) >= 1950 ? 1 : 0);
const works: Book[] = readFileSync(data("ol-works-fr.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
works.sort((a, b) => prio(b) - prio(a) || a.id.localeCompare(b.id)); // ordre stable pour la reprise

// rows_written facture, lu sur l'API d'usage de l'organisation
const written = async () => {
  const r = await fetch("https://api.turso.tech/v1/organizations/marquepage/usage", {
    headers: { Authorization: `Bearer ${process.env.TURSO_API_TOKEN}` },
  });
  return (await r.json()).organization.usage.rows_written as number;
};

const w0 = await written();
const end = Math.min(works.length, done + max);
const t0 = Date.now();
for (let i = done; i < end; i += 500) {
  const batch = works.slice(i, Math.min(i + 500, end));
  for (let attempt = 0; ; attempt++) {
    try {
      await upsertBooks(batch);
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      console.error(`lot ${i} : ${(e as Error).message}, nouvel essai`);
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  writeFileSync(progressFile, JSON.stringify({ done: i + batch.length }));
  if ((i - done) % 20000 === 0) console.error(`${(i + batch.length).toLocaleString()}/${works.length.toLocaleString()} · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
const n = end - done;
// l'API d'usage peut avoir un peu de retard : relire apres coup pour le chiffre exact
const w1 = await written();
console.log(`${n.toLocaleString()} oeuvres importees (${done}->${end}) · ${(w1 - w0).toLocaleString()} lignes ecrites (${((w1 - w0) / n).toFixed(1)}/oeuvre)`);

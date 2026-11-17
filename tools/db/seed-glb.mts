// Remplit le catalogue avec les livres de La Grande Librairie (et leurs voisins de recherche).
// Reprend la ou il s'est arrete : un livre deja present est saute.
// Usage : npx tsx --env-file=.env.local tools/db/seed-glb.mts [max=600]
import { readFileSync } from "node:fs";
import { searchCatalog, upsertBooks } from "../../src/lib/catalog";
import { searchBooks, titleMatch, words } from "../../src/lib/search";

type Ref = { title: string; author: string };
const max = Number(process.argv[2] ?? 600);
const refs: Ref[] = (JSON.parse(readFileSync(new URL("../coverage/glb-books.json", import.meta.url), "utf8")) as Ref[])
  .filter((b) => /^\p{Lu}/u.test(b.author) && !b.author.includes(":") && !b.title.includes("{{"));

/** Coupures reseau passageres (Turso, API) : 3 essais espaces avant d'abandonner ce livre. */
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= 2) throw e;
      await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
    }
  }
}

let done = 0, skipped = 0, added = 0, failed = 0;
for (const ref of refs) {
  if (done >= max) break;
  const q = `${ref.title} ${ref.author}`;
  const qWords = new Set(words(q));
  const surname = words(ref.author).pop() ?? "";
  try {
    const known = await retry(() => searchCatalog(q, 5));
    if (known.some((b) => titleMatch(b, qWords) === 1 && b.authors.some((a) => words(a).includes(surname)))) {
      skipped++;
      continue;
    }
    const { books, sources } = await searchBooks(q, { timeoutMs: 20000, retries: 2 });
    if (sources.google === null) {
      console.error("Google ne repond plus (quota du jour ?) : arret, reprendre demain.");
      break;
    }
    added += await retry(() => upsertBooks(books.slice(0, 10)));
  } catch (e) {
    failed++;
    console.error(`echec "${q}" :`, (e as Error).message);
  }
  done++;
  if (done % 50 === 0) console.error(`${done} recherches, ${skipped} deja presents, ${added} oeuvres ecrites`);
}
console.error(`fin : ${done} recherches, ${skipped} deja presents, ${added} oeuvres ecrites, ${failed} echecs`);

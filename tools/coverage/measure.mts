// Mesure la couverture du moteur de recherche sur un jeu de livres connus.
// Usage : npx tsx measure.mts glb-books.json [parSaison=40] > report.json
import { readFileSync } from "node:fs";
import { searchBooks } from "../../src/lib/search";
import type { Book } from "../../src/lib/types";

type Ref = { season: number; title: string; author: string };
const [file, perSeasonArg] = process.argv.slice(2);
// ecarte le bruit d'extraction ("l'ancien président", "Invité fil rouge : X")
const all: Ref[] = (JSON.parse(readFileSync(file, "utf8")) as Ref[]).filter(
  (b) => /^\p{Lu}/u.test(b.author) && !b.author.includes(":"),
);
const perSeason = Number(perSeasonArg ?? 40);

// echantillon deterministe : tous les n-iemes livres de chaque saison
const bySeason = Map.groupBy(all, (b) => b.season);
const sample = [...bySeason.values()].flatMap((list) => {
  const step = Math.max(1, list.length / perSeason);
  return Array.from({ length: Math.min(perSeason, list.length) }, (_, i) => list[Math.floor(i * step)]);
});

const words = (s: string) =>
  s.replace(/œ/gi, "oe").replace(/æ/gi, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !["les", "des", "une", "pour", "dans", "avec", "sur", "the"].includes(w));

function matches(b: Book, ref: Ref) {
  const want = words(ref.title.split(/\s[:(]/)[0]);
  const got = new Set(words(b.title));
  const titleOk = want.length ? want.filter((w) => got.has(w)).length / want.length >= 0.75 : false;
  const surname = words(ref.author).pop();
  const authorOk = !!surname && b.authors.some((a) => words(a).includes(surname));
  return titleOk && authorOk;
}

const UA = { "User-Agent": "book-list/0.1 (github.com/Lxcyd/book-list)" };
async function coverOk(url?: string) {
  if (!url) return false;
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
    const n = (await r.arrayBuffer()).byteLength;
    return r.ok && n > 2000; // les images "vides" font quelques octets
  } catch { return false; }
}

async function olDescription(b: Book) {
  if (!b.id.startsWith("openlibrary:")) return false;
  try {
    const j = await (await fetch(`https://openlibrary.org${b.id.slice(12)}.json`, { headers: UA })).json();
    return !!j.description;
  } catch { return false; }
}

async function one(ref: Ref) {
  // on mesure ce qui EXISTE dans les catalogues, pas la latence : delais longs + 2 reessais
  const { books, sources } = await searchBooks(`${ref.title} ${ref.author}`, { timeoutMs: 30000, retries: 2 });
  const hit = books.slice(0, 5).find((b) => matches(b, ref));
  const anyHit = books.find((b) => matches(b, ref));
  return {
    ...ref,
    sources,
    found: !!hit,
    foundBeyondTop5: !hit && !!anyHit,
    hit: hit && {
      title: hit.title, from: hit.sources,
      author: hit.authors.length > 0, isbn: !!hit.isbn, publisher: !!hit.publisher, year: !!hit.year,
      pages: !!hit.pages, synopsis: !!hit.description,
      cover: await coverOk(hit.cover), olSynopsis: await olDescription(hit),
    },
  };
}

const out: Awaited<ReturnType<typeof one>>[] = [];
const queue = [...sample];
await Promise.all(Array.from({ length: 2 }, async () => {
  for (let ref; (ref = queue.shift()); ) {
    out.push(await one(ref));
    if (out.length % 25 === 0) console.error(`${out.length}/${sample.length}`);
  }
}));
console.log(JSON.stringify(out, null, 1));

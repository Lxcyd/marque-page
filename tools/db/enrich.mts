// Complete les livres sans couverture ou sans synopsis (par ISBN : Google Books puis Open Library).
// Un livre est retente au plus 5 fois, pas plus d'une fois par jour : les parutions recentes
// recoivent souvent leur couverture quelques semaines apres la sortie.
// Usage : npx tsx --env-file=.env.local tools/db/enrich.mts [max=200]
import { db } from "../../src/lib/db";

const max = Number(process.argv[2] ?? 200);
const UA = { "User-Agent": "marque-page/0.1 (github.com/Lxcyd/marque-page)" };
const c = db()!;
const DAY = 86_400_000;

async function json(url: string) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (r.status === 429) throw new Error("429");
  return r.ok ? r.json() : null;
}

async function imageOk(url: string) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    return r.ok && (await r.arrayBuffer()).byteLength > 2000;
  } catch {
    return false;
  }
}

async function fromGoogle(isbn: string) {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return {};
  const j = await json(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${key}`);
  const v = j?.items?.[0]?.volumeInfo;
  const img = v?.imageLinks?.thumbnail?.replace("http://", "https://").replace("&edge=curl", "");
  return { cover: img, description: v?.description as string | undefined };
}

async function fromOpenLibrary(isbn: string) {
  const ed = await json(`https://openlibrary.org/isbn/${isbn}.json`);
  const workKey = ed?.works?.[0]?.key;
  const work = workKey ? await json(`https://openlibrary.org${workKey}.json`) : null;
  const d = work?.description ?? ed?.description;
  const cover = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
  return { cover: (await imageOk(cover)) ? cover : undefined, description: typeof d === "string" ? d : d?.value };
}

const { rows } = await c.execute({
  sql: `SELECT id, isbn, cover, description FROM books
        WHERE (cover IS NULL OR description IS NULL) AND isbn IS NOT NULL
          AND enrich_tries < 5 AND (enriched_at IS NULL OR enriched_at < ?)
        ORDER BY enriched_at IS NOT NULL, enriched_at LIMIT ?`,
  args: [Date.now() - DAY, max],
});

let covers = 0, synopses = 0;
for (const r of rows) {
  const isbn = r.isbn as string;
  let cover = r.cover as string | null;
  let description = r.description as string | null;
  try {
    for (const source of [fromGoogle, fromOpenLibrary]) {
      if (cover && description) break;
      const got = await source(isbn);
      if (!cover && got.cover) {
        cover = got.cover;
        covers++;
      }
      if (!description && got.description) {
        description = got.description;
        synopses++;
      }
    }
  } catch (e) {
    if ((e as Error).message === "429") {
      console.error("quota atteint : arret, reprise au prochain passage");
      break;
    }
  }
  await c.execute({
    sql: `UPDATE books SET cover = ?, description = ?, enrich_tries = enrich_tries + 1, enriched_at = ?, updated_at = ? WHERE id = ?`,
    args: [cover, description, Date.now(), Date.now(), r.id],
  });
}
console.error(`${rows.length} livres traites : +${covers} couvertures, +${synopses} synopsis`);

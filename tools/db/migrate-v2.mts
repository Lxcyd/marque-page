// Migration ponctuelle (17/11/2026) : FTS relie par rowid (seq) au lieu d'une colonne id UNINDEXED.
// Le DELETE par id parcourait tout l'index a chaque mise a jour (10,9 M lignes lues pour 3 800 livres).
// Usage : npx tsx --env-file=.env.local tools/db/migrate-v2.mts
import { readFileSync } from "node:fs";
import { db } from "../../src/lib/db";
import { unlig } from "../../src/lib/search";

const c = db()!;
const cols = (await c.execute("PRAGMA table_info(books)")).rows.map((r) => r.name);
if (cols.includes("seq")) {
  console.log("deja migre");
  process.exit(0);
}

await c.executeMultiple(`
  ALTER TABLE books RENAME TO books_v1;
  DROP INDEX IF EXISTS books_isbn;
  DROP INDEX IF EXISTS books_to_enrich;
  DROP TABLE IF EXISTS books_fts;
`);
await c.executeMultiple(readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8"));
await c.execute(`
  INSERT INTO books (id, title, authors, year, publisher, isbn, cover, pages, language, description, sources,
                     created_at, updated_at, enrich_tries, enriched_at)
  SELECT id, title, authors, year, publisher, isbn, cover, pages, language, description, sources,
         created_at, updated_at, enrich_tries, COALESCE(enriched_at, 0)
  FROM books_v1`);

const { rows } = await c.execute("SELECT seq, title, authors FROM books");
for (let i = 0; i < rows.length; i += 500) {
  await c.batch(
    rows.slice(i, i + 500).map((r) => ({
      sql: "INSERT INTO books_fts (rowid, text) VALUES (?, ?)",
      args: [r.seq, unlig(`${r.title} ${(JSON.parse(r.authors as string) as string[]).join(" ")}`)],
    })),
    "write",
  );
}
await c.execute("DROP TABLE books_v1");
console.log(`${rows.length} livres migres`);

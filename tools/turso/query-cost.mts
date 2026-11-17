// Mesure le cout (rows_read) des requetes chaudes.
// Usage : npx tsx --env-file=.env.local tools/turso/query-cost.mts
import { queryCost } from "./cost.mjs";

const search = `SELECT b.* FROM books_fts f JOIN books b ON b.seq = f.rowid
  WHERE books_fts MATCH ? ORDER BY bm25(books_fts) LIMIT ?`;

const cases: [string, string, (string | number)[]][] = [
  ["fts 'idiot'", search, ['"idiot"*', 30]],
  ["fts maj : delete par rowid", "SELECT rowid FROM books_fts WHERE rowid = (SELECT seq FROM books WHERE id = ?)", ["idiot|dostoievski"]],
  ["fts 'dostoievski idiot'", search, ['"dostoievski"* "idiot"*', 30]],
  ["fts 'roman' (mot frequent)", search, ['"roman"*', 30]],
  ["fts 'ma' (exact, plus de prefixe)", search, ['"ma"', 30]],
  ["upsert : select par id", "SELECT * FROM books WHERE id IN (?)", ["idiot|dostoievski"]],
  ["count(*)", "SELECT COUNT(*) FROM books", []],
  [
    "file d'enrichissement",
    `SELECT id FROM books WHERE (cover IS NULL OR description IS NULL) AND isbn IS NOT NULL AND enrich_tries < 5
       AND enriched_at < ? ORDER BY enriched_at LIMIT 300`,
    [Date.now()],
  ],
];

for (const [label, sql, args] of cases) console.log(label.padEnd(30), await queryCost(sql, args));

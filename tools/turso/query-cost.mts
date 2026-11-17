// Mesure le cout (rows_read) des requetes chaudes, avec un plafond par requete.
// Usage : npx tsx --env-file=.env.local tools/turso/query-cost.mts
import { queryCost } from "./cost.mjs";

// Les deux requetes de searchCatalog (src/lib/catalog.ts).
const fts = `SELECT b.* FROM books_fts f JOIN books b ON b.seq = f.rowid WHERE books_fts MATCH ? LIMIT 300`;
const exact = "SELECT * FROM books WHERE id >= ? AND id < ? ORDER BY editions DESC LIMIT 20";

const cases: [string, string, (string | number)[], number][] = [
  ["fts 'roman' (mot frequent)", fts, ['"roman"*'], 700],
  ["fts 'ma'", fts, ['"ma"'], 700],
  ["fts 'dostoievski idiot'", fts, ['"dostoievski" "idiot"*'], 700],
  ["titre exact 'histoire'", exact, ["histoire|", "histoire|~"], 300],
  ["titre exact 'candide'", exact, ["candide|", "candide|~"], 300],
  ["titre commence par 'ca'", "SELECT * FROM books WHERE id >= ? AND id < ? LIMIT 200", ["ca", "ca~"], 450],
  ["fts maj : delete par rowid", "SELECT rowid FROM books_fts WHERE rowid = (SELECT seq FROM books WHERE id = ?)", ["candide|voltaire"], 5],
  ["upsert : select par id", "SELECT * FROM books WHERE id IN (?)", ["candide|voltaire"], 5],
  [
    "file d'enrichissement",
    `SELECT id FROM books WHERE (cover IS NULL OR description IS NULL) AND isbn IS NOT NULL AND enrich_tries < 5
       AND enriched_at < ? ORDER BY enriched_at LIMIT 300`,
    [Date.now()],
    400,
  ],
];

let over = 0;
for (const [label, sql, args, max] of cases) {
  const c = await queryCost(sql, args);
  const bad = c.rowsRead > max;
  if (bad) over++;
  console.log(`${bad ? "TROP" : "ok  "} ${label.padEnd(30)} ${String(c.rowsRead).padStart(7)} lignes lues (plafond ${max})`);
}
process.exit(over ? 1 : 0);

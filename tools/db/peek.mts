// Interroge le catalogue local. Usage : npx tsx --env-file=.env.local tools/db/peek.mts "requete" ...
import { db } from "../../src/lib/db";
import { searchCatalog } from "../../src/lib/catalog";
const { rows } = await db()!.execute("SELECT COUNT(*) n, SUM(cover IS NULL) sans_couv, SUM(description IS NULL) sans_syn FROM books");
console.log("catalogue :", rows[0]);
for (const q of process.argv.slice(2)) {
  const r = await searchCatalog(q, 3);
  console.log(q, "→", r.map((b) => `${b.title} / ${b.authors[0]}${b.cover ? " [couv]" : ""}${b.description ? " [syn]" : ""}`));
}

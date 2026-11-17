// Migration ponctuelle (17/11/2026) : colonne editions (notoriete pour le classement).
// ADD COLUMN avec valeur par defaut = changement de schema seul, aucune ligne reecrite.
// Usage : npx tsx --env-file=.env.local tools/db/migrate-v3.mts
import { db } from "../../src/lib/db";

const c = db()!;
const cols = (await c.execute("PRAGMA table_info(books)")).rows.map((r) => r.name);
if (cols.includes("editions")) console.log("deja migre");
else {
  await c.execute("ALTER TABLE books ADD COLUMN editions INTEGER NOT NULL DEFAULT 0");
  console.log("colonne editions ajoutee");
}

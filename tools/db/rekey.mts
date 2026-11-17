// Ponctuel (17/11/2026) : apres un changement de workKey (apostrophe courbe = droite),
// fusionne chaque fiche dont la cle a change dans la fiche de sa nouvelle cle.
// Lit toute la table une fois (~950 000 lignes). Usage : npx tsx --env-file=.env.local tools/db/rekey.mts
import type { Row } from "@libsql/client";
import { upsertBooks } from "../../src/lib/catalog";
import { db } from "../../src/lib/db";
import { workKey } from "../../src/lib/search";
import type { Book } from "../../src/lib/types";

const c = db()!;
const { rows } = await c.execute("SELECT * FROM books WHERE title LIKE '%’%' OR title LIKE '%ʼ%'");
const toBook = (r: Row): Book => ({
  id: r.id as string, title: r.title as string, authors: JSON.parse(r.authors as string),
  year: (r.year as string) ?? undefined, publisher: (r.publisher as string) ?? undefined,
  isbn: (r.isbn as string) ?? undefined, cover: (r.cover as string) ?? undefined,
  pages: (r.pages as number) ?? undefined, language: (r.language as string) ?? undefined,
  description: (r.description as string) ?? undefined, editions: (r.editions as number) || undefined,
  sources: JSON.parse(r.sources as string),
});
const moved = rows.map(toBook).filter((b) => workKey(b) !== b.id);
console.log(`${rows.length} fiches avec apostrophe courbe, ${moved.length} a deplacer`);
for (const b of moved) {
  // les editions s'additionnent : ce sont deux paquets d'editions de la meme oeuvre
  const { rows: t } = await c.execute({ sql: "SELECT editions FROM books WHERE id = ?", args: [workKey(b)] });
  const editions = (b.editions ?? 0) + ((t[0]?.editions as number) ?? 0) || undefined;
  await upsertBooks([{ ...b, id: workKey(b), editions }]);
  if (t[0]) {
    await c.execute({ sql: "UPDATE books SET editions = ? WHERE id = ?", args: [editions ?? 0, workKey(b)] });
  }
  await c.batch([
    { sql: "DELETE FROM books_fts WHERE rowid = (SELECT seq FROM books WHERE id = ?)", args: [b.id] },
    { sql: "DELETE FROM books WHERE id = ?", args: [b.id] },
  ], "write");
}
console.log("fait");

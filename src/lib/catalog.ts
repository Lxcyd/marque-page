import type { Row } from "@libsql/client";
import { db } from "./db";
import { merge, titleMatch, unlig, words, workKey } from "./search";
import type { Book } from "./types";

const fromRow = (r: Row): Book => ({
  id: r.id as string,
  title: r.title as string,
  authors: JSON.parse(r.authors as string),
  year: (r.year as string) ?? undefined,
  publisher: (r.publisher as string) ?? undefined,
  isbn: (r.isbn as string) ?? undefined,
  cover: (r.cover as string) ?? undefined,
  pages: (r.pages as number) ?? undefined,
  language: (r.language as string) ?? undefined,
  description: (r.description as string) ?? undefined,
  sources: JSON.parse(r.sources as string),
});

const ftsText = (b: Book) => unlig(`${b.title} ${b.authors.join(" ")}`);

/**
 * Recherche dans le catalogue local : tous les mots doivent apparaitre.
 * Seul le DERNIER mot est cherche en prefixe (saisie en cours), et a partir de 3 lettres :
 * un prefixe court ("ma"*) lit des milliers d'entrees d'index (mesure : 2 154 lignes sur 3 800 livres).
 */
export async function searchCatalog(q: string, limit = 30): Promise<Book[]> {
  const c = db();
  const terms = words(q).filter((w) => w.length > 1);
  if (!c || !terms.length) return [];
  const match = terms
    .map((t, i) => (i === terms.length - 1 && t.length >= 3 ? `"${t}"*` : `"${t}"`))
    .join(" ");
  const { rows } = await c.execute({
    sql: `SELECT b.* FROM books_fts f JOIN books b ON b.seq = f.rowid
          WHERE books_fts MATCH ? ORDER BY bm25(books_fts) LIMIT ?`,
    args: [match, limit],
  });
  // bm25 trouve les candidats ; on les reclasse comme la recherche en direct
  // (titre exact > fiche complete), a ordre bm25 egal.
  const qWords = new Set(terms);
  const rank = (b: Book, i: number) =>
    titleMatch(b, qWords) * 30 + (b.authors.length ? 6 : 0) + (b.cover ? 4 : 0) + (b.description ? 2 : 0) - i * 0.2;
  return rows
    .map(fromRow)
    .map((b, i) => ({ b, s: rank(b, i) }))
    .sort((x, y) => y.s - x.s)
    .map((x) => x.b);
}

/** Egalite de contenu, independante de l'ordre des cles et des champs vides. */
const canon = (b: Book) => {
  const o = Object.fromEntries(Object.entries({ ...b, id: "" }).filter(([, v]) => v !== undefined && v !== null));
  return JSON.stringify(o, Object.keys(o).sort());
};
const same = (a: Book, b: Book) => canon(a) === canon(b);

/** Ajoute ou complete des livres (les champs deja connus ne sont jamais effaces). */
export async function upsertBooks(books: Book[]): Promise<number> {
  const c = db();
  if (!c || !books.length) return 0;
  const now = Date.now();
  const ids = books.map(workKey);
  const existing = new Map<string, Book>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { rows } = await c.execute({
      sql: `SELECT * FROM books WHERE id IN (${chunk.map(() => "?").join(",")})`,
      args: chunk,
    });
    rows.forEach((r) => existing.set(r.id as string, fromRow(r)));
  }

  const merged = new Map<string, Book>();
  books.forEach((b, i) => {
    const id = ids[i];
    const prev = merged.get(id) ?? existing.get(id);
    merged.set(id, { ...(prev ? merge(prev, b) : b), id });
  });

  // N'ecrit que ce qui change : une ligne inchangee ne coute aucune ecriture,
  // et l'index plein texte n'est reecrit que si le titre ou les auteurs changent.
  const stmts = [...merged.values()].flatMap((b) => {
    const prev = existing.get(b.id);
    if (prev && same(prev, b)) return [];
    const ftsChanged = !prev || ftsText(prev) !== ftsText(b);
    return [
    {
      sql: `INSERT INTO books (id, title, authors, year, publisher, isbn, cover, pages, language, description, sources, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, authors=excluded.authors, year=excluded.year,
              publisher=excluded.publisher, isbn=excluded.isbn, cover=excluded.cover, pages=excluded.pages,
              language=excluded.language, description=excluded.description, sources=excluded.sources,
              updated_at=excluded.updated_at`,
      args: [b.id, b.title, JSON.stringify(b.authors), b.year ?? null, b.publisher ?? null, b.isbn ?? null,
        b.cover ?? null, b.pages ?? null, b.language ?? null, b.description ?? null, JSON.stringify(b.sources), now, now],
    },
    ...(ftsChanged
      ? [
          // par rowid : 1 ligne lue (un DELETE par colonne parcourait tout l'index)
          { sql: "DELETE FROM books_fts WHERE rowid = (SELECT seq FROM books WHERE id = ?)", args: [b.id] },
          { sql: "INSERT INTO books_fts (rowid, text) SELECT seq, ? FROM books WHERE id = ?", args: [ftsText(b), b.id] },
        ]
      : []),
    ];
  });
  if (stmts.length) await c.batch(stmts, "write");
  return merged.size;
}

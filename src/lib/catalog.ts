import type { Row } from "@libsql/client";
import { db } from "./db";
import { merge, unlig, words, workKey } from "./search";
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

/** Recherche dans le catalogue local : tous les mots doivent apparaitre (prefixes acceptes). */
export async function searchCatalog(q: string, limit = 30): Promise<Book[]> {
  const c = db();
  const terms = words(q).filter((w) => w.length > 1);
  if (!c || !terms.length) return [];
  const match = terms.map((t) => `"${t}"*`).join(" ");
  const { rows } = await c.execute({
    sql: `SELECT b.* FROM books_fts f JOIN books b ON b.id = f.id
          WHERE books_fts MATCH ? ORDER BY bm25(books_fts) LIMIT ?`,
    args: [match, limit],
  });
  return rows.map(fromRow);
}

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

  const stmts = [...merged.values()].flatMap((b) => [
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
    { sql: "DELETE FROM books_fts WHERE id = ?", args: [b.id] },
    { sql: "INSERT INTO books_fts (id, text) VALUES (?, ?)", args: [b.id, ftsText(b)] },
  ]);
  await c.batch(stmts, "write");
  return merged.size;
}

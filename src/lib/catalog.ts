import type { Row } from "@libsql/client";
import { db } from "./db";
import { merge, relevance, titleKey, unlig, words, workKey } from "./search";
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
  editions: (r.editions as number) || undefined,
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
  // Cout borne (~650 lignes lues au pire), mesure sur 950 000 oeuvres :
  // - PAS de ORDER BY bm25 : il lit TOUTES les correspondances ("roman" : 126 018 lignes).
  //   Sans tri, FTS5 s'arrete a 300 (599 lignes), dans l'ordre d'insertion, et l'import
  //   a insere les fiches les plus completes d'abord.
  // - titre exact par l'index de la cle (id = "titre|auteur"), les plus editees d'abord
  //   (13 a 130 lignes) : l'oeuvre connue est la meme si le mot est tres frequent.
  const key = titleKey(q);
  const [fts, exact] = await Promise.all([
    c.execute({
      sql: `SELECT b.* FROM books_fts f JOIN books b ON b.seq = f.rowid WHERE books_fts MATCH ? LIMIT 300`,
      args: [match],
    }),
    key.length >= 2
      ? c.execute({
          sql: "SELECT * FROM books WHERE id >= ? AND id < ? ORDER BY editions DESC LIMIT 20",
          args: [`${key}|`, `${key}|~`],
        })
      : { rows: [] as Row[] },
  ]);
  const byId = new Map<string, Book>();
  for (const r of [...exact.rows, ...fts.rows]) byId.set(r.id as string, fromRow(r));
  // classement : titre exact, notoriete, francais, fiche complete
  const qWords = new Set(terms);
  return [...byId.values()]
    .map((b) => ({ b, s: relevance(b, qWords) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
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
      sql: `INSERT INTO books (id, title, authors, year, publisher, isbn, cover, pages, language, description, editions, sources, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, authors=excluded.authors, year=excluded.year,
              publisher=excluded.publisher, isbn=excluded.isbn, cover=excluded.cover, pages=excluded.pages,
              language=excluded.language, description=excluded.description, editions=excluded.editions,
              sources=excluded.sources, updated_at=excluded.updated_at`,
      args: [b.id, b.title, JSON.stringify(b.authors), b.year ?? null, b.publisher ?? null, b.isbn ?? null,
        b.cover ?? null, b.pages ?? null, b.language ?? null, b.description ?? null, b.editions ?? 0,
        JSON.stringify(b.sources), now, now],
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

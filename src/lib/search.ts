import { isFrenchIsbn } from "./isbn";
import { searchBnf } from "./sources/bnf";
import { searchGoogle } from "./sources/google";
import { searchOpenLibrary } from "./sources/openlibrary";
import type { Book, Source } from "./types";

const TIMEOUT_MS: Record<Source, number> = { google: 5000, openlibrary: 5000, bnf: 8000 };

/** œ/æ ne se decomposent pas en NFD : "sœurs" doit egaler "soeurs". */
export const unlig = (s: string) => s.replace(/œ/g, "oe").replace(/Œ/g, "Oe").replace(/æ/g, "ae").replace(/Æ/g, "Ae");

const norm = (s = "") =>
  unlig(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(l'|le |la |les |un |une |the )/, "")
    .replace(/[^a-z0-9]/g, "");

/** Nom de famille : "Dostoïevski, Fiodor" -> avant la virgule ; "Fiodor Dostoïevski" -> dernier mot. */
const surname = (a?: string) => norm(a?.includes(",") ? a.split(",")[0] : a?.trim().split(/\s+/).pop());

/** "Le Chien jaune - Edition Collector (French Edition)" -> "Le Chien jaune" */
const mainTitle = (t: string) => t.split(/\s[-:(\[]\s?|\s\/\s/)[0];

/** Cle d'oeuvre : on regroupe les editions d'un meme titre/auteur. */
export const workKey = (b: Book) => `${norm(mainTitle(b.title))}|${surname(b.authors[0])}`;

const STOP = new Set(["le", "la", "les", "l", "un", "une", "des", "de", "du", "d", "et", "the", "a", "of"]);
export const words = (s: string) =>
  unlig(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));

/** Part des mots du titre presents dans la requete : "Le Petit Prince" bat "Le Petit Prince : puzzles". */
export function titleMatch(b: Book, qWords: Set<string>): number {
  const t = words(b.title);
  if (!t.length) return 0;
  return t.filter((w) => qWords.has(w)).length / t.length;
}

export function merge(a: Book, b: Book): Book {
  return {
    ...a,
    authors: a.authors.length ? a.authors : b.authors,
    year: a.year ?? b.year,
    publisher: a.publisher ?? b.publisher,
    isbn: isFrenchIsbn(a.isbn) ? a.isbn : (b.isbn ?? a.isbn),
    cover: a.cover ?? b.cover,
    pages: a.pages ?? b.pages,
    language: a.language ?? b.language,
    description: a.description ?? b.description,
    sources: [...new Set([...a.sources, ...b.sources])],
  };
}

function score(b: Book, rank: number, qWords: Set<string>): number {
  return (
    titleMatch(b, qWords) * 30 +
    -rank * 0.5 + // ordre d'origine dans la meilleure source
    (b.sources.length - 1) * 4 + // confirme par plusieurs catalogues
    (b.language === "fr" || isFrenchIsbn(b.isbn) ? 6 : 0) +
    (b.cover ? 4 : 0) +
    (b.authors.length ? 2 : 0)
  );
}

type Opts = { timeoutMs?: number; retries?: number };

/** Renvoie null si la source a echoue (distinct de "aucun resultat"). */
async function withTimeout(source: Source, q: string, { timeoutMs, retries = 0 }: Opts): Promise<Book[] | null> {
  const fn = { google: searchGoogle, openlibrary: searchOpenLibrary, bnf: searchBnf }[source];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(q, AbortSignal.timeout(timeoutMs ?? TIMEOUT_MS[source]));
    } catch (e) {
      if (attempt >= retries) {
        console.warn(`[search] ${source}:`, (e as Error).message);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

export async function searchBooks(
  q: string,
  opts: Opts = {},
): Promise<{ books: Book[]; sources: Record<Source, number | null> }> {
  // Ordre = priorite pour les champs fusionnes (titre, couverture...) : la BnF passe en dernier, ses titres sont bruts.
  const order: Source[] = ["google", "openlibrary", "bnf"];
  const raw = await Promise.all(order.map((s) => withTimeout(s, q, opts)));
  const results = raw.map((r) => r ?? []);
  const qWords = new Set(words(q));

  const byKey = new Map<string, { book: Book; rank: number }>();
  const keyByIsbn = new Map<string, string>();
  results.forEach((list) =>
    list.forEach((book, i) => {
      // meme ISBN = meme livre, meme si les titres different
      const key = (book.isbn && keyByIsbn.get(book.isbn)) || workKey(book);
      const prev = byKey.get(key);
      const entry = prev ? { book: merge(prev.book, book), rank: Math.min(prev.rank, i) } : { book, rank: i };
      byKey.set(key, entry);
      for (const isbn of [book.isbn, entry.book.isbn]) if (isbn) keyByIsbn.set(isbn, key);
    }),
  );

  const books = [...byKey.values()]
    .sort((x, y) => score(y.book, y.rank, qWords) - score(x.book, x.rank, qWords))
    .map((x) => x.book)
    .slice(0, 30);

  return {
    books,
    // null = source en echec
    sources: Object.fromEntries(order.map((s, i) => [s, raw[i]?.length ?? null])) as Record<Source, number | null>,
  };
}

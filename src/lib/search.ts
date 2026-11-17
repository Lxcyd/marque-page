import { isFrenchIsbn } from "./isbn";
import { KNOWN_PUBLISHER, POOR_PUBLISHER } from "./publishers";
import { searchBnf } from "./sources/bnf";
import { searchGoogle } from "./sources/google";
import { searchOpenLibrary } from "./sources/openlibrary";
import type { Book, Source } from "./types";

const TIMEOUT_MS: Record<Source, number> = { google: 5000, openlibrary: 5000, bnf: 8000 };

/** œ/æ ne se decomposent pas en NFD : "sœurs" doit egaler "soeurs". */
export const unlig = (s: string) => s.replace(/œ/g, "oe").replace(/Œ/g, "Oe").replace(/æ/g, "ae").replace(/Æ/g, "Ae");

const norm = (s = "") =>
  unlig(s)
    .replace(/[’ʼ`´]/g, "'") // "L’étranger" = "L'étranger"
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(l'|le |la |les |un |une |the )/, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Nom de famille : "Dostoïevski, Fiodor" -> avant la virgule ; "Fiodor Dostoïevski" -> dernier mot ;
 * les initiales ne comptent pas ("Saint-Exupery A." -> saintexupery).
 */
const surname = (a?: string) => {
  if (a?.includes(",")) return norm(a.split(",")[0]);
  const parts = a?.trim().split(/\s+/).filter((p) => !/^\p{L}\.?$/u.test(p)) ?? [];
  return norm(parts.pop());
};

/** "Le Chien jaune - Edition Collector (French Edition)" -> "Le Chien jaune" */
const mainTitle = (t: string) => t.split(/\s[-:(\[]\s?|\s\/\s/)[0];

/** Debut de cle d'oeuvre pour un titre saisi : "Le Petit Prince" -> "petitprince". */
export const titleKey = (s: string) => norm(mainTitle(s));

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

/** Qualite d'une EDITION (pas de l'oeuvre) : laquelle montrer pour une oeuvre. */
export const editionQuality = (b: Book) =>
  (b.cover ? 8 : 0) +
  (isFrenchIsbn(b.isbn) ? 3 : b.isbn ? 1 : 0) +
  (b.publisher ? 1 : 0) +
  (KNOWN_PUBLISHER.test(b.publisher ?? "") ? 4 : 0) +
  (POOR_PUBLISHER.test(b.publisher ?? "") ? -6 : 0) +
  (b.language === "fr" ? 2 : 0);

/**
 * Fusionne deux fiches d'une meme oeuvre. Les champs d'edition (titre, editeur, ISBN, couverture,
 * pages) viennent en bloc de la meilleure edition, pour rester coherents ; l'autre comble les trous.
 * L'annee est la plus ancienne : celle de l'oeuvre (Candide : 1759), pas d'une reimpression.
 */
export function merge(a: Book, b: Book): Book {
  const [best, other] = editionQuality(b) > editionQuality(a) ? [b, a] : [a, b];
  const years = [a.year, b.year].filter((y): y is string => !!y && /^\d{4}/.test(y)).sort();
  return {
    ...best,
    id: a.id,
    authors: best.authors.length ? best.authors : other.authors,
    year: years[0] ?? best.year ?? other.year,
    publisher: best.publisher ?? other.publisher,
    isbn: best.isbn ?? other.isbn,
    cover: best.cover ?? other.cover,
    pages: best.pages ?? other.pages,
    language: best.language ?? other.language,
    description: (a.description?.length ?? 0) >= (b.description?.length ?? 0) ? (a.description ?? b.description) : b.description,
    editions: Math.max(a.editions ?? 0, b.editions ?? 0) || undefined,
    sources: [...new Set([...a.sources, ...b.sources])],
  };
}

/** Ouvrages SUR une oeuvre (etudes, fiches, editions annotees) : derriere l'oeuvre elle-meme. */
const DERIVED = new Set(["etude", "analyse", "commentaire", "commentaires", "fiche", "fiches", "profil", "resume",
  "explication", "dossier", "guide", "questionnaire", "bac", "parcours", "annotated", "notes", "study", "summary"]);

/**
 * Pertinence d'un livre pour une requete, commune au catalogue et a la recherche en direct.
 * "candide" -> Candide de Voltaire (titre exact, des centaines d'editions, couverture)
 * avant "Candide : fiche de lecture" ou un roman anglais qui contient "candide".
 */
export function relevance(b: Book, qWords: Set<string>, rank = 0): number {
  const tw = words(b.title);
  const derived = tw.some((w) => DERIVED.has(w)) && ![...qWords].some((w) => DERIVED.has(w));
  const french = b.language === "fr" || isFrenchIsbn(b.isbn);
  return (
    titleMatch(b, qWords) * 30 +
    Math.log2(1 + (b.editions ?? 0)) * 4 + // 1 edition : 4 ; 255 editions : 32
    (french ? 6 : b.language ? -8 : 0) +
    (b.cover ? 4 : 0) +
    (b.description ? 2 : 0) +
    (b.authors.length ? 2 : 0) +
    (b.sources.length - 1) * 3 + // confirme par plusieurs catalogues
    (derived ? -15 : 0) -
    rank * 0.3 // ordre d'origine (bm25, ou rang dans la source)
  );
}

type Opts = { timeoutMs?: number; retries?: number; only?: Source[] };

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
  const order = (["google", "openlibrary", "bnf"] as Source[]).filter((s) => !opts.only || opts.only.includes(s));
  const raw = await Promise.all(order.map((s) => withTimeout(s, q, opts)));
  return {
    books: fuse(raw.map((r) => r ?? []), q),
    // null = source en echec
    sources: Object.fromEntries(order.map((s, i) => [s, raw[i]?.length ?? null])) as Record<Source, number | null>,
  };
}

/** Fusionne des listes de resultats (meme ISBN ou meme oeuvre = une fiche) et les classe par pertinence. */
export function fuse(results: Book[][], q: string): Book[] {
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

  return [...byKey.values()]
    .sort((x, y) => relevance(y.book, qWords, y.rank) - relevance(x.book, qWords, x.rank))
    .map((x) => x.book)
    .slice(0, 30);
}

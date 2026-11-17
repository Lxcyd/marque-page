import { toIsbn13 } from "../isbn";
import type { Book } from "../types";

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

const all = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)</dc:${tag}>`, "g"))].map((m) =>
    decode(m[1]),
  );

/** "Camus, Albert (1913-1960). Auteur du texte" -> "Albert Camus" */
function cleanAuthor(raw: string): string {
  const name = raw.split(/\s*\(|\.\s/)[0].trim();
  const [last, first] = name.split(/,\s*/);
  return first ? `${first} ${last}` : last;
}

/**
 * Catalogue general de la BnF (SRU, sans cle) : le depot legal, donc la
 * reference pour l'edition francaise. Lent (souvent 5-25 s) : appele avec un
 * delai court, la recherche ne l'attend jamais au-dela.
 */
export async function searchBnf(q: string, signal: AbortSignal): Promise<Book[]> {
  const isbn = toIsbn13(q);
  // doctype "a" = texte imprime : filtre cote serveur, divise le temps de reponse (40 s -> 5 s mesure)
  const cql = isbn
    ? `bib.isbn all "${isbn}"`
    : `bib.anywhere all "${q.replace(/"/g, " ")}" and bib.doctype any "a"`;
  const url = new URL("https://catalogue.bnf.fr/api/SRU");
  url.search = new URLSearchParams({
    version: "1.2",
    operation: "searchRetrieve",
    query: cql,
    recordSchema: "dublincore",
    maximumRecords: "20",
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`bnf ${res.status}`);
  const xml = await res.text();
  const records = xml.split("<srw:record>").slice(1);
  return records.flatMap((rec) => {
    // Livres imprimes seulement (pas les disques, partitions, etc.)
    if (!all(rec, "type").some((t) => t === "texte imprimé")) return [];
    const [rawTitle] = all(rec, "title");
    if (!rawTitle) return [];
    const ark = rec.match(/<srw:recordIdentifier>([^<]+)</)?.[1] ?? rawTitle;
    const recIsbn = all(rec, "identifier")
      .map((i) => i.match(/^ISBN\s+([\dXx-]+)/)?.[1])
      .map(toIsbn13)
      .find(Boolean);
    const pages = all(rec, "format")[0]?.match(/(\d+)\s*p/)?.[1];
    return [
      {
        id: `bnf:${ark}`,
        title: rawTitle.split(" / ")[0].trim(),
        // ouvrages collectifs : le directeur est en "contributor", pas en "creator"
        authors: (all(rec, "creator").length ? all(rec, "creator") : all(rec, "contributor").slice(0, 2)).map(cleanAuthor),
        year: all(rec, "date")[0]?.match(/\d{4}/)?.[0],
        publisher: all(rec, "publisher")[0]?.replace(/\s*\(.*\)\s*$/, "").replace(/[[\]]/g, "").trim() || undefined,
        isbn: recIsbn,
        cover: recIsbn ? `https://covers.openlibrary.org/b/isbn/${recIsbn}-M.jpg?default=false` : undefined,
        pages: pages ? Number(pages) : undefined,
        language: all(rec, "language")[0] === "fre" ? "fr" : all(rec, "language")[0],
        sources: ["bnf"],
      },
    ];
  });
}

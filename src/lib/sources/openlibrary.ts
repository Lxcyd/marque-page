import { isFrenchIsbn, toIsbn13 } from "../isbn";
import { pickPublisher } from "../publishers";
import type { Book } from "../types";

type Doc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  publisher?: string[];
  number_of_pages_median?: number;
  language?: string[];
  edition_count?: number;
};

/** Open Library : rapide, sans cle, bonnes couvertures. */
export async function searchOpenLibrary(q: string, signal: AbortSignal): Promise<Book[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.search = new URLSearchParams({
    q: `${q} language:fre`, // oeuvres qui ont au moins une edition en francais
    lang: "fr", // titres d'edition francais quand ils existent
    limit: "20",
    fields:
      "key,title,author_name,first_publish_year,isbn,cover_i,publisher,number_of_pages_median,language,edition_count",
  }).toString();
  const res = await fetch(url, { signal, headers: { "User-Agent": "marque-page/0.1 (github.com/Lxcyd/marque-page)" } });
  if (!res.ok) throw new Error(`openlibrary ${res.status}`);
  const data = (await res.json()) as { docs: Doc[] };
  return data.docs.map((d) => {
    const isbns = (d.isbn ?? []).map(toIsbn13).filter((x): x is string => !!x);
    return {
      id: `openlibrary:${d.key}`,
      title: d.title,
      authors: d.author_name ?? [],
      year: d.first_publish_year?.toString(),
      publisher: pickPublisher(d.publisher), // la liste couvre toutes les editions de l'oeuvre
      isbn: isbns.find(isFrenchIsbn) ?? isbns[0],
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      pages: d.number_of_pages_median,
      language: d.language?.includes("fre") ? "fr" : d.language?.[0],
      editions: d.edition_count,
      sources: ["openlibrary"],
    };
  });
}

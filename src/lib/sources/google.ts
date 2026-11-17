import { toIsbn13 } from "../isbn";
import type { Book } from "../types";

type Volume = {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    language?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

/** Google Books : meilleure couverture des titres recents. Necessite une cle (quota anonyme = 0). */
export async function searchGoogle(q: string, signal: AbortSignal): Promise<Book[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  const isbn = toIsbn13(q);
  url.search = new URLSearchParams({
    q: isbn ? `isbn:${isbn}` : q,
    langRestrict: "fr",
    printType: "books",
    maxResults: "20",
    key,
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = (await res.json()) as { items?: Volume[] };
  return (data.items ?? []).flatMap(({ id, volumeInfo: v }) => {
    if (!v.title) return [];
    const ids = v.industryIdentifiers ?? [];
    const isbn = toIsbn13(
      ids.find((i) => i.type === "ISBN_13")?.identifier ??
        ids.find((i) => i.type === "ISBN_10")?.identifier,
    );
    const cover = (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail)
      ?.replace("http://", "https://")
      .replace("&edge=curl", "");
    return [
      {
        id: `google:${id}`,
        title: v.subtitle ? `${v.title} : ${v.subtitle}` : v.title,
        authors: v.authors ?? [],
        year: v.publishedDate?.slice(0, 4),
        publisher: v.publisher,
        isbn,
        cover,
        pages: v.pageCount || undefined,
        language: v.language,
        description: v.description,
        sources: ["google"],
      },
    ];
  });
}

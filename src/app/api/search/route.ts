import { after } from "next/server";
import { searchCatalog, upsertBooks } from "@/lib/catalog";
import { searchBooks, titleMatch, words, workKey } from "@/lib/search";

/**
 * Le catalogue repond toujours en premier ; les API externes ne bloquent la reponse
 * que si le catalogue n'a RIEN, et alors avec un delai court. Tout ce qu'elles
 * trouvent est enregistre APRES la reponse (after), pour la recherche suivante.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (q.length < 2) return Response.json({ books: [], from: "none" });

  const local = await searchCatalog(q).catch((e) => {
    console.warn("[search] catalogue:", e.message);
    return [];
  });

  // Rafraichit le catalogue en arriere-plan (delais longs : rien n'attend).
  const refresh = () =>
    after(async () => {
      const { books } = await searchBooks(q, { timeoutMs: 15000 });
      await upsertBooks(books).catch((e) => console.warn("[search] upsert:", e.message));
    });

  if (local.length) {
    const qWords = new Set(words(q));
    // Pas de titre exact : on complete le catalogue pour la prochaine fois.
    if (!local.some((b) => titleMatch(b, qWords) === 1)) refresh();
    return Response.json({ books: local, from: "catalog" }, { headers: cache });
  }

  // Catalogue vide : Google seul en direct (0,3-0,9 s mesure ; Open Library 2-21 s,
  // BnF 4-40 s). Le passage complet des trois sources se fait apres la reponse.
  const live = await searchBooks(q, { timeoutMs: 1500, only: ["google"] });
  refresh();
  const books = live.books.map((b) => ({ ...b, id: workKey(b) }));
  return Response.json({ books, from: "live", sources: live.sources }, { headers: cache });
}

// Cache CDN 1 jour, servi perime 1 semaine.
const cache = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

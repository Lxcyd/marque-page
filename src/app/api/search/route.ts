import { searchCatalog, upsertBooks } from "@/lib/catalog";
import { searchBooks, titleMatch, words, workKey } from "@/lib/search";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (q.length < 2) return Response.json({ books: [], from: "none" });

  // 1. Catalogue local : rapide et independant des API externes.
  const local = await searchCatalog(q).catch((e) => {
    console.warn("[search] catalogue:", e.message);
    return [];
  });
  const qWords = new Set(words(q));
  if (local.some((b) => titleMatch(b, qWords) === 1)) {
    return Response.json({ books: local, from: "catalog" }, { headers: cache });
  }

  // 2. Sinon, sources en direct ; ce qu'on trouve entre dans le catalogue.
  const live = await searchBooks(q);
  await upsertBooks(live.books).catch((e) => console.warn("[search] upsert:", e.message));
  const seen = new Set(live.books.map(workKey));
  const books = [...live.books, ...local.filter((b) => !seen.has(workKey(b)))].map((b) => ({ ...b, id: workKey(b) }));
  return Response.json({ books, from: "live", sources: live.sources }, { headers: cache });
}

// Cache CDN 1 jour, servi perime 1 semaine.
const cache = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

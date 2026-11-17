import { after } from "next/server";
import { searchCatalog, upsertBooks } from "@/lib/catalog";
import { fuse, searchBooks, titleMatch, words, workKey } from "@/lib/search";

/**
 * Le catalogue repond en premier. S'il a un titre exact, c'est fini (~0,1 s).
 * Sinon on complete en direct avec Google seul (0,3-0,9 s mesure ; Open Library 2-21 s,
 * BnF 4-40 s), et les trois sources passent APRES la reponse pour enrichir le catalogue.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (q.length < 2) return Response.json({ books: [], from: "none" });

  const local = await searchCatalog(q).catch((e) => {
    console.warn("[search] catalogue:", e.message);
    return [];
  });
  const qWords = new Set(words(q));
  if (local.some((b) => titleMatch(b, qWords) === 1)) {
    return Response.json({ books: local, from: "catalog" }, { headers: cache });
  }

  // Pas de titre exact en base ("l'etranger camus" -> seulement une etude) : complement en direct.
  let live = await searchBooks(q, { timeoutMs: 1500, only: ["google"] });
  // Quota Google epuise (1 000/jour pour tout le projet) et rien en base : repli Open Library.
  if (live.sources.google === null && !local.length) {
    live = await searchBooks(q, { timeoutMs: 2000, only: ["openlibrary"] });
  }
  after(async () => {
    const { books } = await searchBooks(q, { timeoutMs: 15000 });
    await upsertBooks(books).catch((e) => console.warn("[search] upsert:", e.message));
  });

  const books = fuse([local, live.books], q).map((b) => ({ ...b, id: workKey(b) }));
  // Un resultat en direct est provisoire (le catalogue se remplit derriere) : cache court,
  // et jamais de cache pour une reponse vide (sinon "Aucun livre trouve" reste servi 1 jour).
  return Response.json(
    { books, from: local.length ? "mixed" : "live", sources: live.sources },
    { headers: books.length ? { "Cache-Control": "public, s-maxage=300" } : { "Cache-Control": "no-store" } },
  );
}

// Resultat du catalogue : cache CDN 1 jour, servi perime 1 semaine.
const cache = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

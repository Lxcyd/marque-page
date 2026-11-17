import { searchBooks } from "@/lib/search";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ books: [], sources: {} });

  const data = await searchBooks(q.slice(0, 200));
  return Response.json(data, {
    // Les catalogues changent peu : cache CDN 1 jour, servi perime 1 semaine.
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}

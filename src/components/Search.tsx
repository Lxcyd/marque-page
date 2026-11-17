"use client";

import { useEffect, useState } from "react";
import { useLibrary } from "@/lib/library";
import type { Book } from "@/lib/types";
import { Cover } from "./Cover";

export function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Book[] | null>(null);
  const [loading, setLoading] = useState(false);
  const lib = useLibrary();

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        setResults((await res.json()).books);
      } catch {
        /* requete remplacee par une plus recente */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const open = q.trim().length >= 2;

  return (
    <section>
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 2) setResults(null);
          }}
          placeholder="Rechercher un titre, un auteur, un ISBN…"
          className="w-full rounded-full border border-stone-200 bg-white px-5 py-3 text-[15px] shadow-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400"
        />
        {loading && (
          <span className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        )}
      </div>

      {open && results && (
        <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {results.length === 0 && !loading && (
            <li className="p-5 text-sm text-stone-500">Aucun livre trouvé.</li>
          )}
          {results.map((b) => {
            const added = lib.has(b.id);
            return (
              <li key={b.id} className="flex items-center gap-4 p-3">
                <Cover src={b.cover} title={b.title} className="w-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[15px] text-stone-900">{b.title}</p>
                  <p className="truncate text-sm text-stone-500">
                    {[b.authors.join(", "), b.publisher, b.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => lib.add(b)}
                  className="shrink-0 rounded-full bg-stone-900 px-4 py-1.5 text-sm text-white transition hover:bg-stone-700 disabled:bg-stone-100 disabled:text-stone-400"
                >
                  {added ? "Ajouté" : "Ajouter"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

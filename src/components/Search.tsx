"use client";

import { useEffect, useRef, useState } from "react";
import { useLibrary } from "@/lib/library";
import type { Book } from "@/lib/types";
import { Cover } from "./Cover";

type Res = { books: Book[]; exact: boolean };

/** Reponses deja recues (effacer une lettre reaffiche les suggestions sans requete). */
const cache = new Map<string, Res>();

/** Suggestions (catalogue seul) a chaque frappe ; recherche complete apres une pause ou sur Entree. */
const SUGGEST_MS = 120;
const FULL_MS = 600;

async function fetchRes(query: string, mode: "suggest" | "full", signal: AbortSignal): Promise<Res> {
  const key = `${mode}:${query.toLowerCase()}`;
  const hit = cache.get(key) ?? (mode === "suggest" ? cache.get(`full:${query.toLowerCase()}`) : undefined);
  if (hit) return hit;
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${mode === "suggest" ? "&mode=suggest" : ""}`, { signal });
  const j = await res.json();
  // une recherche complete a tout interroge : rien de plus a attendre
  const r = { books: j.books as Book[], exact: mode === "full" || !!j.exact };
  cache.set(key, r);
  return r;
}

export function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Book[] | null>(null);
  const [settled, setSettled] = useState(false); // vrai quand plus rien n'est attendu pour q
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(0);
  const lastSubmit = useRef(0);
  const lib = useLibrary();

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const now = submitted !== lastSubmit.current; // Entree : recherche complete tout de suite
    lastSubmit.current = submitted;
    let full: ReturnType<typeof setTimeout> | undefined;

    const show = (r: Res) => {
      if (ctrl.signal.aborted) return;
      setResults(r.books);
      setSettled(r.exact);
      setLoading(!r.exact);
    };
    const runFull = () =>
      fetchRes(query, "full", ctrl.signal)
        .then(show)
        .catch(() => {});

    const cached = cache.has(`suggest:${query.toLowerCase()}`) || cache.has(`full:${query.toLowerCase()}`);
    const t = setTimeout(async () => {
      setLoading(true);
      if (now) return runFull();
      try {
        const s = await fetchRes(query, "suggest", ctrl.signal);
        show(s);
        if (!s.exact) full = setTimeout(runFull, FULL_MS);
      } catch {
        /* frappe suivante : requete annulee */
      }
    }, cached || now ? 0 : SUGGEST_MS);

    return () => {
      clearTimeout(t);
      clearTimeout(full);
      ctrl.abort();
    };
  }, [q, submitted]);

  const open = q.trim().length >= 2;

  return (
    <section>
      <form
        className="relative"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted((n) => n + 1);
        }}
      >
        <input
          type="search"
          value={q}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 2) {
              setResults(null);
              setLoading(false);
            }
          }}
          placeholder="Rechercher un titre, un auteur, un ISBN…"
          className="w-full rounded-full border border-stone-200 bg-white px-5 py-3 text-[15px] shadow-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400"
        />
        {loading && open && (
          <span className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        )}
      </form>

      {open && results && (results.length > 0 || settled) && (
        <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {results.length === 0 && <li className="p-5 text-sm text-stone-500">Aucun livre trouvé.</li>}
          {results.map((b, i) => {
            const added = lib.has(b.id);
            return (
              <li key={b.id} className="flex items-center gap-4 p-3">
                <Cover src={b.cover} title={b.title} width={44} priority={i < 6} className="w-11 shrink-0" />
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

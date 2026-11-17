"use client";

import { useState } from "react";
import { useLibrary } from "@/lib/library";
import type { Status } from "@/lib/types";
import { Cover } from "./Cover";
import { Stars } from "./Stars";

const TABS: { id: Status; label: string }[] = [
  { id: "reading", label: "En cours" },
  { id: "toRead", label: "À lire" },
  { id: "read", label: "Lus" },
];

export function Library() {
  const lib = useLibrary();
  const [tab, setTab] = useState<Status>("toRead");
  const shown = lib.entries.filter((e) => e.status === tab);

  return (
    <section className="mt-12">
      <nav className="flex gap-6 border-b border-stone-200">
        {TABS.map((t) => {
          const n = lib.entries.filter((e) => e.status === t.id).length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 pb-3 text-sm transition ${
                tab === t.id ? "border-stone-900 text-stone-900" : "border-transparent text-stone-400 hover:text-stone-600"
              }`}
            >
              {t.label} <span className="ml-1 text-stone-400">{n}</span>
            </button>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-stone-400">
          Rien ici pour l’instant. Cherchez un livre ci-dessus pour l’ajouter.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shown.map((e, i) => (
            <li key={e.id} className="group">
              <Cover
                src={e.cover}
                title={e.title}
                width={200}
                priority={i < 4}
                className="transition group-hover:-translate-y-0.5 group-hover:shadow-md"
              />
              <p className="mt-2 line-clamp-2 font-serif text-sm leading-snug text-stone-900">{e.title}</p>
              <p className="truncate text-xs text-stone-500">{e.authors.join(", ")}</p>
              <div className="mt-1.5 flex items-center justify-between">
                {e.status === "read" ? (
                  <Stars value={e.rating} onChange={(rating) => lib.update(e.id, { rating })} />
                ) : (
                  <span />
                )}
                <select
                  value={e.status}
                  onChange={(ev) =>
                    ev.target.value === "remove"
                      ? lib.remove(e.id)
                      : lib.update(e.id, { status: ev.target.value as Status })
                  }
                  className="cursor-pointer rounded bg-transparent text-xs text-stone-400 outline-none hover:text-stone-700"
                  aria-label="Changer le statut"
                >
                  {TABS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                  <option value="remove">Retirer</option>
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

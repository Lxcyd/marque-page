"use client";

export function Stars({ value = 0, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="flex" aria-label={`Note : ${value || "aucune"} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? undefined : n)}
          className={`px-px text-sm leading-none transition-colors ${n <= value ? "text-amber-500" : "text-stone-300 hover:text-amber-300"}`}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

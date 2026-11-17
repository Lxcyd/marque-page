"use client";

import { useState } from "react";

/** Couverture, ou une tranche coloree avec le titre si aucune image ne charge. */
export function Cover({ src, title, className = "" }: { src?: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const hue = [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);

  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-md bg-stone-200 shadow-sm ${className}`}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- couvertures de domaines multiples
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full items-end p-2 font-serif text-[11px] leading-tight text-white/90"
          style={{ background: `hsl(${hue} 30% 38%)` }}
        >
          {title}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { coverSrcSet, coverUrl } from "@/lib/image";

/**
 * Couverture redimensionnee (wsrv.nl), en fondu une fois chargee sur un fond de la couleur
 * du livre ; une tranche coloree avec le titre si aucune image ne charge.
 * `width` = largeur affichee en px CSS (l'image est demandee a cette taille, et 2x).
 */
export function Cover({
  src,
  title,
  width,
  priority = false,
  className = "",
}: {
  src?: string;
  title: string;
  width: number;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const hue = [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  const bg = `hsl(${hue} 30% 38%)`;

  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-md shadow-sm ${className}`} style={{ background: bg }}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- deja redimensionnee par wsrv.nl
        <img
          src={coverUrl(src, width)}
          srcSet={coverSrcSet(src, width)}
          alt=""
          width={width}
          height={Math.round(width * 1.5)}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <div className="flex h-full items-end p-2 font-serif text-[11px] leading-tight text-white/90">{title}</div>
      )}
    </div>
  );
}

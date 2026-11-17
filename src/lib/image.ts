/**
 * Couvertures via wsrv.nl (proxy d'images gratuit derriere Cloudflare), a la taille affichee.
 * Mesure du 17/11/2026 : couverture Open Library en direct 1,6-2,4 s A CHAQUE FOIS
 * (2 redirections vers archive.org, 18 Ko) ; via wsrv 1,8 s la 1re fois puis 0,09 s
 * pour tout le monde, en WebP de 6 Ko.
 */
export function coverUrl(src: string, width: number): string {
  const u = src.replace(/^https?:\/\//, "");
  return `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=${width}&output=webp&q=78&we`;
}

/** srcSet 1x/2x pour une largeur CSS donnee (ecrans haute densite). */
export const coverSrcSet = (src: string, cssWidth: number) =>
  `${coverUrl(src, cssWidth)} 1x, ${coverUrl(src, cssWidth * 2)} 2x`;

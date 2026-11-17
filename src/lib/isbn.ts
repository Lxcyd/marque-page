/** Ramene un ISBN-10 ou 13 (avec ou sans tirets) a un ISBN-13, sinon undefined. */
export function toIsbn13(raw?: string): string | undefined {
  if (!raw) return;
  const s = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (s.length === 13 && /^97[89]\d{10}$/.test(s)) return s;
  if (s.length !== 10) return;
  const core = "978" + s.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 ? 3 : 1);
  return core + ((10 - (sum % 10)) % 10);
}

/** Les ISBN francophones commencent par 978-2 / 979-1. */
export const isFrenchIsbn = (isbn?: string) =>
  !!isbn && (isbn.startsWith("9782") || isbn.startsWith("9791"));

// Regroupe les editions francaises d'Open Library en oeuvres (meme cle que le catalogue :
// titre principal + nom de l'auteur) et ecrit data/ol-works-fr.jsonl, pret a importer.
// Entrees : data/ol-editions-fr.jsonl (ol-editions-fr.mjs), data/ol-authors.tsv (ol-authors.mjs).
// Usage : npx tsx tools/import/ol-build.mts
import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { isFrenchIsbn, toIsbn13 } from "../../src/lib/isbn";
import { KNOWN_PUBLISHER } from "../../src/lib/publishers";
import { editionQuality, merge, workKey } from "../../src/lib/search";
import type { Book } from "../../src/lib/types";

const data = (f: string) => new URL(`../../data/${f}`, import.meta.url);
const lines = (f: string) => createInterface({ input: createReadStream(data(f)), crlfDelay: Infinity });

type Ed = {
  key: string; work?: string; title?: string; authors: string[]; by?: string; isbn?: string;
  publisher?: string; date?: string; pages?: number; cover?: number; description?: string;
};

// 1. Les cles d'auteur utiles, puis leurs noms (14 M d'auteurs : on ne garde que ceux-la).
const editions: Ed[] = [];
const needed = new Set<string>();
for await (const l of lines("ol-editions-fr.jsonl")) {
  const e: Ed = JSON.parse(l);
  if (!e.title?.trim()) continue;
  editions.push(e);
  e.authors.forEach((a) => needed.add(a));
}
const names = new Map<string, string>();
for await (const l of lines("ol-authors.tsv")) {
  const i = l.indexOf("\t");
  const k = l.slice(0, i);
  if (needed.has(k)) names.set(k, l.slice(i + 1));
}
console.error(`${editions.length.toLocaleString()} editions, ${names.size.toLocaleString()}/${needed.size.toLocaleString()} auteurs resolus`);

// "par Victor Hugo ; preface de X" -> "Victor Hugo"
const fromBy = (by?: string) =>
  by?.replace(/^\s*(par|de|by)\s+/i, "").split(/\s*[;[]\s*|\s+et\s+/)[0].replace(/[.,\s]+$/, "").trim() || undefined;

const toBook = (e: Ed): Book | null => {
  const authors = e.authors.map((k) => names.get(k)).filter((n): n is string => !!n);
  if (!authors.length) {
    const b = fromBy(e.by);
    if (b && /^\p{Lu}/u.test(b) && b.length < 60) authors.push(b);
  }
  if (!authors.length) return null; // sans auteur : bruit (actes, rapports...) et inclassable
  const isbn = e.isbn ? (toIsbn13(e.isbn) ?? undefined) : undefined;
  return {
    id: "",
    title: e.title!.replace(/\s+/g, " ").trim(),
    authors: authors.slice(0, 4),
    year: e.date?.match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1],
    publisher: e.publisher?.trim() || undefined,
    isbn,
    cover: e.cover ? `https://covers.openlibrary.org/b/id/${e.cover}-M.jpg` : undefined,
    pages: e.pages && e.pages > 0 && e.pages < 10000 ? e.pages : undefined,
    language: "fr",
    description: e.description?.trim() || undefined,
    sources: ["openlibrary"],
  };
};

// Meilleure edition d'abord (merge garde aussi la meilleure, mais l'ordre departage les egalites).
const quality = (b: Book) => editionQuality(b) + (b.year ? Number(b.year) / 10000 : 0); // a egalite, la plus recente

const groups = new Map<string, Book[]>();
let noAuthor = 0;
for (const e of editions) {
  const b = toBook(e);
  if (!b) { noAuthor++; continue; }
  const k = workKey(b);
  const g = groups.get(k);
  g ? g.push(b) : groups.set(k, [b]);
}

// "Utile" : un livre qu'un lecteur peut chercher. Mesure sur 400 000 oeuvres : 41 % gardees.
// Ecarte : auteur = organisme (colloque, ministere...), actes/rapports, et les fiches
// sans couverture, ni ISBN francais, ni seconde edition, ni editeur connu.
const ORG = /colloque|congr[eè]s|universit|minist[eè]re|institut|soci[eé]t[eé]|association|commission|conseil|centre |comit[eé]|symposium|s[eé]minaire|journ[eé]es|conf[eé]rence|office|direction|acad[eé]mie|organisation|union|f[eé]d[eé]ration|bureau|agence|service|laboratoire/i;
const JUNK = /^(actes|rapport|compte rendu|bulletin|catalogue|annuaire|proc[eè]s-verbal|th[eè]se|carte|plan )/i;
const useful = (w: Book) =>
  !ORG.test(w.authors[0]) && !JUNK.test(w.title) &&
  !!(w.cover || isFrenchIsbn(w.isbn) || (w.editions ?? 0) >= 2 || KNOWN_PUBLISHER.test(w.publisher ?? ""));

const s = { works: 0, dropped: 0, cover: 0, description: 0, isbn: 0, isbnFr: 0, publisher: 0, year: 0, pages: 0, multi: 0 };
const out: string[] = [];
for (const [id, g] of groups) {
  g.sort((a, b) => quality(b) - quality(a));
  const w = { ...g.reduce(merge), id, editions: g.length };
  if (!useful(w)) { s.dropped++; continue; }
  s.works++;
  if (g.length > 1) s.multi++;
  if (w.cover) s.cover++;
  if (w.description) s.description++;
  if (w.isbn) s.isbn++;
  if (isFrenchIsbn(w.isbn)) s.isbnFr++;
  if (w.publisher) s.publisher++;
  if (w.year) s.year++;
  if (w.pages) s.pages++;
  out.push(JSON.stringify(w));
}
writeFileSync(data("ol-works-fr.jsonl"), out.join("\n") + "\n");
const pct = (n: number) => `${((100 * n) / s.works).toFixed(0)} %`;
console.log(JSON.stringify({ ...s, noAuthor }));
console.log(
  `${s.works.toLocaleString()} oeuvres gardees, ${s.dropped.toLocaleString()} ecartees (${noAuthor.toLocaleString()} editions sans auteur) | ` +
    `couverture ${pct(s.cover)} · synopsis ${pct(s.description)} · ISBN ${pct(s.isbn)} (FR ${pct(s.isbnFr)}) · ` +
    `editeur ${pct(s.publisher)} · annee ${pct(s.year)} · pages ${pct(s.pages)} · plusieurs editions ${pct(s.multi)}`,
);

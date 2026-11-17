-- Catalogue : une ligne par oeuvre (les editions d'un meme titre/auteur sont fusionnees).
CREATE TABLE IF NOT EXISTS books (
  id           TEXT PRIMARY KEY,           -- cle d'oeuvre : "titrenormalise|nom"
  title        TEXT NOT NULL,
  authors      TEXT NOT NULL DEFAULT '[]', -- JSON
  year         TEXT,
  publisher    TEXT,
  isbn         TEXT,
  cover        TEXT,
  pages        INTEGER,
  language     TEXT,
  description  TEXT,
  sources      TEXT NOT NULL DEFAULT '[]', -- JSON : google, openlibrary, bnf...
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  enrich_tries INTEGER NOT NULL DEFAULT 0, -- tentatives d'enrichissement (couverture / synopsis)
  enriched_at  INTEGER
);

CREATE INDEX IF NOT EXISTS books_isbn ON books(isbn);

-- File d'enrichissement : seulement les livres incomplets.
CREATE INDEX IF NOT EXISTS books_to_enrich ON books(enriched_at)
  WHERE cover IS NULL OR description IS NULL;

-- Recherche plein texte, accents ignores. Le texte est pre-normalise (oe/ae) a l'ecriture.
CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
  id UNINDEXED,
  text,
  tokenize = 'unicode61 remove_diacritics 2'
);

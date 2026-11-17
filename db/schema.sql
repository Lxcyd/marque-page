-- Catalogue : une ligne par oeuvre (les editions d'un meme titre/auteur sont fusionnees).
-- seq relie la ligne a l'index plein texte : supprimer/remplacer une entree FTS par rowid
-- coute 1 ligne lue, la ou un DELETE par colonne UNINDEXED parcourait tout l'index.
CREATE TABLE IF NOT EXISTS books (
  seq          INTEGER PRIMARY KEY,
  id           TEXT NOT NULL UNIQUE,       -- cle d'oeuvre : "titrenormalise|nom"
  title        TEXT NOT NULL,
  authors      TEXT NOT NULL DEFAULT '[]', -- JSON
  year         TEXT,
  publisher    TEXT,
  isbn         TEXT,
  cover        TEXT,
  pages        INTEGER,
  language     TEXT,
  description  TEXT,
  editions     INTEGER NOT NULL DEFAULT 0,  -- nb d'editions connues : notoriete (classement)
  sources     TEXT NOT NULL DEFAULT '[]', -- JSON : google, openlibrary, bnf...
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  enrich_tries INTEGER NOT NULL DEFAULT 0, -- tentatives d'enrichissement (couverture / synopsis)
  enriched_at  INTEGER NOT NULL DEFAULT 0  -- 0 = jamais tente
);

CREATE INDEX IF NOT EXISTS books_isbn ON books(isbn);

-- File d'enrichissement : seulement les livres incomplets et encore a retenter.
-- La requete de tools/db/enrich.mts doit reprendre EXACTEMENT cette condition.
CREATE INDEX IF NOT EXISTS books_to_enrich ON books(enriched_at)
  WHERE (cover IS NULL OR description IS NULL) AND isbn IS NOT NULL AND enrich_tries < 5;

-- Recherche plein texte, accents ignores ; rowid = books.seq.
-- Le texte est pre-normalise (oe/ae) a l'ecriture.
CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
  text,
  tokenize = 'unicode61 remove_diacritics 2'
);

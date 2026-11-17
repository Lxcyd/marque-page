# Marque-page

Suivi de lectures personnel : à lire, en cours, lus, avec une note.
Recherche pensée d'abord pour **les livres français**.

## Recherche : trois catalogues fusionnés

`GET /api/search?q=…` interroge en parallèle :

| Source | Pourquoi | Limite |
| --- | --- | --- |
| [Google Books](https://developers.google.com/books) (`langRestrict=fr`) | meilleure couverture des parutions récentes, couvertures, résumés | clé API obligatoire (`GOOGLE_BOOKS_API_KEY`) |
| [Open Library](https://openlibrary.org/developers/api) | rapide, sans clé, bonnes couvertures | catalogue français incomplet |
| [BnF — catalogue général (SRU)](https://api.bnf.fr/fr/api-sru-catalogue-general) | dépôt légal : quasiment tout ce qui est publié en France ; exact sur l'ISBN | lent (4-40 s), pertinence faible ; coupé à 8 s |

Les résultats sont fusionnés par ISBN, puis par titre + nom d'auteur (les
éditions d'une même œuvre sont regroupées), et triés selon la correspondance du
titre, le nombre de catalogues qui confirment le livre, la langue française et
la présence d'une couverture. Réponses mises en cache CDN 24 h.

Code : [src/lib/search.ts](src/lib/search.ts), une source par fichier sous
[src/lib/sources/](src/lib/sources/).

## Démarrer

```bash
cp .env.example .env.local   # optionnel : clé Google Books
npm install
npm run dev
```

## État

- v1 : la liste est stockée dans le navigateur (`localStorage`).
- À venir : comptes et base de données, page détail d'un livre, import
  Babelio / Goodreads.

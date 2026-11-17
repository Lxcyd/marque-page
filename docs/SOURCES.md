# Sources de données — étude du 17/11/2026

Chaque source a été testée par un vrai appel (temps mesurés depuis un poste en France).

## Intégrées

| Source | Mesure | Rôle |
| --- | --- | --- |
| Open Library | ~0,3 s, sans clé | recherche, couvertures |
| BnF catalogue général (SRU) | 4-40 s, sans clé | dépôt légal français, exact par ISBN ; coupé à 8 s |
| Google Books | clé API requise (quota anonyme = 0) | nouveautés, résumés |

## À intégrer (retenues)

| Source | Mesure | Pourquoi |
| --- | --- | --- |
| **Wikidata** (SPARQL / wbsearchentities) | 0,3-4 s | niveau *œuvre* : roman, **nouvelle** (P7937 = Q49084 : 1 058 nouvelles FR typées), poème, pièce ; 39 545 œuvres littéraires FR ; lien Wikisource |
| **Wikisource FR** (API MediaWiki) | 0,3 s | texte intégral libre ; EPUB via `ws-export.wmcloud.org/?lang=fr&page=<titre>` |
| **Wikipédia FR** | non testé | résumés d'œuvres et d'auteurs |
| **Inventaire.io** | ~3 s | projet français adossé à Wikidata, renvoie nouvelles + recueils avec couvertures (la recherche par ISBN testée a renvoyé vide) |
| **Sudoc / ABES** (SRU) | 0,2 s | catalogue des bibliothèques universitaires françaises, bien plus rapide que la BnF ; UNIMARC |
| **data.bnf.fr** (SPARQL) | 3,4 s | 1,9 M œuvres regroupant leurs éditions, auteurs ; Licence ouverte |
| **BnF — dépôt légal mensuel** (data.gouv.fr) | jeu de données | nouvelles parutions en France chaque mois |
| **Ebooks libres et gratuits** (OPDS `ebooksgratuits.com/opds/`) | 0,6 s | ~3 200 EPUB gratuits en français |
| **Bibliothèque numérique romande** (OPDS `ebooks-bnr.com/opds/`) | 5,5 s | ~1 500 EPUB, usage non commercial |

## À retenter

- **Gallica** (SRU + OPDS) : injoignable le jour du test (DNS / délai) ; domaine public, EPUB.
- **Gutendex / Gutenberg OPDS** : 3 délais dépassés, OPDS Gutenberg « en maintenance » (503).
- **noslivres.net** : agrégateur ~26 000 livres libres FR ; la page cite OPDS/CSV mais aucun lien trouvé.
- **BAnQ** (Données Québec) : CSV « Documents publiés au Québec », pas d'API en direct.

## Écartées

| Source | Raison |
| --- | --- |
| Penguin Random House | API injoignable ; catalogue US anglophone |
| Crossref | fonctionne (1 s) mais ouvrages universitaires (OUP, Routledge) |
| British National Bibliography | britannique, sans HTTPS |
| Wolne Lektury | polonais |
| PoetryDB | anglais seulement (Baudelaire = 404) |
| Ganjoor, Wizard World, API religieuses | hors sujet ; les textes religieux sont déjà au catalogue comme livres |
| Electre, Dilicom | professionnelles, sous contrat |
| ISBNdb, MetasBooks | payantes |
| Babelio, Fnac, Decitre | aucune API ; le scraping de Babelio fait bannir l'IP |

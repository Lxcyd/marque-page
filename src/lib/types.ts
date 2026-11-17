export type Source = "google" | "bnf" | "openlibrary";

/** Un livre tel que renvoye par la recherche (toutes sources fusionnees). */
export type Book = {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  publisher?: string;
  isbn?: string;
  cover?: string;
  pages?: number;
  language?: string;
  description?: string;
  /** Nombre d'editions connues (Open Library) : signal de notoriete pour le classement. */
  editions?: number;
  sources: Source[];
};

export type Status = "toRead" | "reading" | "read";

/** Un livre dans la liste personnelle. */
export type ListEntry = Book & {
  status: Status;
  rating?: number; // 1-5
  addedAt: number;
};

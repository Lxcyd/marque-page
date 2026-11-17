"use client";

import { useSyncExternalStore } from "react";
import type { Book, ListEntry, Status } from "./types";

// Stockage local pour la v1 ; a remplacer par une base + comptes.
const KEY = "book-list:v1";
const EMPTY: ListEntry[] = [];
let cache: ListEntry[] | null = null;
const listeners = new Set<() => void>();

function read(): ListEntry[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(next: ListEntry[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLibrary() {
  const entries = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    entries,
    has: (id: string) => entries.some((e) => e.id === id),
    add: (book: Book, status: Status = "toRead") =>
      write([{ ...book, status, addedAt: Date.now() }, ...read().filter((e) => e.id !== book.id)]),
    update: (id: string, patch: Partial<ListEntry>) =>
      write(read().map((e) => (e.id === id ? { ...e, ...patch } : e))),
    remove: (id: string) => write(read().filter((e) => e.id !== id)),
  };
}

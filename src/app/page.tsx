import { Library } from "@/components/Library";
import { Search } from "@/components/Search";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight text-stone-900">Ma bibliothèque</h1>
        <p className="mt-2 text-sm text-stone-500">Vos lectures, à lire, en cours et terminées.</p>
      </header>
      <Search />
      <Library />
    </main>
  );
}

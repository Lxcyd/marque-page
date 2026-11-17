import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";
import { preconnect } from "react-dom";
import "./globals.css";

const sans = Geist({ variable: "--font-geist", subsets: ["latin"] });
const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Marque-page",
  description: "Suivez vos lectures : à lire, en cours, lus.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // toutes les couvertures passent par wsrv.nl : connexion TLS ouverte des le chargement
  preconnect("https://wsrv.nl");
  return (
    <html lang="fr" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

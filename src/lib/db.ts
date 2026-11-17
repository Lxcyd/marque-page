import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

/** Client Turso, ou null si la base n'est pas configuree (la recherche reste en direct). */
export function db(): Client | null {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

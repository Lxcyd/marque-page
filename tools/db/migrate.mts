// Applique db/schema.sql (idempotent). Usage : npx tsx --env-file=.env.local tools/db/migrate.mts
import { readFileSync } from "node:fs";
import { db } from "../../src/lib/db";

const c = db();
if (!c) throw new Error("TURSO_DATABASE_URL manquant");
await c.executeMultiple(readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8"));
const { rows } = await c.execute("SELECT name FROM sqlite_master WHERE type IN ('table','index') ORDER BY name");
console.log(rows.map((r) => r.name).join(", "));

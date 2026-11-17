// Cout EXACT d'une requete : rows_read tel que Turso le facture (pipeline Hrana),
// ce que @libsql/client n'expose pas. Importe par query-cost.mts.
export async function queryCost(sql: string, args: (string | number)[] = []) {
  const base = process.env.TURSO_DATABASE_URL!.replace(/^libsql:/, "https:");
  const arg = (v: string | number) =>
    typeof v === "number" ? { type: "integer", value: String(v) } : { type: "text", value: v };
  const r = await fetch(`${base}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql, args: args.map(arg) } }, { type: "close" }],
    }),
  });
  const res = (await r.json()).results[0];
  if (res.type !== "ok") throw new Error(res.error.message);
  return { rows: res.response.result.rows.length as number, rowsRead: res.response.result.rows_read as number };
}

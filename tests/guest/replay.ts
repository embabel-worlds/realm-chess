/*
 * The host's rule for publishing a dispatch that lost a race, as tests can check it: when
 * another dispatch published first, the host runs this one's writes again on the newer database
 * only if every write is a keyed upsert (INSERT OR REPLACE, REPLACE, or INSERT ... ON CONFLICT ...
 * DO UPDATE) and the dispatch read no table it writes. Otherwise it refuses the publish and every
 * write of the dispatch is lost. Like the host, this reads SQL conservatively: a name anywhere
 * after a statement's first FROM counts as read, and string literals are skipped.
 */

const withoutLiterals = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''");
const words = (sql: string): string[] => [...(withoutLiterals(sql).toUpperCase().match(/[A-Z_][A-Z0-9_]*/g) ?? [])];

/** The table a keyed upsert writes, or null when the statement writes some other way. */
function upsertTarget(sql: string): string | null {
  const w = words(sql);
  if (w[0] === "REPLACE" && w[1] === "INTO") return w[2].toLowerCase();
  if (w[0] !== "INSERT") return null;
  if (w[1] === "OR" && w[2] === "REPLACE" && w[3] === "INTO") return w[4].toLowerCase();
  const conflict = w.findIndex((x, i) => x === "ON" && w[i + 1] === "CONFLICT");
  if (w[1] === "INTO" && conflict > 0 && w.slice(conflict).join(" ").includes("DO UPDATE")) return w[2].toLowerCase();
  return null;
}

const isRead = (sql: string) => ["SELECT", "VALUES"].includes(words(sql)[0] ?? "");

/** Every name from a statement's first FROM on, stopping at an upsert's ON CONFLICT. */
function namesRead(sql: string): string[] {
  const w = words(sql);
  const from = w.indexOf("FROM");
  if (from < 0) return [];
  const conflict = w.findIndex((x, i) => i > from && x === "ON" && w[i + 1] === "CONFLICT");
  return w.slice(from + 1, conflict > 0 ? conflict : undefined).map((x) => x.toLowerCase());
}

/** Why the host would refuse to replay these statements, or null when it would replay them. */
export function replayRefusal(statements: string[]): string | null {
  const written = new Set<string>();
  for (const sql of statements) {
    if (isRead(sql)) continue;
    const table = upsertTarget(sql);
    if (!table) return `not a keyed upsert: ${sql.slice(0, 80)}`;
    written.add(table);
  }
  const read = new Set(statements.flatMap(namesRead));
  const both = [...written].filter((t) => read.has(t));
  return both.length ? `reads a table it writes: ${both.join(", ")}` : null;
}

import { MAX_FAMILIES } from "./openings.ts";
import type { Book, Skeletons } from "./openings.ts";

/*
 * The realm's SQLite: the opening book, and the results it keeps (db/schema.sql).
 */

/** One row back from SQLite. The host hands every value back as text. */
export type Row = Record<string, string | number | null>;

/** The realm's own SQLite, mounted by the host from the `db` dependency. */
export interface Db {
  exec(sql: string): Promise<Row[]>;
}

/** A single-quoted SQLite string literal. The host's exec takes no bound parameters. */
export const sqlText = (value: string): string => `'${value.replaceAll("'", "''")}'`;

export const sqlList = (values: string[]): string => values.map(sqlText).join(", ");

/** A number from SQLite, which hands numbers back as text. */
export const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const str = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

/** The book rows for these position keys. */
export async function bookFor(db: Db, keys: string[]): Promise<Book> {
  const book: Book = {};
  if (keys.length === 0) return book;
  const rows = await db.exec(`SELECT position_key, eco, name, pgn FROM openings WHERE position_key IN (${sqlList([...new Set(keys)])})`);
  for (const r of rows) book[str(r.position_key)] = { eco: str(r.eco), name: str(r.name), pgn: str(r.pgn) };
  return book;
}

function skeletonOf(r: Row): Skeletons[string] {
  const families = JSON.parse(str(r.families_json)) as string[];
  const names = JSON.parse(str(r.names_json)) as { eco: string; name: string }[];
  return { families: families.length, openings: names.slice(0, 6) };
}

/**
 * The skeleton rows a structure lookup needs: the exact pawn skeleton if the book has it, which
 * decides on its own, or else every skeleton few enough families share to name a structure.
 * The second read is the same for every position, so `nearby` keeps it for the dispatch.
 */
export async function skeletonsFor(db: Db, pawns: string, nearby: { rows?: Skeletons } = {}): Promise<Skeletons> {
  const exact = await db.exec(`SELECT pawns_key, families_json, names_json FROM skeletons WHERE pawns_key = ${sqlText(pawns)}`);
  if (exact.length > 0) return { [pawns]: skeletonOf(exact[0]) };
  if (!nearby.rows) {
    const rows = await db.exec(
      `SELECT pawns_key, families_json, names_json FROM skeletons WHERE json_array_length(families_json) <= ${MAX_FAMILIES}`,
    );
    nearby.rows = {};
    for (const r of rows) nearby.rows[str(r.pawns_key)] = skeletonOf(r);
  }
  return nearby.rows;
}

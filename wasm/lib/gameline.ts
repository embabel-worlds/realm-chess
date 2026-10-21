import { Chess } from "./chess.js";
import { boardKey } from "./openings.ts";
import type { BookEntry, LineOpening } from "./openings.ts";
import { bookFor, sqlList, sqlText } from "./store.ts";
import type { Db } from "./store.ts";

/*
 * A game line as the app steps through it. The page sends the whole line on every step, and
 * working it out from the start each time costs a replay through the board per call, which
 * grows with the game. So each line the app is sent is kept (db/0005-app.sql): the position it
 * reaches, its moves in the board's own SAN, and the deepest named opening along it. A call
 * whose line is kept does no board work for it at all; a call one move further plays that one
 * move from the kept line before it; any other line is played from the start once and kept.
 *
 * A line is kept under its moves as the board writes them (its own SAN, single-spaced), never
 * under the text as sent: chess.js reads some loose spellings of a move, and each spelling would
 * otherwise add a row of its own. A line sent in the board's SAN, which is what the app sends,
 * is found by its text; any other spelling is played from the start and kept under the board's
 * SAN, so it adds no row.
 *
 * The kept row is read and then written in the same dispatch. When another dispatch publishes
 * first, the host drops this one's writes: the answer stands, and the next call plays the line
 * again. Every write is a keyed upsert on the line.
 */

export interface GameLine {
  /** The position the line reaches, as the board writes it. */
  fen: string;
  /** The line's moves in the board's own SAN, from the start. */
  sans: string[];
  /** The deepest named opening along the line, with the ply it was named at; null when none. */
  opening: (BookEntry & { fen: string; namedAtPly: number }) | null;
}

/** The deepest named opening as openingOfLine answers it, with how far the line has gone past it. */
export const lineOpeningOf = (g: GameLine): LineOpening | null =>
  g.opening ? { ...g.opening, pliesPast: g.sans.length - g.opening.namedAtPly } : null;

const fromRow = (r: Record<string, string | number | null>): GameLine => ({
  fen: String(r.fen),
  sans: JSON.parse(String(r.sans_json)) as string[],
  opening: r.opening_json === null || r.opening_json === undefined ? null : (JSON.parse(String(r.opening_json)) as GameLine["opening"]),
});

/**
 * The line `moves` (SAN from the start), kept or played. An illegal move throws, naming it,
 * and nothing is kept.
 */
export async function gameLine(db: Db, moves: string[]): Promise<GameLine> {
  const key = moves.join(" ");
  const shorter = moves.slice(0, -1).join(" ");
  const rows = await db.exec(
    `SELECT line_key, fen, sans_json, opening_json FROM game_lines WHERE line_key IN (${sqlList(shorter ? [key, shorter] : [key])})`,
  );
  const kept = rows.find((r) => r.line_key === key);
  if (kept) return fromRow(kept);
  const prefix = rows.find((r) => r.line_key === shorter);
  const start: GameLine = prefix ? fromRow(prefix) : { fen: "", sans: [], opening: null };
  const from = prefix ? moves.length - 1 : 0;
  const board = prefix ? new Chess(start.fen) : new Chess();
  const sans = [...start.sans];
  const played: { fen: string; key: string }[] = [];
  for (let i = from; i < moves.length; i++) {
    try {
      sans.push(board.move(moves[i]).san);
    } catch {
      throw new Error(`Move ${i + 1} (${moves[i]}) is not legal in that line`);
    }
    played.push({ fen: board.fen(), key: boardKey(board) });
  }
  const book = await bookFor(db, played.map((p) => p.key));
  let opening = start.opening;
  played.forEach((p, i) => {
    const hit = book[p.key];
    if (hit) opening = { ...hit, fen: p.fen, namedAtPly: from + i + 1 };
  });
  const line: GameLine = { fen: board.fen(), sans, opening };
  await db.exec(
    `INSERT OR REPLACE INTO game_lines (line_key, fen, sans_json, opening_json, created_at) VALUES (${sqlText(sans.join(" "))}, ` +
      `${sqlText(line.fen)}, ${sqlText(JSON.stringify(sans))}, ${opening ? sqlText(JSON.stringify(opening)) : "NULL"}, ` +
      `${sqlText(new Date().toISOString())})`,
  );
  return line;
}

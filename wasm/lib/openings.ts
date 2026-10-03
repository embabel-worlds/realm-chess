import { Chess } from "./chess.js";

/*
 * The opening book: every named line in the Lichess chess-openings list (CC0), keyed by the
 * position it reaches. A name is evidence about plans — "Ruy Lopez: Exchange Variation" tells a
 * reader which structure and which ideas are in play before a single imbalance is counted.
 *
 * The key is the position without move counters (EPD), with the en passant square kept only
 * when a capture there is legal: 1.e4 and 1.e4 reached by transposition are one position, and a
 * phantom en passant square would split them.
 *
 * The book itself lives in the realm's SQLite (db/0001-openings.sql, db/0002-skeletons.sql).
 * The handlers read the rows a question needs and hand them in here, so this file only matches.
 */

export interface BookEntry { eco: string; name: string; pgn: string }

/** Book entries by position key: the whole book, or just the rows a lookup needs. */
export type Book = Record<string, BookEntry>;

export function positionKey(fen: string): string {
  return boardKey(new Chess(fen));
}

/** The book key of the position a board is in now, without reading its FEN back in. */
export function boardKey(c: Chess): string {
  const [board, turn, castling, ep] = c.fen().split(" ");
  const epLegal = ep !== "-" && c.moves({ verbose: true }).some((m) => m.flags.includes("e"));
  return `${board} ${turn} ${castling} ${epLegal ? ep : "-"}`;
}

/** The position key of every position along a line, for reading its book rows in one go. */
export function lineKeys(moves: string[]): string[] {
  const c = new Chess();
  const keys: string[] = [];
  for (const m of moves) {
    try {
      c.move(m);
    } catch {
      break;
    }
    keys.push(positionKey(c.fen()));
  }
  return keys;
}

export function openingOf(fen: string, book: Book): BookEntry | null {
  return book[positionKey(fen)] ?? null;
}

export interface LineOpening extends BookEntry {
  /** The position the book names — the deepest named one along the line. */
  fen: string;
  /** How many plies into the line that name was reached. */
  namedAtPly: number;
  /** How many plies the line has gone past it. */
  pliesPast: number;
}

/**
 * The deepest named opening along a game's moves: the name a game keeps after it leaves the
 * book, as a player (and Lichess) would call it — Bxc6 is still the Exchange Variation twenty
 * moves later. Each position along the line is looked up, so a transposition into a named line
 * is found too. `moves` is SAN from the starting position; an illegal move ends the line there.
 */
export function openingOfLine(moves: string[], book: Book): LineOpening | null {
  const c = new Chess();
  let best: LineOpening | null = null;
  let ply = 0;
  for (const m of moves) {
    try {
      c.move(m);
    } catch {
      break;
    }
    ply++;
    const hit = book[positionKey(c.fen())];
    if (hit) best = { ...hit, fen: c.fen(), namedAtPly: ply, pliesPast: 0 };
  }
  if (best) best.pliesPast = ply - best.namedAtPly;
  return best;
}

/** The position a line of SAN moves from the start reaches, or an error naming the bad move. */
export function positionAfter(moves: string[]): string {
  const c = new Chess();
  moves.forEach((m, i) => {
    try {
      c.move(m);
    } catch {
      throw new Error(`Move ${i + 1} (${m}) is not legal in that line`);
    }
  });
  return c.fen();
}

export const splitLine = (line: string) => line.trim().split(/\s+/).filter(Boolean);

export interface StructureMatch {
  /** Book lines whose pawn skeleton this position has, or is closest to. */
  openings: { eco: string; name: string }[];
  /** Pawns that differ from that skeleton: 0 is the same structure exactly. */
  pawnsDifferent: number;
}

/* A pawn skeleton from the book: how many opening families share it, and their names, shortest first. */
export interface Skeleton { families: number; openings: { eco: string; name: string }[] }

/** Skeletons by pawn key: the whole table, or the rows a lookup needs. */
export type Skeletons = Record<string, Skeleton>;

/* More families than this share the skeleton, and it is not a structure: the starting pawns are
 * shared by every knight-first opening, 1.e4 e5 by thirteen families. Every structure in the
 * test battery that deserves a name belongs to one. */
export const MAX_FAMILIES = 2;

/** The pawns alone, as the skeleton table keys them: colour and square, sorted. */
export function pawnKey(fen: string): string {
  return [...pawnSet(fen)].sort().join(" ");
}

function pawnSet(fen: string): Set<string> {
  const c = new Chess(fen);
  const out = new Set<string>();
  for (const row of c.board()) for (const p of row) if (p && p.type === "p") out.add(p.color + p.square);
  return out;
}

/*
 * Which named opening's pawn structure a position has. Exact first; otherwise the closest
 * skeleton within two pawns — "close to the Exchange Variation's structure" is still the right
 * table row for plans, and saying how close keeps it honest. Beyond two pawns, nothing: a
 * structure that far off is a different structure.
 */
export function structureOf(fen: string, skeletons: Skeletons, maxDifferent = 2): StructureMatch | null {
  const mine = pawnSet(fen);
  const exact = skeletons[[...mine].sort().join(" ")];
  if (exact) return exact.families <= MAX_FAMILIES ? { openings: exact.openings, pawnsDifferent: 0 } : null;
  let best: StructureMatch | null = null;
  for (const [key, { families, openings }] of Object.entries(skeletons)) {
    if (families > MAX_FAMILIES) continue;
    const theirs = new Set(key.split(" "));
    let diff = 0;
    for (const p of mine) if (!theirs.has(p)) diff++;
    for (const p of theirs) if (!mine.has(p)) diff++;
    // A skeleton counts pawns on both sides, so one pawn moved is two differences.
    const moved = Math.ceil(diff / 2);
    if (moved <= maxDifferent && (!best || moved < best.pawnsDifferent)) best = { openings, pawnsDifferent: moved };
  }
  return best;
}

export function structureSentence(m: StructureMatch | null): string | null {
  if (!m) return null;
  const names = m.openings.slice(0, 3).map((o) => `${o.name} (${o.eco})`).join("; ");
  return m.pawnsDifferent === 0
    ? `The pawn structure is the one reached in: ${names}.`
    : `The pawn structure is close to the one reached in: ${names} — ${m.pawnsDifferent} pawn${m.pawnsDifferent > 1 ? "s" : ""} different.`;
}

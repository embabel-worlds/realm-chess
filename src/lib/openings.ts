import { Chess } from "chess.js";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/*
 * The opening book: every named line in the Lichess chess-openings list (CC0), keyed by the
 * position it reaches. A name is evidence about plans — "Ruy Lopez: Exchange Variation" tells a
 * reader which structure and which ideas are in play before a single imbalance is counted.
 *
 * The key is the position without move counters (EPD), with the en passant square kept only
 * when a capture there is legal: 1.e4 and 1.e4 reached by transposition are one position, and a
 * phantom en passant square would split them.
 */

export interface BookEntry { eco: string; name: string; pgn: string }

export function positionKey(fen: string): string {
  const c = new Chess(fen);
  const [board, turn, castling, ep] = c.fen().split(" ");
  const epLegal = ep !== "-" && c.moves({ verbose: true }).some((m) => m.flags.includes("e"));
  return `${board} ${turn} ${castling} ${epLegal ? ep : "-"}`;
}

let book: Record<string, BookEntry> | null = null;

/* The bundled table, built by scripts/build.mjs into dist/data/openings.json beside the handler. */
function load(): Record<string, BookEntry> {
  if (!book) book = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "openings.json"), "utf8"));
  return book!;
}

export function openingOf(fen: string): BookEntry | null {
  return load()[positionKey(fen)] ?? null;
}

export interface StructureMatch {
  /** Book lines whose pawn skeleton this position has, or is closest to. */
  openings: { eco: string; name: string }[];
  /** Pawns that differ from that skeleton: 0 is the same structure exactly. */
  pawnsDifferent: number;
}

let skeletons: Record<string, { families: number; openings: { eco: string; name: string }[] }> | null = null;

/* More families than this share the skeleton, and it is not a structure: the starting pawns are
 * shared by every knight-first opening, 1.e4 e5 by thirteen families. Every structure in the
 * test battery that deserves a name belongs to one. */
const MAX_FAMILIES = 2;

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
export function structureOf(fen: string, maxDifferent = 2): StructureMatch | null {
  if (!skeletons) skeletons = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "skeletons.json"), "utf8"));
  const mine = pawnSet(fen);
  const exact = skeletons![[...mine].sort().join(" ")];
  if (exact) return exact.families <= MAX_FAMILIES ? { openings: exact.openings, pawnsDifferent: 0 } : null;
  let best: StructureMatch | null = null;
  for (const [key, { families, openings }] of Object.entries(skeletons!)) {
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

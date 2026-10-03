import { Chess } from "./lib/chess.js";
import { imbalancesOf } from "./lib/imbalances.ts";
import { lineKeys, openingOf, openingOfLine, pawnKey, positionAfter, positionKey, splitLine, structureOf, structureSentence } from "./lib/openings.ts";
import type { Skeletons } from "./lib/openings.ts";
import { bookFor, skeletonsFor } from "./lib/store.ts";
import type { Db } from "./lib/store.ts";

/*
 * The realm's verbs. Rod's ten keep their names and contracts. The `rows*` verbs serve the
 * graph's producers: they take the keys the host sends and answer `{ rows, next }`.
 */

interface Ctx {
  log(line: string): void;
  deps: { db: Db };
}

function legal(fen: string): Chess {
  try {
    return new Chess(fen.trim());
  } catch (e) {
    throw new Error(`Not a legal position: ${fen} (${(e as Error).message})`);
  }
}

/** The keys a producer was sent: a list of 1 to 256 strings, or a refusal. */
function keysOf(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 256 || value.some((k) => typeof k !== "string")) {
    throw new Error("Invalid producer keys");
  }
  return value as string[];
}

/* ── Rod's facts: imbalances and the opening book ── */

export interface ImbalanceRecord {
  fen: string;
  sideToMove: string;
  phase: string;
  /** Every imbalance, one plain sentence per line. */
  facts: string;
  /** Which opening's pawn structure this is, from the book's pawn skeletons; empty if none within two pawns. */
  structure: string;
  materialWhite: number;
  materialBlack: number;
  bishopPairWhite: boolean;
  bishopPairBlack: boolean;
  isolatedQueenPawnWhite: boolean;
  isolatedQueenPawnBlack: boolean;
  passedWhite: string;
  passedBlack: string;
  openFiles: string;
  oppositeSideCastling: boolean;
  oppositeColouredBishops: boolean;
  /** The whole computation, for a caller that wants more than the sentences. */
  detail: string;
}

async function imbalanceRecords(db: Db, fens: string[]): Promise<ImbalanceRecord[]> {
  const nearby: { rows?: Skeletons } = {};
  const out: ImbalanceRecord[] = [];
  for (const raw of fens) {
    const fen = raw.trim();
    legal(fen);
    const x = imbalancesOf(fen);
    const skeletons = await skeletonsFor(db, pawnKey(fen), nearby);
    out.push({
      fen,
      sideToMove: x.sideToMove,
      phase: x.phase,
      facts: x.facts.join("\n"),
      structure: structureSentence(structureOf(fen, skeletons)) ?? "",
      materialWhite: x.white.material.points,
      materialBlack: x.black.material.points,
      bishopPairWhite: x.white.bishopPair,
      bishopPairBlack: x.black.bishopPair,
      isolatedQueenPawnWhite: x.white.pawns.isolatedQueenPawn,
      isolatedQueenPawnBlack: x.black.pawns.isolatedQueenPawn,
      passedWhite: x.white.pawns.passed.join(" "),
      passedBlack: x.black.pawns.passed.join(" "),
      openFiles: x.openFiles.join(" "),
      oppositeSideCastling: x.oppositeSideCastling,
      oppositeColouredBishops: x.oppositeColouredBishops,
      detail: JSON.stringify(x),
    });
  }
  return out;
}

export interface OpeningRecord { fen: string; eco: string; name: string; pgn: string }

async function openingRecords(db: Db, fens: string[]): Promise<OpeningRecord[]> {
  const trimmed = fens.map((f) => f.trim());
  const book = await bookFor(db, trimmed.map((fen) => (legal(fen), positionKey(fen))));
  const out: OpeningRecord[] = [];
  for (const fen of trimmed) {
    const hit = openingOf(fen, book);
    if (hit) out.push({ fen, ...hit });
  }
  return out;
}

export interface LineOpeningRecord extends OpeningRecord {
  /** The game line looked up: SAN moves from the start, space-separated. */
  line: string;
  /** The ply at which the book last named the line. */
  namedAtPly: number;
  /** How far past that name the line has gone, in plies. */
  pliesPast: number;
}

async function lineOpeningRecords(db: Db, lines: string[]): Promise<LineOpeningRecord[]> {
  const out: LineOpeningRecord[] = [];
  for (const raw of lines) {
    const moves = splitLine(raw);
    const line = moves.join(" ");
    positionAfter(moves);
    const hit = openingOfLine(moves, await bookFor(db, lineKeys(moves)));
    if (hit) out.push({ line, fen: hit.fen, eco: hit.eco, name: hit.name, pgn: hit.pgn, namedAtPly: hit.namedAtPly, pliesPast: hit.pliesPast });
  }
  return out;
}

/** Jeremy Silman's imbalances for each position: material, minor pieces, pawn structure, space, files, key squares, development and king safety. */
export const positionImbalances = async (input: { fens?: string[] }, ctx: Ctx) =>
  imbalanceRecords(ctx.deps.db, input.fens ?? []);

/** The named opening each position is, from the Lichess opening book. A position the book does not name returns nothing. */
export const openingLookup = async (input: { fens?: string[] }, ctx: Ctx) => openingRecords(ctx.deps.db, input.fens ?? []);

/**
 * The deepest named opening along each game line (SAN from the start): the name a game keeps
 * after it leaves the book. A line the book never names returns nothing.
 */
export const openingOfGameLine = async (input: { lines?: string[] }, ctx: Ctx) =>
  lineOpeningRecords(ctx.deps.db, input.lines ?? []);

export const rowsImbalances = async (input: { fens?: unknown }, ctx: Ctx) => ({
  rows: await imbalanceRecords(ctx.deps.db, keysOf(input.fens)),
  next: null,
});

export const rowsOpeningOfPosition = async (input: { fens?: unknown }, ctx: Ctx) => ({
  rows: await openingRecords(ctx.deps.db, keysOf(input.fens)),
  next: null,
});

export const rowsOpeningOfLine = async (input: { lines?: unknown }, ctx: Ctx) => ({
  rows: await lineOpeningRecords(ctx.deps.db, keysOf(input.lines)),
  next: null,
});

/* ── Rod's handlers not yet ported ── */

/* Each of these is ported in its own change; until then it says so plainly. */
const notYet = (verb: string): never => {
  throw new Error(`chess.${verb} is not available in this build of the captured realm yet`);
};

export const analysePosition = async () => notYet("analysePosition");
export const theoryOfGameLine = async () => notYet("theoryOfGameLine");
export const explainPlans = async () => notYet("explainPlans");
export const explainLinePlans = async () => notYet("explainLinePlans");
export const mastersAtPosition = async () => notYet("mastersAtPosition");
export const playerAtPosition = async () => notYet("playerAtPosition");
export const ratedMoves = async () => notYet("ratedMoves");

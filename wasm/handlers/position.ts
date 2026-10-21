/*
 * What the board, the opening book and the wikibook say about a position or a line: its
 * imbalances, its named opening, and the opening theory along it.
 */

import type {
  Handler, Handlers, OpeningLookupOutput, OpeningOfGameLineOutput, PositionImbalancesOutput, RowsImbalancesInput, RowsOpeningOfLineInput,
  RowsOpeningOfPositionInput, RowsTheoryInput, TheoryOfGameLineOutput,
} from "../generated/realm.ts";
import { fits } from "../lib/clock.ts";
import { API_CALL_MS, THEORY_TTL_MS } from "../lib/config.ts";
import { allWithValues } from "../lib/records.ts";
import { timed, timedSync } from "../lib/timing.ts";
import { theoryFor } from "../lib/theory.ts";
import type { TheoryRecord } from "../lib/theory.ts";
import { lineKeys, openingOf, openingOfLine, pawnKey, positionAfter, positionKey, splitLine, structureOf, structureSentence } from "../lib/openings.ts";
import type { Skeletons } from "../lib/openings.ts";
import { bookFor, skeletonsFor } from "../lib/store.ts";
import type { Db } from "../lib/store.ts";
import { imbalancesFor, keysOf, legal, paged } from "./shared.ts";
import type { Ctx, Item, Paged, Served } from "./shared.ts";

/* ── Facts from the board: imbalances and the opening book ── */

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

export async function imbalanceRecords(db: Db, fens: string[]): Promise<ImbalanceRecord[]> {
  const nearby: { byCount?: Map<number, Skeletons> } = {};
  const out: ImbalanceRecord[] = [];
  for (const raw of fens) {
    const fen = raw.trim();
    legal(fen);
    const x = imbalancesFor(fen);
    const skeletons = await timed("skeletons", () => skeletonsFor(db, pawnKey(fen), nearby));
    const structure = timedSync("structure", () => structureSentence(structureOf(fen, skeletons)) ?? "");
    out.push({
      fen,
      sideToMove: x.sideToMove,
      phase: x.phase,
      facts: x.facts.join("\n"),
      structure,
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

export async function openingRecords(db: Db, fens: string[]): Promise<OpeningRecord[]> {
  const trimmed = fens.map((f) => f.trim());
  trimmed.forEach(legal);
  const book = await bookFor(db, trimmed.map(positionKey));
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
    timedSync("lineReplay", () => positionAfter(moves));
    const keys = timedSync("lineKeys", () => lineKeys(moves));
    const book = await timed("lineBook", () => bookFor(db, keys));
    const hit = timedSync("openingOfLine", () => openingOfLine(moves, book));
    if (hit) out.push({ line, fen: hit.fen, eco: hit.eco, name: hit.name, pgn: hit.pgn, namedAtPly: hit.namedAtPly, pliesPast: hit.pliesPast });
  }
  return out;
}

/** Jeremy Silman's imbalances for each position: material, minor pieces, pawn structure, space, files, key squares, development and king safety. */
export const positionImbalances: Handlers["positionImbalances"] = async (input: { fens?: string[] }, ctx: Ctx) =>
  allWithValues(await imbalanceRecords(ctx.deps.db, input.fens ?? []));

/** The named opening each position is, from the Lichess opening book. A position the book does not name returns nothing. */
export const openingLookup: Handlers["openingLookup"] = async (input: { fens?: string[] }, ctx: Ctx) => allWithValues(await openingRecords(ctx.deps.db, input.fens ?? []));

/**
 * The deepest named opening along each game line (SAN from the start): the name a game keeps
 * after it leaves the book. A line the book never names returns nothing.
 */
export const openingOfGameLine: Handlers["openingOfGameLine"] = async (input: { lines?: string[] }, ctx: Ctx) =>
  allWithValues(await lineOpeningRecords(ctx.deps.db, input.lines ?? []));

/*
 * A producer with no page answers its rows as a plain list; only a paged one answers
 * `{ rows, next }`. The host refuses any other shape, so these three answer lists.
 */
export const rowsImbalances: Handler<RowsImbalancesInput, Item<PositionImbalancesOutput>[]> = async (input: { fens?: unknown }, ctx: Ctx) =>
  allWithValues(await imbalanceRecords(ctx.deps.db, keysOf(input.fens)));

export const rowsOpeningOfPosition: Handler<RowsOpeningOfPositionInput, Item<OpeningLookupOutput>[]> = async (input: { fens?: unknown }, ctx: Ctx) =>
  allWithValues(await openingRecords(ctx.deps.db, keysOf(input.fens)));

export const rowsOpeningOfLine: Handler<RowsOpeningOfLineInput, Item<OpeningOfGameLineOutput>[]> = async (input: { lines?: unknown }, ctx: Ctx) =>
  allWithValues(await lineOpeningRecords(ctx.deps.db, keysOf(input.lines)));

/* ── Theory from the wikibook ── */

/** What opening theory says along each game line: the deepest page of the Chess Opening Theory wikibook the line reaches. */
export const theoryOfGameLine: Handlers["theoryOfGameLine"] = async (input: { lines?: string[] }, ctx: Ctx) => {
  const out: TheoryRecord[] = [];
  for (const raw of input.lines ?? []) {
    const moves = splitLine(raw);
    positionAfter(moves);
    const t = await theoryFor(ctx.deps.db, ctx.gateway, moves, THEORY_TTL_MS, () => true);
    if (t && t !== "later") out.push(t);
  }
  return allWithValues(out);
};

/**
 * The producer behind HAS_THEORY. A line the wikibook has no page for has no row, and that is
 * kept for the week. A refused request has no row and keeps nothing, so the next read asks again.
 */
export const rowsTheory: Paged<RowsTheoryInput, Item<TheoryOfGameLineOutput>> = async (input: { lines?: unknown; cursor?: unknown }, ctx: Ctx) =>
  paged(keysOf(input.lines), input.cursor, async (raw, first): Promise<Served<TheoryRecord>> => {
    const moves = splitLine(raw);
    positionAfter(moves);
    try {
      const t = await theoryFor(ctx.deps.db, ctx.gateway, moves, THEORY_TTL_MS, () => first || fits(API_CALL_MS));
      return t === "later" ? "later" : t ? [t] : [];
    } catch (e) {
      ctx.log(`theory for "${moves.join(" ")}" was refused: ${(e as Error).message}`);
      return [];
    }
  });

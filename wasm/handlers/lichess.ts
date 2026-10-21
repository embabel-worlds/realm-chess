/*
 * The Lichess explorer: what masters played, what one player played, and how the moves change
 * with rating and time control. One request serves a unit of work, spaced as Lichess asks.
 */

import type {
  Handlers, MastersAtPositionOutput, PlayerAtPositionOutput, RatedMovesOutput, RowsMasterGamesInput, RowsMasterMovesInput, RowsPlayerGamesInput,
  RowsPlayerMovesInput, RowsRatedMovesInput,
} from "../generated/realm.ts";
import { fits } from "../lib/clock.ts";
import { API_CALL_MS, LICHESS_SPACING_MS, MASTERS_TTL_MS, PLAYER_TTL_MS, RATED_TTL_MS } from "../lib/config.ts";
import { BAND, COLOR, gameRecords, gameUrl, moveRecords, PLAYER, playerCells, playerFilter, pinned, ratedCells, ratedGrid, ratedRecords, ratedRequest, SPEED } from "../lib/explorer.ts";
import type { ExplorerGameRecord, ExplorerMoveRecord, RatedMoveRecord } from "../lib/explorer.ts";
import { allWithValues } from "../lib/records.ts";
import { explorerAnswerFor, LichessRefused, lichessSession, recordLichess } from "../lib/lichess.ts";
import type { ExplorerOperation, LichessSession } from "../lib/lichess.ts";
import { fensOf, keysOf, paged } from "./shared.ts";
import type { Ctx, Item, Paged, Served } from "./shared.ts";

/** One Lichess request fits when it can wait its turn and still finish within the page. */
const lichessFits = (first: boolean) => () => first || fits(LICHESS_SPACING_MS + API_CALL_MS);

/**
 * One explorer request for a producer: its rows, "later" when it would not fit, or "stop" when
 * Lichess refused, since every request after it would be refused the same way.
 */
async function explorerRows<R extends object>(
  s: LichessSession, op: ExplorerOperation, params: Record<string, unknown>, ttlMs: number, first: boolean,
  rows: (a: NonNullable<Awaited<ReturnType<typeof explorerAnswerFor>>>) => R[],
): Promise<Served<R>> {
  try {
    const a = await explorerAnswerFor(s, op, params, ttlMs, lichessFits(first));
    return a ? rows(a) : "later";
  } catch (e) {
    if (e instanceof LichessRefused) return "stop";
    throw e;
  }
}

export const mastersParams = (fen: string) => ({ fen, moves: 12, topGames: 15 });
export const playerParams = (fen: string, who: { player: string; color: string }) => ({ player: who.player, color: who.color, fen, recentGames: 8 });

async function lichessRows<U, R extends object>(ctx: Ctx, units: U[], cursor: unknown, serve: (s: LichessSession, u: U, first: boolean) => Promise<Served<R>>) {
  const s = lichessSession(ctx.deps.db, ctx.gateway);
  const page = await paged(units, cursor, (u, first) => serve(s, u, first));
  await recordLichess(s);
  return page;
}

/**
 * What masters played from each position, and the top master games through it. One request per
 * position feeds both: the moves (MASTERS_PLAYED) and the games (MASTER_GAME). Needs the Lichess token.
 */
export const mastersAtPosition: Handlers["mastersAtPosition"] = async (input: { fens?: string[] }, ctx: Ctx) => {
  const s = lichessSession(ctx.deps.db, ctx.gateway);
  const out = { moves: [] as ExplorerMoveRecord[], games: [] as ExplorerGameRecord[] };
  for (const fen of fensOf(input.fens ?? [])) {
    const a = (await explorerAnswerFor(s, "mastersExplorer", mastersParams(fen), MASTERS_TTL_MS))!;
    out.moves.push(...moveRecords(fen, a));
    out.games.push(...gameRecords(fen, a.topGames, gameUrl));
  }
  await recordLichess(s);
  return { moves: allWithValues(out.moves), games: allWithValues(out.games) };
};

export const rowsMasterMoves: Paged<RowsMasterMovesInput, Item<MastersAtPositionOutput["moves"]>> = async (input: { fens?: unknown; cursor?: unknown }, ctx: Ctx) =>
  lichessRows(ctx, fensOf(keysOf(input.fens)), input.cursor, (s, fen, first) =>
    explorerRows(s, "mastersExplorer", mastersParams(fen), MASTERS_TTL_MS, first, (a) => moveRecords(fen, a)));

export const rowsMasterGames: Paged<RowsMasterGamesInput, Item<MastersAtPositionOutput["games"]>> = async (input: { fens?: unknown; cursor?: unknown }, ctx: Ctx) =>
  lichessRows(ctx, fensOf(keysOf(input.fens)), input.cursor, (s, fen, first) =>
    explorerRows(s, "mastersExplorer", mastersParams(fen), MASTERS_TTL_MS, first, (a) => gameRecords(fen, a.topGames, gameUrl)));

/**
 * What one Lichess player played from each position, as one colour, and their recent games
 * through it (PLAYER_PLAYED, PLAYER_GAME). The player and colour arrive as "player=X color=Y".
 * The player database streams its answer; the last complete record is the answer. Needs the Lichess token.
 */
export const playerAtPosition: Handlers["playerAtPosition"] = async (input: { fens?: string[]; filters?: string }, ctx: Ctx) => {
  const out = { moves: [] as ExplorerMoveRecord[], games: [] as ExplorerGameRecord[] };
  const who = playerFilter(input.filters);
  if (!who) return { moves: [], games: [] };
  const s = lichessSession(ctx.deps.db, ctx.gateway);
  for (const fen of fensOf(input.fens ?? [])) {
    const a = (await explorerAnswerFor(s, "playerExplorer", playerParams(fen, who), PLAYER_TTL_MS))!;
    out.moves.push(...moveRecords(fen, a, who.player, who.color));
    out.games.push(...gameRecords(fen, a.recentGames, gameUrl, who.player, who.color));
  }
  await recordLichess(s);
  return { moves: allWithValues(out.moves), games: allWithValues(out.games) };
};

/** The units of a player producer: each position, for each pinned player in each pinned colour. */
function playerUnits(input: { fens?: unknown; player?: unknown; color?: unknown }) {
  const fens = fensOf(keysOf(input.fens));
  const cells = playerCells(pinned(input.player, "player", PLAYER), pinned(input.color, "color", COLOR));
  return fens.flatMap((fen) => cells.map((who) => ({ fen, who })));
}

export const rowsPlayerMoves: Paged<RowsPlayerMovesInput, Item<PlayerAtPositionOutput["moves"]>> = async (input: { fens?: unknown; player?: unknown; color?: unknown; cursor?: unknown }, ctx: Ctx) =>
  lichessRows(ctx, playerUnits(input), input.cursor, (s, { fen, who }, first) =>
    explorerRows(s, "playerExplorer", playerParams(fen, who), PLAYER_TTL_MS, first, (a) => moveRecords(fen, a, who.player, who.color)));

export const rowsPlayerGames: Paged<RowsPlayerGamesInput, Item<PlayerAtPositionOutput["games"]>> = async (input: { fens?: unknown; player?: unknown; color?: unknown; cursor?: unknown }, ctx: Ctx) =>
  lichessRows(ctx, playerUnits(input), input.cursor, (s, { fen, who }, first) =>
    explorerRows(s, "playerExplorer", playerParams(fen, who), PLAYER_TTL_MS, first,
      (a) => gameRecords(fen, a.recentGames, gameUrl, who.player, who.color)));

/** How often each move is played from a position by rating band and time control on Lichess, and how it scores. */
export const ratedMoves: Handlers["ratedMoves"] = async (input: { fens?: string[]; filters?: string }, ctx: Ctx) => {
  const s = lichessSession(ctx.deps.db, ctx.gateway);
  const out: RatedMoveRecord[] = [];
  for (const fen of fensOf(input.fens ?? [])) {
    for (const cell of ratedGrid(input.filters)) {
      out.push(...ratedRecords(fen, cell, (await explorerAnswerFor(s, "lichessExplorer", ratedRequest(fen, cell), RATED_TTL_MS))!));
    }
  }
  await recordLichess(s);
  return allWithValues(out);
};

export const rowsRatedMoves: Paged<RowsRatedMovesInput, Item<RatedMovesOutput>> = async (input: { fens?: unknown; band?: unknown; speed?: unknown; cursor?: unknown }, ctx: Ctx) => {
  const fens = fensOf(keysOf(input.fens));
  const cells = ratedCells(pinned(input.band, "band", BAND), pinned(input.speed, "speed", SPEED));
  const units = fens.flatMap((fen) => cells.map((cell) => ({ fen, cell })));
  return lichessRows(ctx, units, input.cursor, (s, { fen, cell }, first) =>
    explorerRows(s, "lichessExplorer", ratedRequest(fen, cell), RATED_TTL_MS, first, (a) => ratedRecords(fen, cell, a)));
};

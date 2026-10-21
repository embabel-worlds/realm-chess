/*
 * Chesscalator's three calls. The frame it runs in has one serialized realm.call and no views, so
 * each call answers the views the page shows for one moment of use, under the views' names:
 * the rows come from the same code as the producers' and go through the views' own Cypher
 * (wasm/lib/cypher.ts), so a column, an order or a limit is the view's.
 *
 * Each view answers on its own: one that fails carries its error and the rest still answer. A
 * step that would not fit in the dispatch is not started and its view says `skipped`. Every
 * reply carries ChessStatus, which is how the page explains an empty column.
 */

import type { Handlers } from "../generated/realm.ts";
import { fits } from "../lib/clock.ts";
import { API_CALL_MS, LICHESS_SPACING_MS, MASTERS_TTL_MS, PLAYER_TTL_MS, RATED_TTL_MS, THEORY_TTL_MS } from "../lib/config.ts";
import { BAND, COLOR, gameRecords, gameUrl, moveRecords, PLAYER, pinned, ratedCells, ratedRecords, ratedRequest, SPEED } from "../lib/explorer.ts";
import type { RatedMoveRecord } from "../lib/explorer.ts";
import { runView } from "../lib/cypher.ts";
import { VIEWS } from "../lib/views.ts";
import { explorerAnswerFor, LichessRefused, lichessSession, recordLichess } from "../lib/lichess.ts";
import type { ExplorerOperation } from "../lib/lichess.ts";
import { timed, timedSync } from "../lib/timing.ts";
import { readStatus } from "../lib/status.ts";
import { theoryFor, titlesOfSans } from "../lib/theory.ts";
import { FULL } from "../lib/engine.ts";
import { gameLine, lineOpeningOf } from "../lib/gameline.ts";
import type { GameLine } from "../lib/gameline.ts";
import { positionAfter, splitLine } from "../lib/openings.ts";
import { sqlText } from "../lib/store.ts";
import type { Db } from "../lib/store.ts";
import { keptFor, linesFor } from "./engine.ts";
import { mastersParams, playerParams } from "./lichess.ts";
import { lineOpening, lineTheory, levelsOf, plansFor, positionOpening, PRODUCER_PLAN_ARGS, recordModel } from "./plans.ts";
import type { ModelSession, PlanRow } from "./plans.ts";
import { imbalanceRecords, openingRecords } from "./position.ts";
import type { ImbalanceRecord } from "./position.ts";
import { clamp, legal } from "./shared.ts";
import type { Ctx, Served } from "./shared.ts";

export interface ViewAnswer {
  rows: Record<string, unknown>[];
  /** Why there are no rows, when the realm could not get them. */
  error?: string;
  /** Set when the step was not started because the dispatch had no time left for it. */
  skipped?: "time";
}

export interface AppReply {
  fen: string;
  views: Record<string, ViewAnswer>;
  status: Awaited<ReturnType<typeof readStatus>>;
}

const viewNamed = (name: string) => {
  const v = VIEWS.find((x) => x.name === name);
  if (!v) throw new Error(`No view named ${name}`);
  return v;
};

async function answer(name: string, params: Record<string, unknown>, rows: () => Promise<readonly object[] | "later">): Promise<ViewAnswer> {
  try {
    const r = await rows();
    return r === "later" ? { rows: [], skipped: "time" } : { rows: timedSync("view", () => runView(viewNamed(name), params, r)) };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

/** The position, and the line that reached it when there is one. A line must reach the position. */
function appTarget(input: { fen?: unknown; moves?: unknown }): { fen: string; moves: string[] | null } {
  if (typeof input.fen !== "string") throw new Error("The app sends a FEN");
  const fen = input.fen.trim();
  legal(fen);
  if (input.moves === undefined || input.moves === null || input.moves === "") return { fen, moves: null };
  if (typeof input.moves !== "string") throw new Error("The moves are SAN from the start, space-separated");
  const moves = splitLine(input.moves);
  if (positionAfter(moves) !== fen) throw new Error("The moves do not reach that position");
  return { fen, moves };
}

/**
 * The app's position and its line, the line kept between calls (wasm/lib/gameline.ts) so a step
 * plays at most the one new move. A line must reach the position.
 */
async function appStep(db: Db, input: { fen?: unknown; moves?: unknown }): Promise<{ fen: string; moves: string[] | null; line: GameLine | null }> {
  if (typeof input.fen !== "string") throw new Error("The app sends a FEN");
  const fen = input.fen.trim();
  if (input.moves === undefined || input.moves === null || input.moves === "") {
    legal(fen);
    return { fen, moves: null, line: null };
  }
  if (typeof input.moves !== "string") throw new Error("The moves are SAN from the start, space-separated");
  const moves = splitLine(input.moves);
  const line = await gameLine(db, moves);
  if (line.fen !== fen) throw new Error("The moves do not reach that position");
  return { fen, moves, line };
}

/**
 * The ImbalancesOf row for a position, kept: it depends only on the board and the book, so a
 * position the app has shown before is read back, never worked out again.
 */
async function appImbalances(db: Db, fen: string): Promise<ImbalanceRecord[]> {
  const kept = await db.exec(`SELECT record_json FROM position_facts WHERE fen = ${sqlText(fen)}`);
  if (kept.length > 0) return [JSON.parse(String(kept[0].record_json)) as ImbalanceRecord];
  const records = await imbalanceRecords(db, [fen]);
  await db.exec(
    `INSERT OR REPLACE INTO position_facts (fen, record_json, created_at) VALUES (${sqlText(fen)}, ` +
      `${sqlText(JSON.stringify(records[0]))}, ${sqlText(new Date().toISOString())})`,
  );
  return records;
}

/**
 * Everything the page shows on every step: the imbalances, the opening (along the line when the
 * game was played from the start, else by position), the theory for the line, and the engine's
 * lines within `withinCp` of the best. The engine's lines are searched at full, as the graph's are.
 * What the page asked for before is kept, so asking again costs a few reads.
 */
export const appPosition: Handlers["appPosition"] = async (input: { fen?: unknown; moves?: unknown; withinCp?: unknown }, ctx: Ctx): Promise<AppReply> => {
  const db = ctx.deps.db;
  const { fen, moves, line } = await timed("line", () => appStep(db, input));
  const withinCp = clamp(typeof input.withinCp === "number" ? input.withinCp : undefined, 50, 0, 1000);
  const views: Record<string, ViewAnswer> = {};
  views.ImbalancesOf = await answer("ImbalancesOf", { fen }, () => timed("facts", () => appImbalances(db, fen)));
  if (moves && line) {
    const joined = moves.join(" ");
    views.OpeningOfLine = await answer("OpeningOfLine", { moves: joined }, async () => {
      const hit = lineOpeningOf(line);
      return hit ? [{ line: joined, fen: hit.fen, eco: hit.eco, name: hit.name, pgn: hit.pgn, namedAtPly: hit.namedAtPly, pliesPast: hit.pliesPast }] : [];
    });
  } else {
    views.OpeningOf = await answer("OpeningOf", { fen }, () => openingRecords(db, [fen]));
  }
  views.BestMoves = await answer("BestMoves", { fen, withinCp, maxLines: 5 }, async () =>
    linesFor(ctx, fen, FULL, (await timed("keptRead", () => keptFor(db, FULL, [fen], true))).get(fen)));
  if (moves && line) {
    views.TheoryOfLine = await answer("TheoryOfLine", { moves: moves.join(" ") }, async () => {
      const t = await timed("theory", () => theoryFor(db, ctx.gateway, moves, THEORY_TTL_MS, () => fits(API_CALL_MS), titlesOfSans(line.sans)));
      return t === "later" ? "later" : t ? [t] : [];
    });
  }
  return { fen, views, status: await timed("status", () => readStatus(db)) };
};

/** What the page may ask of Lichess at once: masters on every step, the rest on request. */
interface PracticeFilters {
  masters?: boolean;
  player?: string;
  color?: string;
  speed?: string;
  band?: string;
  minShare?: number;
}

/**
 * Lichess practice at a position: what masters played and their games (`masters`), what one
 * player chose (`player`, with `color`, white when absent), and how the moves change with
 * rating at one time control (`speed`) or with time control in one band (`band`). Each grid
 * cell is one request, spaced as the producers space them; cells that do not fit are left for
 * the next call, which finds the kept ones, and the view says `skipped`.
 */
export const appPractice: Handlers["appPractice"] = async (input: { fen?: unknown; filters?: unknown }, ctx: Ctx): Promise<AppReply> => {
  const { fen } = appTarget({ fen: input.fen });
  const f = (input.filters ?? {}) as PracticeFilters;
  if (typeof f !== "object" || Array.isArray(f)) throw new Error("The filters are an object");
  const one = (v: unknown, name: string, pattern: RegExp) => (v === undefined || v === null || v === "" ? undefined : pinned([v], name, pattern)![0]);
  const player = one(f.player, "player", PLAYER);
  const color = one(f.color, "color", COLOR) ?? "white";
  const speed = one(f.speed, "speed", SPEED);
  const band = one(f.band, "band", BAND);
  const minShare = clamp(typeof f.minShare === "number" ? f.minShare : undefined, 3, 0, 100);
  const s = lichessSession(ctx.deps.db, ctx.gateway);
  let first = true;
  const mayFetch = () => {
    const ok = first || fits(LICHESS_SPACING_MS + API_CALL_MS);
    first = false;
    return ok;
  };
  /* A refused Lichess call reaches the guest without its cause, so the page is told it was Lichess. */
  const ask = async (op: ExplorerOperation, req: Record<string, unknown>, ttl: number) => {
    try {
      return await explorerAnswerFor(s, op, req, ttl, mayFetch);
    } catch (e) {
      throw e instanceof LichessRefused ? new Error(`Lichess refused the request: ${e.message}`) : e;
    }
  };
  const views: Record<string, ViewAnswer> = {};
  const both = async (moveView: string, gameView: string, params: Record<string, unknown>, op: ExplorerOperation, req: Record<string, unknown>, ttl: number, who?: { player: string; color: string }) => {
    let a: Awaited<ReturnType<typeof explorerAnswerFor>>;
    views[moveView] = await answer(moveView, params, async () => {
      a = await ask(op, req, ttl);
      return a ? (moveRecords(fen, a, who?.player, who?.color)) : "later";
    });
    views[gameView] = views[moveView].error || views[moveView].skipped
      ? { ...views[moveView] }
      : await answer(gameView, params, async () => gameRecords(fen, op === "playerExplorer" ? a!.recentGames : a!.topGames, gameUrl, who?.player, who?.color));
  };
  if (f.masters) await both("MastersAtPosition", "MasterGamesAtPosition", { fen }, "mastersExplorer", mastersParams(fen), MASTERS_TTL_MS);
  if (player) {
    const who = { player, color: color as "white" | "black" };
    await both("PlayerAtPosition", "PlayerGamesAtPosition", { fen, player, color }, "playerExplorer", playerParams(fen, who), PLAYER_TTL_MS, who);
  }
  const grid = async (name: string, params: Record<string, unknown>, cells: { band: string; speed: string }[]) => {
    let skipped = false;
    views[name] = await answer(name, params, async () => {
      const rows: RatedMoveRecord[] = [];
      for (const cell of cells) {
        const a = await ask("lichessExplorer", ratedRequest(fen, cell), RATED_TTL_MS);
        if (!a) {
          skipped = true;
          break;
        }
        rows.push(...ratedRecords(fen, cell, a));
      }
      return rows;
    });
    if (skipped) views[name].skipped = "time";
  };
  if (speed) await grid("MovesByRating", { fen, speed, minShare }, ratedCells(undefined, [speed]));
  if (band) await grid("MovesByTimeControl", { fen, band, minShare }, ratedCells([band], undefined));
  await recordLichess(s);
  return { fen, views, status: await readStatus(ctx.deps.db) };
};

/**
 * The plans for both sides, asked for only when the reader presses the button. Along the line
 * when the game was played from the start (PlansInLine), else for the position (PlansInPosition),
 * with the producers' arguments, so the app and the views share kept plans.
 */
export const appPlans: Handlers["appPlans"] = async (input: { fen?: unknown; moves?: unknown; level?: unknown }, ctx: Ctx): Promise<AppReply> => {
  const { fen, moves } = appTarget(input);
  const level = levelsOf(input.level === undefined || input.level === null ? undefined : [input.level])[0];
  const m: ModelSession = { asked: false };
  const views: Record<string, ViewAnswer> = {};
  const plans = (r: Served<PlanRow>) => (r === "stop" ? [] : r === "later" ? "later" : (r));
  if (moves) {
    const line = moves.join(" ");
    views.PlansInLine = await answer("PlansInLine", { moves: line, level }, async () => {
      const theory = await lineTheory(ctx, moves);
      return plans(await plansFor(ctx, m, { kind: "line", fen, line }, await lineOpening(ctx.deps.db, moves), { ...PRODUCER_PLAN_ARGS, level }, theory, true));
    });
  } else {
    views.PlansInPosition = await answer("PlansInPosition", { fen, level }, async () =>
      plans(await plansFor(ctx, m, { kind: "position", fen }, await positionOpening(ctx.deps.db, fen), { ...PRODUCER_PLAN_ARGS, level }, null, true)));
  }
  await recordModel(ctx.deps.db, m);
  return { fen, views, status: await readStatus(ctx.deps.db) };
};

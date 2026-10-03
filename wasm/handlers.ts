import { skills } from "./generated/realm.ts";
import type {
  AnalysePositionOutput, ExplainLinePlansOutput, ExplainPlansOutput, Handler, HandlerContext, Handlers, MastersAtPositionOutput, OpeningLookupOutput,
  OpeningOfGameLineOutput, PlayerAtPositionOutput, PositionImbalancesOutput, RatedMovesOutput, RowsCandidatesInput, RowsImbalancesInput,
  RowsLinePlansInput, RowsMasterGamesInput, RowsMasterMovesInput, RowsOpeningOfLineInput, RowsOpeningOfPositionInput, RowsPlayerGamesInput,
  RowsPlayerMovesInput, RowsPositionPlansInput, RowsRatedMovesInput, RowsTheoryInput, StatusInput, TheoryOfGameLineOutput,
} from "./generated/realm.ts";
import { Chess } from "./lib/chess.js";
import { elapsedMs, fits, spent } from "./lib/clock.ts";
import { ANALYSIS_TTL_MS, API_CALL_MS, DEEP_SEARCH_MS, DEEPEN_PICK, DEEPEN_TICK_MS, DEEPEN_WIDTH, MARK_WINDOW_MS, LICHESS_SPACING_MS, MASTERS_TTL_MS, MAX_KEYS, MODEL_CALL_MS, MODEL_OUTPUT_TOKENS, PLANS_TTL_MS, PLAYER_TTL_MS, RATED_TTL_MS, SEARCH_MS, SEARCH_UNTIL, THEORY_TTL_MS, YIELD_AT } from "./lib/config.ts";
import { BAND, COLOR, gameRecords, gameUrl, LEVEL, moveRecords, PLAYER, playerCells, playerFilter, pinned, ratedCells, ratedGrid, ratedRecords, ratedRequest, SPEED } from "./lib/explorer.ts";
import { runView } from "./lib/cypher.ts";
import { allWithValues } from "./lib/records.ts";
import type { WithValues } from "./lib/records.ts";
import { VIEWS } from "./lib/views.ts";
import type { ExplorerGameRecord, ExplorerMoveRecord, RatedMoveRecord } from "./lib/explorer.ts";
import { explorerAnswerFor, LichessRefused, lichessSession, recordLichess } from "./lib/lichess.ts";
import type { ExplorerOperation, LichessGateway, LichessSession } from "./lib/lichess.ts";
import { aiComplete, ModelRefused, ROLES } from "./lib/model.ts";
import type { ModelRole } from "./lib/model.ts";
import { citable, levelOf, parseModelJson, planRecords, promptFor, repairPrompt } from "./lib/plans.ts";
import type { Level, ParsedPlans, PlanArgs, PlanRecord } from "./lib/plans.ts";
import { sha256Hex } from "./lib/sha256.ts";
import { timed, timedSync } from "./lib/timing.ts";
import { readStatus, recordOutcome } from "./lib/status.ts";
import { theoryFor, titlesOfSans } from "./lib/theory.ts";
import type { TheoryRecord, WikibooksGateway } from "./lib/theory.ts";
import { analysisIdOf, canBatch, candidateRecords, configKey, DEEP, FULL, search, searchAll } from "./lib/engine.ts";
import type { CandidateLineRecord, Engine, SearchConfig } from "./lib/engine.ts";
import { imbalancesOf } from "./lib/imbalances.ts";
import type { Imbalances } from "./lib/imbalances.ts";
import { gameLine, lineOpeningOf } from "./lib/gameline.ts";
import type { GameLine } from "./lib/gameline.ts";
import { lineKeys, openingOf, openingOfLine, pawnKey, positionAfter, positionKey, splitLine, structureOf, structureSentence } from "./lib/openings.ts";
import type { Skeletons } from "./lib/openings.ts";
import { bookFor, keepAnalysis, keptAnalyses, skeletonsFor, sqlText } from "./lib/store.ts";
import type { Db, KeptAnalysis } from "./lib/store.ts";

/*
 * The realm's verbs. The ten public ones keep the names and contracts they had in the Node realm. The `rows*` verbs serve the
 * graph's producers: they take the keys the host sends, answer `{ rows, next }`, and keep what
 * they compute. `status` says what the realm could not do.
 */

/** What the host passes every handler, as synth typed it from realm.ts. */
type Ctx = HandlerContext;

function legal(fen: string): Chess {
  try {
    return new Chess(fen.trim());
  } catch (e) {
    throw new Error(`Not a legal position: ${fen} (${(e as Error).message})`);
  }
}

/*
 * Every verb is typed with what synth generated from its declaration, so a result the manifest
 * would refuse (a null where it says a number, a missing field) fails `npm run typecheck`. The
 * rows* adapters declare only "an object" or "a list of objects" to the host, so they are typed
 * by the records of the public handler they serve: one item of its output, plus their own fields.
 */
type Item<O> = O extends readonly (infer T)[] ? T : never;
interface Page<R> { rows: R[]; next: string | null }
type Paged<I, R> = Handler<I, Page<R>>;

const clamp = (v: number | undefined, dflt: number, lo: number, hi: number) =>
  Math.min(Math.max(Math.trunc(v ?? dflt), lo), hi);

/** The keys a producer was sent: a list of 1 to 256 strings, or a refusal. */
function keysOf(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_KEYS || value.some((k) => typeof k !== "string")) {
    throw new Error("Invalid producer keys");
  }
  return value as string[];
}

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

/*
 * A position's imbalances, worked out once a dispatch: the ImbalancesOf row and the candidate
 * lines both start from them. A dispatch is a fresh instance, so this lives as long as it does.
 */
const imbalancesSeen = new Map<string, Imbalances>();
function imbalancesFor(fen: string): Imbalances {
  let x = imbalancesSeen.get(fen);
  if (!x) {
    x = timedSync("imbalances", () => imbalancesOf(fen));
    imbalancesSeen.set(fen, x);
  }
  return x;
}

async function imbalanceRecords(db: Db, fens: string[]): Promise<ImbalanceRecord[]> {
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

async function openingRecords(db: Db, fens: string[]): Promise<OpeningRecord[]> {
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

/* ── The engine's lines ── */

/** A candidate row as the graph sees it: the public record, and the analysis it came from. */
export interface CandidateRow extends CandidateLineRecord {
  analysisId: string;
  nodes: number;
}

const isFresh = (a: KeptAnalysis | undefined): a is KeptAnalysis => a !== undefined && Date.now() - a.createdAt < ANALYSIS_TTL_MS;

/**
 * The kept analyses for these positions under one configuration, by FEN. For the graph's and
 * the app's reads (`deeper`), a fresh row from the background tick, searched deeper, stands in
 * for a page's under the graph's own configuration; its rows say the depth they reached. A caller
 * that asked for a depth cap (analysePosition) or keys what it makes on the analysis (plans)
 * reads the page's own rows only.
 */
async function keptFor(db: Db, c: SearchConfig, fens: string[], deeper: boolean): Promise<Map<string, KeptAnalysis>> {
  const kept = await keptAnalyses(db, configKey(c), fens);
  if (!deeper || configKey(c) !== configKey(FULL)) return kept;
  for (const [fen, deep] of await keptAnalyses(db, configKey(DEEP), fens, "deep_analyses")) if (isFresh(deep)) kept.set(fen, deep);
  return kept;
}

/**
 * The lines for one position under one configuration: kept ones while they are fresh, else a
 * new search, which is kept. A checkmate or stalemate has no lines and is never searched. A new
 * search under the graph's own configuration also queues the position for the background tick,
 * in its slot, with a keyed upsert the host can replay. A page never reads the queue.
 */
async function linesFor(ctx: Ctx, fen: string, c: SearchConfig, kept: KeptAnalysis | undefined): Promise<CandidateRow[]> {
  if (timedSync("legalMoves", () => legal(fen).moves().length === 0)) return [];
  let a = kept && Date.now() - kept.createdAt < ANALYSIS_TTL_MS ? kept : undefined;
  if (!a) {
    const started = Date.now();
    const s = await timed("search", () => search(ctx.deps.engine, fen, c));
    const key = configKey(c);
    const linesJson = JSON.stringify(s.lines);
    const elapsedMs = Date.now() - started;
    a = {
      fen, analysisId: analysisIdOf(key, linesJson), depth: s.depth, nodes: s.nodes, linesJson,
      recordsJson: timedSync("candidateRows", () => JSON.stringify(candidateRecords(fen, s, imbalancesFor(fen), elapsedMs))), elapsedMs, createdAt: Date.now(),
    };
    await timed("keepAnalysis", () => keepAnalysis(ctx.deps.db, key, a!));
    if (key === configKey(FULL)) {
      await ctx.deps.db.exec(
        `INSERT OR REPLACE INTO deepen_queue (slot, fen, queued_at) VALUES (${sqlText(slotOf(fen))}, ${sqlText(fen)}, ${sqlText(new Date().toISOString())})`,
      );
    }
  }
  const { analysisId, nodes } = a;
  return timedSync("keptRows", () => JSON.parse(a!.recordsJson) as CandidateLineRecord[]).map((r) => ({ ...r, analysisId, nodes }));
}

/**
 * The engine's best lines in each position, strongest first, each with what it changes about
 * the position's imbalances. A position with no legal moves returns nothing: there is nothing
 * to recommend in a checkmate or a stalemate, and the FEN says which. `depth` caps the search
 * and `multiPv` is the number of lines; the node budget is the realm's own.
 */
export const analysePosition: Handlers["analysePosition"] = async (input: { fens?: string[]; multiPv?: number; depth?: number }, ctx: Ctx) => {
  const c: SearchConfig = { ...FULL, multiPv: clamp(input.multiPv, 5, 1, 8), depthCap: clamp(input.depth, 18, 6, 22) };
  const fens = (input.fens ?? []).map((f) => f.trim());
  fens.forEach(legal);
  const kept = await keptFor(ctx.deps.db, c, fens, false);
  const out: CandidateLineRecord[] = [];
  for (const fen of fens) {
    for (const { analysisId: _id, nodes: _nodes, ...record } of await linesFor(ctx, fen, c, kept.get(fen))) out.push(record);
  }
  return allWithValues(out);
};

/**
 * The producer behind HAS_CANDIDATE. Kept lines come back as they are; a position not yet
 * searched is searched while the page has spent less than 60 percent of the deadline, and the
 * rest are left to the next page, whose cursor is the index of the first key it owes. Every
 * page serves at least one key, so a single position always answers in one read.
 */
export const rowsCandidates: Paged<RowsCandidatesInput, Item<AnalysePositionOutput> & { analysisId: string; nodes: number }> = async (input: { fens?: unknown; cursor?: unknown }, ctx: Ctx) => {
  const keys = keysOf(input.fens).map((f) => f.trim());
  let start = 0;
  if (input.cursor !== undefined && input.cursor !== null) {
    if (typeof input.cursor !== "string" || !/^\d{1,3}$/.test(input.cursor) || Number(input.cursor) >= keys.length) {
      throw new Error("Invalid cursor");
    }
    start = Number(input.cursor);
  }
  const page = keys.slice(start);
  page.forEach(legal);
  const kept = await keptFor(ctx.deps.db, FULL, page, true);
  const rows: CandidateRow[] = [];
  for (let i = start; i < keys.length; i++) {
    const fen = keys[i];
    const k = kept.get(fen);
    const fresh = k !== undefined && Date.now() - k.createdAt < ANALYSIS_TTL_MS;
    const first = i === start;
    if (!first && (spent() >= YIELD_AT || (!fresh && spent() >= SEARCH_UNTIL))) return { rows: allWithValues(rows), next: String(i) };
    rows.push(...(await linesFor(ctx, fen, FULL, k)));
  }
  return { rows: allWithValues(rows), next: null };
};

/* ── Deepening in the background ── */

/** The queue slot a position takes: the first three hex digits of its hash, so DEEPEN_SLOTS of them. */
const slotOf = (fen: string) => sha256Hex(fen).slice(0, 3);

/** What one tick did: how many positions it deepened, how many it could not, in how many rounds. */
interface Deepened { deepened: number; failed: number; rounds: number }

/**
 * The scheduled tick. It takes queued positions that were queued after they were last deepened
 * (or never were), oldest first, searches them at the deeper configuration, and keeps each answer
 * in deep_analyses, which the graph's and the app's reads prefer.
 *
 * Time: before every round, including the first, it checks that the round still fits in
 * DEEPEN_TICK_MS. The first round is estimated from the calibration (DEEP_SEARCH_MS a search,
 * DEEPEN_WIDTH of them when the host batches); every later one by how long the last one took.
 * Without the batch call a round is one search, so a slow runtime is caught after one search.
 *
 * Replay: the tick reads deepen_queue and deep_marks and writes only deep_analyses, with keyed
 * upserts whose id is their content, so the host can replay it when a page published first, and
 * a tick delivered twice keeps the same rows.
 */
export const deepen: Handler<Record<string, never>, Deepened> = async (_input: unknown, ctx: Ctx) => {
  const db = ctx.deps.db;
  const deepKey = configKey(DEEP);
  const picked = (await db.exec(
    `SELECT q.fen AS fen FROM deepen_queue q LEFT JOIN deep_marks m ON m.fen = q.fen ` +
      `WHERE m.fen IS NULL OR q.queued_at > m.deepened_at ORDER BY q.queued_at, q.slot LIMIT ${DEEPEN_PICK}`,
  )).map((r) => String(r.fen)).filter((fen) => {
    try {
      return legal(fen).moves().length > 0;
    } catch {
      return false;
    }
  });
  const width = canBatch(ctx.deps.engine) ? DEEPEN_WIDTH : 1;
  const out: Deepened = { deepened: 0, failed: 0, rounds: 0 };
  let roundMs = width * DEEP_SEARCH_MS;
  for (let i = 0; i < picked.length; i += width) {
    if (elapsedMs() + roundMs > DEEPEN_TICK_MS) break;
    const fens = picked.slice(i, i + width);
    const started = Date.now();
    let found: Awaited<ReturnType<typeof searchAll>>;
    try {
      found = await searchAll(ctx.deps.engine, fens, DEEP);
    } catch (e) {
      ctx.log(`deepening stopped: the engine refused a batch (${(e as Error).message})`);
      break;
    }
    roundMs = Date.now() - started;
    out.rounds++;
    for (const [k, fen] of fens.entries()) {
      const s = found[k];
      if (s instanceof Error) {
        out.failed++;
        ctx.log(`deepening ${fen} failed: ${s.message}`);
        continue;
      }
      const linesJson = JSON.stringify(s.lines);
      await keepAnalysis(db, deepKey, {
        fen, analysisId: analysisIdOf(deepKey, linesJson), depth: s.depth, nodes: s.nodes, linesJson,
        recordsJson: JSON.stringify(candidateRecords(fen, s, imbalancesFor(fen), roundMs)), elapsedMs: roundMs, createdAt: Date.now(),
      }, "deep_analyses");
      out.deepened++;
    }
  }
  return out;
};

/**
 * The marking tick, half a minute after each deepen tick: it records in deep_marks when each
 * position was last deepened, from the deeper rows of the last MARK_WINDOW_MS. It reads only
 * deep_analyses and writes only deep_marks, with keyed upserts. A missed mark only means a
 * position is deepened once more, to the same row.
 */
export const markDeepened: Handler<Record<string, never>, { marked: number }> = async (_input: unknown, ctx: Ctx) => {
  const db = ctx.deps.db;
  const since = new Date(Date.now() - MARK_WINDOW_MS).toISOString();
  const rows = await db.exec(
    `SELECT fen, created_at FROM deep_analyses WHERE config_key = ${sqlText(configKey(DEEP))} AND created_at >= ${sqlText(since)}`,
  );
  for (const r of rows) {
    await db.exec(`INSERT OR REPLACE INTO deep_marks (fen, deepened_at) VALUES (${sqlText(String(r.fen))}, ${sqlText(String(r.created_at))})`);
  }
  return { marked: rows.length };
};

/* ── What the realm could not do ── */

/** One ChessStatus row for each username the host asks about, as a plain list: the producer has no page. The installation has one owner. */
export const status: Handler<StatusInput, ({ username: string } & Awaited<ReturnType<typeof readStatus>>)[]> = async (input: { username?: unknown }, ctx: Ctx) => {
  const users = keysOf(input.username);
  const s = await readStatus(ctx.deps.db);
  return allWithValues(users.map((username) => ({ username, ...s })));
};

/* ── Paging ── */

/** What serving one unit of a producer's work came to: its rows, "later" when it did not fit, or "stop". */
type Served<R> = R[] | "later" | "stop";

/** The index a page starts at: the cursor this realm handed back last time, or the start. */
function cursorOf(cursor: unknown, count: number): number {
  if (cursor === undefined || cursor === null) return 0;
  if (typeof cursor !== "string" || !/^\d{1,5}$/.test(cursor) || Number(cursor) >= count) throw new Error("Invalid cursor");
  return Number(cursor);
}

/**
 * Serves units from the cursor until one does not fit, handing back the index of the first one
 * owed. Pages are disjoint: each returns rows only for the units it served. The first unit of a
 * page is always served, so the host's resent cursor always moves on. "stop" ends the whole
 * fetch, for a refusal that would only repeat.
 */
async function paged<U, R extends object>(units: U[], cursor: unknown, serve: (u: U, first: boolean) => Promise<Served<R>>): Promise<Page<WithValues<R>>> {
  const start = cursorOf(cursor, Math.max(units.length, 1));
  const rows: R[] = [];
  for (let i = start; i < units.length; i++) {
    const first = i === start;
    if (!first && spent() >= YIELD_AT) return { rows: allWithValues(rows), next: String(i) };
    const r = await serve(units[i], first);
    if (r === "later") return { rows: allWithValues(rows), next: String(i) };
    if (r === "stop") return { rows: allWithValues(rows), next: null };
    rows.push(...r);
  }
  return { rows: allWithValues(rows), next: null };
}

/* ── The Lichess explorer ── */

/** One Lichess request fits when it can wait its turn and still finish within the page. */
const lichessFits = (first: boolean) => () => first || fits(LICHESS_SPACING_MS + API_CALL_MS);

const fensOf = (keys: string[]) => keys.map((f) => f.trim()).map((f) => (legal(f), f));

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

const mastersParams = (fen: string) => ({ fen, moves: 12, topGames: 15 });
const playerParams = (fen: string, who: { player: string; color: string }) => ({ player: who.player, color: who.color, fen, recentGames: 8 });

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

/* ── Plans, by the model with the chess-plans skill ── */

/** A plan row as the graph sees it: the public record, and the analysis its lines came from. */
export interface PlanRow extends PlanRecord {
  analysisId: string;
  /** The game line, for line plans. */
  line?: string;
}

/** One dispatch's dealings with the model: whether it answered, and the code of a refusal. */
interface ModelSession {
  asked: boolean;
  refused?: string;
}

async function recordModel(db: Db, m: ModelSession): Promise<void> {
  if (m.refused || m.asked) await recordOutcome(db, { source: "model", code: m.refused, at: Date.now() });
}

/** A plan for a line describes the position the line reaches, told what the line has been. */
type PlanFor = { kind: "position"; fen: string } | { kind: "line"; fen: string; line: string };

/**
 * One position's plans, kept or made. They are kept under an identity made of what they were
 * made from: the kind and key, the analysis of the lines the model was shown, and a hash of every
 * other input to the prompt, the skill's digest included. Lines searched again that come out the
 * same keep their plans; anything else that changed asks the model again.
 *
 * `first` is whether this is the first unit of its page, which always runs. Any other unit
 * starts a search or a model call only when it fits, and is otherwise "later". A model refusal
 * that would only repeat (no grant, a budget spent) is noted on the session and is "stop".
 */
async function plansFor(
  ctx: Ctx, m: ModelSession, target: PlanFor, opening: string | null, args: PlanArgs, theory: TheoryRecord | null, first: boolean,
): Promise<Served<PlanRow>> {
  const db = ctx.deps.db;
  const { fen } = target;
  const withinCp = clamp(args.withinCp, 50, 0, 300);
  const multiPv = clamp(args.multiPv, 5, 1, 8);
  const depth = clamp(args.depth, 18, 6, 22);
  if (args.role !== undefined && args.role !== "" && !(ROLES as readonly string[]).includes(args.role)) {
    throw new Error(`The model role must be one of ${ROLES.join(", ")}`);
  }
  const role = (args.role || undefined) as ModelRole | undefined;
  if (legal(fen).moves().length === 0) return [];
  const x = imbalancesOf(fen);
  const structure = structureSentence(structureOf(fen, await skeletonsFor(db, pawnKey(fen))));
  const c: SearchConfig = { ...FULL, multiPv, depthCap: depth };
  const kept = (await keptFor(db, c, [fen], false)).get(fen);
  const fresh = kept !== undefined && Date.now() - kept.createdAt < ANALYSIS_TTL_MS;
  if (!first && !fresh && !fits(SEARCH_MS + 2 * MODEL_CALL_MS)) return "later";
  const candidates = await linesFor(ctx, fen, c, kept);
  const analysisId = candidates[0]?.analysisId ?? "";
  const level = levelOf(args.level);
  const key = target.kind === "line" ? target.line : fen;
  const inputsHash = sha256Hex(JSON.stringify({
    level, withinCp, role: role ?? "", multiPv, depth, facts: citable(x), structure, opening,
    theory: theory ? { title: theory.title, pliesPast: theory.pliesPast, textSha: sha256Hex(theory.theory) } : null,
    skill: skills.digest["chess-plans"],
  }));
  const identity = sha256Hex([target.kind, key, analysisId, inputsHash].join("\n"));
  const keptPlans = (await db.exec(`SELECT plans_json, created_at FROM plans WHERE identity = ${sqlText(identity)}`))[0];
  if (keptPlans && Date.now() - Date.parse(String(keptPlans.created_at)) < PLANS_TTL_MS) {
    return JSON.parse(String(keptPlans.plans_json)) as PlanRow[];
  }
  if (m.refused) return "stop";
  if (!first && !fits(2 * MODEL_CALL_MS)) return "later";

  const ask = (prompt: string) => {
    const reply = aiComplete(ctx, { prompt, skills: ["chess-plans"], maxOutputTokens: MODEL_OUTPUT_TOKENS, ...(role ? { role } : {}) });
    m.asked = true;
    return reply.text;
  };
  const prompt = promptFor(fen, x, opening, structure, candidates, withinCp, theory, level as Level);
  let text: string;
  let parsed: ParsedPlans;
  try {
    text = ask(prompt);
    try {
      parsed = parseModelJson(text);
    } catch (e) {
      text = ask(repairPrompt(prompt, e as Error));
      parsed = parseModelJson(text);
    }
  } catch (e) {
    if (e instanceof ModelRefused) {
      ctx.log(`no plans for ${key}: ${e.message}`);
      m.refused = e.code;
      return "stop";
    }
    throw e;
  }
  const rows: PlanRow[] = planRecords(fen, x, parsed, text, level as Level, opening, role).map((p) =>
    target.kind === "line"
      ? { ...p, planId: `${target.line}#${p.level}#${p.side}#${p.priority}#${p.name.slice(0, 40)}`, line: target.line, analysisId }
      : { ...p, analysisId });
  await db.exec(
    `INSERT OR REPLACE INTO plans (identity, kind, fen_or_line, analysis_id, inputs_hash, skill_sha, plans_json, created_at) VALUES (` +
      `${sqlText(identity)}, ${sqlText(target.kind)}, ${sqlText(key)}, ${sqlText(analysisId)}, ${sqlText(inputsHash)}, ` +
      `${sqlText(skills.digest["chess-plans"])}, ${sqlText(JSON.stringify(rows))}, ${sqlText(new Date().toISOString())})`,
  );
  return rows;
}

/** A position's opening as the plans prompt names it, from the book. */
async function positionOpening(db: Db, fen: string): Promise<string | null> {
  const hit = openingOf(fen, await bookFor(db, [positionKey(fen)]));
  return hit ? `${hit.eco} ${hit.name} (${hit.pgn})` : null;
}

/** A line's opening as the plans prompt names it: the deepest book name, and how long ago the line left the book. */
async function lineOpening(db: Db, moves: string[]): Promise<string | null> {
  const hit = openingOfLine(moves, await bookFor(db, lineKeys(moves)));
  return hit
    ? `${hit.eco} ${hit.name} (${hit.pgn})${hit.pliesPast ? `, left the book ${hit.pliesPast} ${hit.pliesPast === 1 ? "ply" : "plies"} ago` : ""}`
    : null;
}

/**
 * Theory for line plans: kept, or looked up when the lookup and the plans after it both fit.
 * Theory is evidence, not a requirement: a lookup that fails or is skipped for time is no theory.
 */
async function lineTheory(ctx: Ctx, moves: string[]): Promise<TheoryRecord | null> {
  try {
    const t = await theoryFor(ctx.deps.db, ctx.gateway, moves, THEORY_TTL_MS, () => fits(API_CALL_MS + SEARCH_MS + 2 * MODEL_CALL_MS));
    if (t === "later") ctx.log(`theory for "${moves.join(" ")}" was skipped for time; the plans are made without it`);
    return t === "later" ? null : t;
  } catch {
    return null;
  }
}

const publicPlan = <R extends PlanRow>({ analysisId: _id, ...p }: R): Omit<R, "analysisId"> => p;

/** Plans for a line carry the line, as the line views and explainLinePlans declare them. */
const withLine = (rows: Served<PlanRow>, line: string): Served<PlanRow & { line: string }> =>
  rows === "stop" || rows === "later" ? rows : rows.map((r) => ({ ...r, line }));

/**
 * The plans for both sides in each position, decided by a model with the chess-plans skill from
 * the position's imbalances, its opening-book name and the engine's candidate moves. The facts
 * are computed; the judgement is the model's. Without the model (no grant, a budget spent) there
 * are no plans, and ChessStatus says why.
 */
export const explainPlans: Handler<{ fens?: string[] } & PlanArgs, ExplainPlansOutput> = async (input: { fens?: string[] } & PlanArgs, ctx: Ctx) => {
  const m: ModelSession = { asked: false };
  const out: PlanRecord[] = [];
  for (const raw of input.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const r = await plansFor(ctx, m, { kind: "position", fen }, await positionOpening(ctx.deps.db, fen), input, null, true);
    if (r === "stop") break;
    if (r !== "later") out.push(...r.map(publicPlan));
  }
  await recordModel(ctx.deps.db, m);
  return allWithValues(out);
};

/**
 * The plans in the position a game line reaches, told the line's deepest opening name, which a
 * position looked up alone has lost once it is past the book, and what the wikibook says along it.
 */
export const explainLinePlans: Handler<{ lines?: string[] } & PlanArgs, ExplainLinePlansOutput> = async (input: { lines?: string[] } & PlanArgs, ctx: Ctx) => {
  const m: ModelSession = { asked: false };
  const out: (PlanRecord & { line: string })[] = [];
  for (const raw of input.lines ?? []) {
    const moves = splitLine(raw);
    const line = moves.join(" ");
    const fen = positionAfter(moves);
    const theory = await lineTheory(ctx, moves);
    const r = withLine(await plansFor(ctx, m, { kind: "line", fen, line }, await lineOpening(ctx.deps.db, moves), input, theory, true), line);
    if (r === "stop") break;
    if (r !== "later") out.push(...r.map(publicPlan));
  }
  await recordModel(ctx.deps.db, m);
  return allWithValues(out);
};

/* The producers' fixed arguments, as the Node realm declared them: the level is the query's. */
const PRODUCER_PLAN_ARGS = { withinCp: 50, multiPv: 5, depth: 18, role: "best" } as const;

/** The levels a query pinned, or intermediate when it pinned none. */
const levelsOf = (level: unknown) => pinned(level, "level", LEVEL) ?? ["intermediate"];

/**
 * One unit a page: a plan costs a search and up to two model calls, which is a dispatch. The
 * cursor is the index of the next unit; a refusal from the model ends the fetch with no plans.
 */
async function onePlanPage<U, R extends PlanRow>(ctx: Ctx, units: U[], cursor: unknown, serve: (m: ModelSession, u: U) => Promise<Served<R>>) {
  const m: ModelSession = { asked: false };
  const start = cursorOf(cursor, Math.max(units.length, 1));
  let page: Page<WithValues<R>> = { rows: [], next: null };
  if (start < units.length) {
    const r = await serve(m, units[start]);
    page = r === "stop" || r === "later" ? { rows: [], next: null } : { rows: allWithValues(r), next: start + 1 < units.length ? String(start + 1) : null };
  }
  await recordModel(ctx.deps.db, m);
  return page;
}

export const rowsPositionPlans: Paged<RowsPositionPlansInput, Item<ExplainPlansOutput> & { analysisId: string }> = async (input: { fens?: unknown; level?: unknown; cursor?: unknown }, ctx: Ctx) => {
  const levels = levelsOf(input.level);
  const units = fensOf(keysOf(input.fens)).flatMap((fen) => levels.map((level) => ({ fen, level })));
  return onePlanPage(ctx, units, input.cursor, async (m, { fen, level }) =>
    plansFor(ctx, m, { kind: "position", fen }, await positionOpening(ctx.deps.db, fen), { ...PRODUCER_PLAN_ARGS, level }, null, true));
};

export const rowsLinePlans: Paged<RowsLinePlansInput, Item<ExplainLinePlansOutput> & { analysisId: string }> = async (input: { lines?: unknown; level?: unknown; cursor?: unknown }, ctx: Ctx) => {
  const levels = levelsOf(input.level);
  const units = keysOf(input.lines).flatMap((raw) => {
    const moves = splitLine(raw);
    return levels.map((level) => ({ moves, level }));
  });
  return onePlanPage(ctx, units, input.cursor, async (m, { moves, level }) => {
    const line = moves.join(" ");
    const fen = positionAfter(moves);
    const theory = await lineTheory(ctx, moves);
    return withLine(await plansFor(ctx, m, { kind: "line", fen, line }, await lineOpening(ctx.deps.db, moves), { ...PRODUCER_PLAN_ARGS, level }, theory, true), line);
  });
};

/* ── Chesscalator ── */

/*
 * The app's three calls. The frame it runs in has one serialized realm.call and no views, so
 * each call answers the views the page shows for one moment of use, under the views' names:
 * the rows come from the same code as the producers' and go through the views' own Cypher
 * (wasm/lib/cypher.ts), so a column, an order or a limit is the view's.
 *
 * Each view answers on its own: one that fails carries its error and the rest still answer. A
 * step that would not fit in the dispatch is not started and its view says `skipped`. Every
 * reply carries ChessStatus, which is how the page explains an empty column.
 */

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

/* Every verb the manifest declares, each checked against its generated type. */
void ({
  positionImbalances, openingLookup, openingOfGameLine, analysePosition, mastersAtPosition, playerAtPosition, ratedMoves, theoryOfGameLine,
  explainPlans, explainLinePlans, rowsImbalances, rowsOpeningOfPosition, rowsOpeningOfLine, rowsCandidates, status, rowsTheory,
  rowsPositionPlans, rowsLinePlans, rowsMasterMoves, rowsMasterGames, rowsPlayerMoves, rowsPlayerGames, rowsRatedMoves,
  appPosition, appPractice, appPlans, deepen, markDeepened,
} satisfies Handlers);

import { Chess } from "./lib/chess.js";
import { ANALYSIS_TTL_MS, DEADLINE_MS, MAX_KEYS, SEARCH_UNTIL, YIELD_AT } from "./lib/config.ts";
import { analysisIdOf, candidateRecords, configKey, FULL, search } from "./lib/engine.ts";
import type { CandidateLineRecord, Engine, SearchConfig } from "./lib/engine.ts";
import { imbalancesOf } from "./lib/imbalances.ts";
import { lineKeys, openingOf, openingOfLine, pawnKey, positionAfter, positionKey, splitLine, structureOf, structureSentence } from "./lib/openings.ts";
import type { Skeletons } from "./lib/openings.ts";
import { readStatus } from "./lib/status.ts";
import { bookFor, keepAnalysis, keptAnalyses, skeletonsFor } from "./lib/store.ts";
import type { Db, KeptAnalysis } from "./lib/store.ts";

/*
 * The realm's verbs. The ten public ones keep the names and contracts they had in the Node realm. The `rows*` verbs serve the
 * graph's producers: they take the keys the host sends, answer `{ rows, next }`, and keep what
 * they compute. `status` says what the realm could not do.
 */

interface Ctx {
  log(line: string): void;
  deps: { db: Db; engine: Engine };
}

/* The host starts a fresh instance for every dispatch, so this is when the dispatch began. */
const dispatchStarted = Date.now();
const spent = () => (Date.now() - dispatchStarted) / DEADLINE_MS;

function legal(fen: string): Chess {
  try {
    return new Chess(fen.trim());
  } catch (e) {
    throw new Error(`Not a legal position: ${fen} (${(e as Error).message})`);
  }
}

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

/* ── The engine's lines ── */

/** A candidate row as the graph sees it: the public record, and the analysis it came from. */
export interface CandidateRow extends CandidateLineRecord {
  analysisId: string;
  nodes: number;
}

/**
 * The lines for one position under one configuration: kept ones while they are fresh, else a
 * new search, which is kept. A checkmate or stalemate has no lines and is never searched.
 */
async function linesFor(ctx: Ctx, fen: string, c: SearchConfig, kept: KeptAnalysis | undefined): Promise<CandidateRow[]> {
  if (legal(fen).moves().length === 0) return [];
  let a = kept && Date.now() - kept.createdAt < ANALYSIS_TTL_MS ? kept : undefined;
  if (!a) {
    const started = Date.now();
    const s = await search(ctx.deps.engine, fen, c);
    const key = configKey(c);
    const linesJson = JSON.stringify(s.lines);
    const elapsedMs = Date.now() - started;
    a = {
      fen, analysisId: analysisIdOf(key, linesJson), depth: s.depth, nodes: s.nodes, linesJson,
      recordsJson: JSON.stringify(candidateRecords(fen, s, imbalancesOf(fen), elapsedMs)), elapsedMs, createdAt: Date.now(),
    };
    await keepAnalysis(ctx.deps.db, key, a);
  }
  const { analysisId, nodes } = a;
  return (JSON.parse(a.recordsJson) as CandidateLineRecord[]).map((r) => ({ ...r, analysisId, nodes }));
}

/**
 * The engine's best lines in each position, strongest first, each with what it changes about
 * the position's imbalances. A position with no legal moves returns nothing: there is nothing
 * to recommend in a checkmate or a stalemate, and the FEN says which. `depth` caps the search
 * and `multiPv` is the number of lines; the node budget is the realm's own.
 */
export const analysePosition = async (input: { fens?: string[]; multiPv?: number; depth?: number }, ctx: Ctx) => {
  const c: SearchConfig = { ...FULL, multiPv: clamp(input.multiPv, 5, 1, 8), depthCap: clamp(input.depth, 18, 6, 22) };
  const fens = (input.fens ?? []).map((f) => f.trim());
  fens.forEach(legal);
  const kept = await keptAnalyses(ctx.deps.db, configKey(c), fens);
  const out: CandidateLineRecord[] = [];
  for (const fen of fens) {
    for (const { analysisId: _id, nodes: _nodes, ...record } of await linesFor(ctx, fen, c, kept.get(fen))) out.push(record);
  }
  return out;
};

/**
 * The producer behind HAS_CANDIDATE. Kept lines come back as they are; a position not yet
 * searched is searched while the page has spent less than 60 percent of the deadline, and the
 * rest are left to the next page, whose cursor is the index of the first key it owes. Every
 * page serves at least one key, so a single position always answers in one read.
 */
export const rowsCandidates = async (input: { fens?: unknown; cursor?: unknown }, ctx: Ctx) => {
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
  const kept = await keptAnalyses(ctx.deps.db, configKey(FULL), page);
  const rows: CandidateRow[] = [];
  for (let i = start; i < keys.length; i++) {
    const fen = keys[i];
    const k = kept.get(fen);
    const fresh = k !== undefined && Date.now() - k.createdAt < ANALYSIS_TTL_MS;
    const first = i === start;
    if (!first && (spent() >= YIELD_AT || (!fresh && spent() >= SEARCH_UNTIL))) return { rows, next: String(i) };
    rows.push(...(await linesFor(ctx, fen, FULL, k)));
  }
  return { rows, next: null };
};

/* ── What the realm could not do ── */

/** One ChessStatus row for each username the host asks about. The installation has one owner. */
export const status = async (input: { username?: unknown }, ctx: Ctx) => {
  const users = keysOf(input.username);
  const s = await readStatus(ctx.deps.db);
  return { rows: users.map((username) => ({ username, ...s })), next: null };
};

/* ── The handlers that reach Lichess, the wikibook and the model ── */

/* Each of these is ported in its own change; until then it says so plainly. */
const notYet = (verb: string): never => {
  throw new Error(`chess.${verb} is not available in this build of the captured realm yet`);
};

export const theoryOfGameLine = async () => notYet("theoryOfGameLine");
export const explainPlans = async () => notYet("explainPlans");
export const explainLinePlans = async () => notYet("explainLinePlans");
export const mastersAtPosition = async () => notYet("mastersAtPosition");
export const playerAtPosition = async () => notYet("playerAtPosition");
export const ratedMoves = async () => notYet("ratedMoves");

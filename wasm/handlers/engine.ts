/*
 * The engine's lines: kept analyses while they are fresh, a new search when they are not, and the
 * deepening queue that a new search under the graph's own configuration joins.
 */

import type { AnalysePositionOutput, Handlers, RowsCandidatesInput } from "../generated/realm.ts";
import { fits, spent } from "../lib/clock.ts";
import { ANALYSIS_TTL_MS, DEFAULT_DEPTH, MAX_DEPTH, MIN_DEPTH, MULTI_PV, SEARCH_UNTIL, YIELD_AT } from "../lib/config.ts";
import { allWithValues } from "../lib/records.ts";
import { sha256Hex } from "../lib/sha256.ts";
import { timed, timedSync } from "../lib/timing.ts";
import { analysisIdOf, candidateRecords, configKey, DEEP, FULL, positionWorstMs, search, searchAt } from "../lib/engine.ts";
import type { CandidateLineRecord, SearchConfig } from "../lib/engine.ts";
import { keepAnalysis, keptAnalyses, sqlText } from "../lib/store.ts";
import type { Db, KeptAnalysis } from "../lib/store.ts";
import { clamp, imbalancesFor, keysOf, legal } from "./shared.ts";
import type { Ctx, Item, Paged } from "./shared.ts";

/** A candidate row as the graph sees it: the public record, and the analysis it came from. */
export interface CandidateRow extends CandidateLineRecord {
  analysisId: string;
  nodes: number;
}

/** A candidate row for the depth it was asked at, which the graph's CandidateMove carries. */
export type DepthRow = CandidateRow & { askedDepth: number };

/*
 * The rows of a search asked at `depth`. Rows at the default depth keep their identity, the FEN and
 * the move; at any other depth the identity also names the depth, so the same move at two depths
 * is two rows, as it is two searches.
 */
export const atDepth = (rows: CandidateRow[], depth: number): DepthRow[] =>
  rows.map((r) => ({ ...r, askedDepth: depth, ...(depth === DEFAULT_DEPTH ? {} : { candidateId: `${r.candidateId}#depth=${depth}` }) }));

/** A depth a query pinned, refused as PUSHDOWN_VALUE when it is not a whole number the realm searches to. */
export function pinnedDepths(values: unknown): number[] {
  if (values === undefined || values === null) return [DEFAULT_DEPTH];
  if (!Array.isArray(values) || values.some((v) => typeof v !== "string" || !/^\d{1,2}$/.test(v) || Number(v) < MIN_DEPTH || Number(v) > MAX_DEPTH)) {
    throw new Error(`PUSHDOWN_VALUE: askedDepth must be a whole number from ${MIN_DEPTH} to ${MAX_DEPTH}`);
  }
  return [...new Set((values as string[]).map(Number))];
}

const isFresh = (a: KeptAnalysis | undefined): a is KeptAnalysis => a !== undefined && Date.now() - a.createdAt < ANALYSIS_TTL_MS;

/**
 * The kept analyses for these positions under one configuration, by FEN. For the graph's and
 * the app's reads (`deeper`), a fresh row from the background tick, searched deeper, stands in
 * for a page's under the graph's own configuration; its rows say the depth they reached. A caller
 * that asked for a depth cap (analysePosition) or keys what it makes on the analysis (plans)
 * reads the page's own rows only.
 */
export async function keptFor(db: Db, c: SearchConfig, fens: string[], deeper: boolean): Promise<Map<string, KeptAnalysis>> {
  const kept = await keptAnalyses(db, configKey(c), fens);
  if (!deeper || configKey(c) !== configKey(FULL)) return kept;
  for (const [fen, deep] of await keptAnalyses(db, configKey(DEEP), fens, "deep_analyses")) if (isFresh(deep)) kept.set(fen, deep);
  return kept;
}

/**
 * The lines for one position under one configuration: kept ones while they are fresh, else a
 * new search, which is kept. A checkmate or stalemate has no lines and is never searched. A new
 * search under the graph's own configuration also queues the position for the background tick,
 * in its slot, with a keyed upsert. A page never reads the queue, but a page that searches has
 * read analyses before writing it, so the host does not replay it when another dispatch published
 * first: that page's analyses and queue rows are lost, and the next read searches again.
 */
export async function linesFor(ctx: Ctx, fen: string, c: SearchConfig, kept: KeptAnalysis | undefined): Promise<CandidateRow[]> {
  if (timedSync("legalMoves", () => legal(fen).moveCount() === 0)) return [];
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
 * to recommend in a checkmate or a stalemate, and the FEN says which. `depth` is the depth to
 * search to, with the node budget searchAt gives it, and `multiPv` is the number of lines.
 */
export const analysePosition: Handlers["analysePosition"] = async (input: { fens?: string[]; multiPv?: number; depth?: number }, ctx: Ctx) => {
  const c: SearchConfig = searchAt(clamp(input.depth, DEFAULT_DEPTH, MIN_DEPTH, MAX_DEPTH), clamp(input.multiPv, MULTI_PV, 1, 8));
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
 * The producer behind HAS_CANDIDATE, for every position the host names at every depth the query
 * pinned (`askedDepth`), or at the default depth when it pinned none. Kept lines come back as they
 * are; a position not yet searched at a depth is searched while the page has spent less than 60
 * percent of the deadline and the search and its lines still fit before the page hands back, and
 * the rest are left to the next page, whose cursor is the index of the first position and depth it
 * owes. Every page serves at least one, so a single position always answers in one read.
 */
export const rowsCandidates: Paged<RowsCandidatesInput, Item<AnalysePositionOutput> & { analysisId: string; nodes: number; askedDepth: number }> = async (input: { fens?: unknown; depth?: unknown; cursor?: unknown }, ctx: Ctx) => {
  const keys = keysOf(input.fens).map((f) => f.trim());
  const units = pinnedDepths(input.depth).flatMap((depth) => keys.map((fen) => ({ fen, depth, c: searchAt(depth) })));
  let start = 0;
  if (input.cursor !== undefined && input.cursor !== null) {
    if (typeof input.cursor !== "string" || !/^\d{1,4}$/.test(input.cursor) || Number(input.cursor) >= units.length) {
      throw new Error("Invalid cursor");
    }
    start = Number(input.cursor);
  }
  const page = units.slice(start);
  page.forEach((u) => legal(u.fen));
  const kept = new Map<number, Map<string, KeptAnalysis>>();
  for (const depth of new Set(page.map((u) => u.depth))) {
    kept.set(depth, await keptFor(ctx.deps.db, searchAt(depth), page.filter((u) => u.depth === depth).map((u) => u.fen), true));
  }
  const rows: DepthRow[] = [];
  for (let i = start; i < units.length; i++) {
    const { fen, depth, c } = units[i];
    const k = kept.get(depth)!.get(fen);
    const fresh = k !== undefined && Date.now() - k.createdAt < ANALYSIS_TTL_MS;
    const first = i === start;
    if (!first && (spent() >= YIELD_AT || (!fresh && (spent() >= SEARCH_UNTIL || !fits(positionWorstMs(c)))))) return { rows: allWithValues(rows), next: String(i) };
    rows.push(...atDepth(await linesFor(ctx, fen, c, k), depth));
  }
  return { rows: allWithValues(rows), next: null };
};

/** The queue slot a position takes: the first three hex digits of its hash, so DEEPEN_SLOTS of them. */
const slotOf = (fen: string) => sha256Hex(fen).slice(0, 3);

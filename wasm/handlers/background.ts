/*
 * The scheduled work, and what the realm could not do: the two ticks that deepen queued
 * positions, and the ChessStatus rows.
 */

import type { Handler, StatusInput } from "../generated/realm.ts";
import { elapsedMs } from "../lib/clock.ts";
import { DEEP_SEARCH_MS, DEEPEN_PICK, DEEPEN_TICK_MS, DEEPEN_WIDTH, MARK_WINDOW_MS } from "../lib/config.ts";
import { allWithValues } from "../lib/records.ts";
import { readStatus } from "../lib/status.ts";
import { analysisIdOf, canBatch, candidateRecords, configKey, DEEP, searchAll } from "../lib/engine.ts";
import { keepAnalysis, sqlText } from "../lib/store.ts";
import { imbalancesFor, keysOf, legal } from "./shared.ts";
import type { Ctx } from "./shared.ts";

/** What one tick did: how many positions it deepened, how many it could not, in how many rounds. */
interface Deepened { deepened: number; failed: number; rounds: number }

/**
 * The scheduled tick. It takes queued positions that were queued after they were last deepened
 * or given up on (or never were), oldest first, searches them at the deeper configuration, and
 * keeps each answer in deep_analyses, which the graph's and the app's reads prefer.
 *
 * Time: the first round is one search, so whatever the runtime, the tick spends at most one
 * search's time before it has a measurement. Before every round, the first included, it checks
 * the round still fits in DEEPEN_TICK_MS: the first by the calibration (DEEP_SEARCH_MS), the
 * second by the measured search, and every later one by the round before. With the engine's
 * batch call the later rounds are DEEPEN_WIDTH searches side by side. A host that ran a batch one
 * search after another would take at most one more search's time than the budget.
 *
 * A search that fails, or a queued FEN with no legal move, is written to deep_failures, which the
 * marking tick turns into a mark, so it leaves the queue until a page queues it again.
 *
 * Replay: the tick reads deepen_queue and deep_marks and writes only deep_analyses and
 * deep_failures, with keyed upserts whose id is their content, so the host can replay it when a
 * page published first, and a tick delivered twice keeps the same rows.
 */
export const deepen: Handler<Record<string, never>, Deepened> = async (_input: unknown, ctx: Ctx) => {
  const db = ctx.deps.db;
  const deepKey = configKey(DEEP);
  const queued = (await db.exec(
    `SELECT q.fen AS fen FROM deepen_queue q LEFT JOIN deep_marks m ON m.fen = q.fen ` +
      `WHERE m.fen IS NULL OR q.queued_at > m.deepened_at ORDER BY q.queued_at, q.slot LIMIT ${DEEPEN_PICK}`,
  )).map((r) => String(r.fen));
  const giveUp = (fen: string, error: string) =>
    db.exec(
      `INSERT OR REPLACE INTO deep_failures (fen, failed_at, error) VALUES (${sqlText(fen)}, ${sqlText(new Date().toISOString())}, ${sqlText(error.slice(0, 500))})`,
    );
  const picked: string[] = [];
  for (const fen of queued) {
    let playable = false;
    try {
      playable = legal(fen).moves().length > 0;
    } catch {
      playable = false;
    }
    if (playable) picked.push(fen);
    else await giveUp(fen, "no legal move");
  }
  const width = canBatch(ctx.deps.engine) ? DEEPEN_WIDTH : 1;
  const out: Deepened = { deepened: 0, failed: 0, rounds: 0 };
  let estimate = DEEP_SEARCH_MS;
  for (let i = 0; i < picked.length;) {
    if (elapsedMs() + estimate > DEEPEN_TICK_MS) break;
    const fens = picked.slice(i, i + (out.rounds === 0 ? 1 : width));
    i += fens.length;
    const started = Date.now();
    let found: Awaited<ReturnType<typeof searchAll>>;
    try {
      found = await searchAll(ctx.deps.engine, fens, DEEP);
    } catch (e) {
      ctx.log(`deepening stopped: the engine refused a batch (${(e as Error).message})`);
      break;
    }
    const roundMs = Date.now() - started;
    // After the one-search first round, the next round is estimated as side by side. After that,
    // each round is estimated by the one before, however the host ran it.
    estimate = roundMs;
    out.rounds++;
    for (const [k, fen] of fens.entries()) {
      const s = found[k];
      if (s instanceof Error) {
        out.failed++;
        ctx.log(`deepening ${fen} failed: ${s.message}`);
        await giveUp(fen, s.message);
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
 * position was last deepened or given up on, from the deeper rows and the failures of the last
 * MARK_WINDOW_MS. It reads only deep_analyses and deep_failures and writes only deep_marks, with
 * keyed upserts. A missed mark only means a position is tried once more.
 */
export const markDeepened: Handler<Record<string, never>, { marked: number }> = async (_input: unknown, ctx: Ctx) => {
  const db = ctx.deps.db;
  const since = new Date(Date.now() - MARK_WINDOW_MS).toISOString();
  const done = await db.exec(
    `SELECT fen, created_at AS at FROM deep_analyses WHERE config_key = ${sqlText(configKey(DEEP))} AND created_at >= ${sqlText(since)}`,
  );
  const failed = await db.exec(`SELECT fen, failed_at AS at FROM deep_failures WHERE failed_at >= ${sqlText(since)}`);
  // A position both deepened and given up on in the window keeps the later time.
  const latest = new Map<string, string>();
  for (const r of [...done, ...failed]) {
    const at = String(r.at);
    const fen = String(r.fen);
    if (!latest.has(fen) || at > latest.get(fen)!) latest.set(fen, at);
  }
  for (const [fen, at] of latest) {
    await db.exec(`INSERT OR REPLACE INTO deep_marks (fen, deepened_at) VALUES (${sqlText(fen)}, ${sqlText(at)})`);
  }
  return { marked: latest.size };
};

/* ── What the realm could not do ── */

/** One ChessStatus row for each username the host asks about, as a plain list: the producer has no page. The installation has one owner. */
export const status: Handler<StatusInput, ({ username: string } & Awaited<ReturnType<typeof readStatus>>)[]> = async (input: { username?: unknown }, ctx: Ctx) => {
  const users = keysOf(input.username);
  const s = await readStatus(ctx.deps.db);
  return allWithValues(users.map((username) => ({ username, ...s })));
};

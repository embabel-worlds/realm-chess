import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Chess } from "chess.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runView } from "../wasm/lib/cypher";
import { DEEP_DEPTH_CAP, DEEP_NODES, DEEPEN_TICK_MS, DEEPEN_WIDTH, FULL_NODES } from "../wasm/lib/config";
import { VIEWS } from "../wasm/lib/views";
import { fakeEngine, FOOLS_MATE, positions } from "./guest/fakes";
import { FakeDb, realmHost } from "./guest/host";
import { type Clock, fetchProducer } from "./guest/producer";
import { buildGuest, dispatch, hasTooling, TOOLING } from "./guest/runtime";

/*
 * Deepening in the background: a position a page searched is queued once, and the scheduled
 * chess.deepen searches queued positions again at the deeper configuration, within its share of
 * the dispatch, keeping rows that every later read prefers.
 *
 * The engine is the fake one, each search costing whatever fake time a test sets, so a tick's
 * budget is checked on the guest's own clock. When the appliance tooling's shim has the batch
 * form of a dependency call, the tick uses it, and the host's model here runs a batch side by
 * side or one search after another; an older shim runs the same tick one call at a time.
 */

const hasBatch = hasTooling && readFileSync(join(TOOLING!, "shim.js"), "utf8").includes(".batch");
const T0 = Date.parse("2026-10-03T09:00:00Z");
const TICK = 5;
const DAY = 24 * 60 * 60 * 1000;
const fenAfter = (moves: string) => {
  const c = new Chess();
  for (const m of moves.split(" ").filter(Boolean)) c.move(m);
  return c.fen();
};
const E4 = fenAfter("e4");
const best = VIEWS.find((v) => v.name === "BestMoves")!;

function setup(o: { parallel?: boolean } = {}) {
  const clock: Clock = { now: T0 };
  const db = new FakeDb();
  const cost = { ms: 0 };
  const engine = fakeEngine(clock, cost);
  const host = realmHost(db, { engine: engine.analyse, clock, parallelBatches: o.parallel });
  /** One dispatch, published when it returns, with the statements it made. */
  const run = (verb: string, args: Record<string, unknown>) => {
    const started = clock.now;
    const before = db.statements.length;
    db.begin();
    const d = dispatch(buildGuest(), `chess.${verb}`, args, { host, clock: () => (clock.now += TICK) });
    if (d.error !== undefined) {
      db.rollback();
      throw new Error(d.error);
    }
    db.commit();
    return { result: d.result as Record<string, unknown>, ms: clock.now - started, statements: db.statements.slice(before), logs: d.logs };
  };
  const look = (fen: string, moves?: string) => run("appPosition", moves ? { fen, moves } : { fen });
  const tick = () => run("deepen", {}) as ReturnType<typeof run> & { result: { deepened: number; failed: number; rounds: number } };
  const queued = () => db.exec("SELECT fen FROM deepen_queue ORDER BY fen").map((r) => r.fen);
  const deep = () => db.exec("SELECT fen, analysis_id, depth, nodes FROM deep_analyses ORDER BY fen");
  const fetch = async (fens: string[]) =>
    (await fetchProducer({ module: buildGuest(), handler: "chess.rowsCandidates", keyArgument: "fens", keys: fens, db, host, clock, tickMs: TICK })).rows;
  return { clock, db, host, engine, cost, run, look, tick, queued, deep, fetch };
}

const writes = (statements: string[]) => statements.filter((q) => !/^\s*SELECT\b/i.test(q));

describe("the deepen schedule, as declared", () => {
  it("runs chess.deepen every minute with no arguments", () => {
    const entry = (JSON.parse(readFileSync("dist/manifest.json", "utf8")).entries as Record<string, unknown>[]).find((e) => e.name === "deepen")!;
    expect(entry.schedule).toBe("0 * * * * *");
    expect((entry.inputSchema as { required?: string[] }).required ?? []).toEqual([]);
  });
});

describe.skipIf(!hasTooling)("deepening in the background, in the guest", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((f: () => void) => {
      f();
      return 0;
    }) as unknown as typeof setTimeout);
  });
  afterEach(() => vi.restoreAllMocks());

  it("looking at a position queues it once: the first search adds it, later looks write nothing", async () => {
    const s = setup();
    s.look(E4, "e4");
    expect(s.queued()).toEqual([E4]);
    const again = s.look(E4, "e4");
    expect(writes(again.statements)).toEqual([]);
    expect(s.queued()).toEqual([E4]);
    // A position searched for the graph is queued too; a mate, never searched, is not.
    const [other] = positions(1, 11);
    await s.fetch([other, FOOLS_MATE]);
    expect(s.queued()).toEqual([E4, other].sort());
    // A page only ever adds to the queue.
    for (const q of writes(s.db.statements).filter((x) => /deepen_queue/.test(x))) expect(q).toMatch(/^INSERT OR IGNORE INTO deepen_queue /);
  });

  it.each([false, true])("a tick stays within its budget and publishes deeper rows (batch side by side: %s)", async (parallel) => {
    const s = setup({ parallel });
    const fens = positions(10, 5);
    await s.fetch(fens);
    s.cost.ms = 6_000;
    const t = s.tick();
    const width = hasBatch && parallel ? 1 : DEEPEN_WIDTH;
    // A round of DEEPEN_WIDTH searches takes 6 s side by side and 12 s one after another, and a
    // round starts only while one as long as the last still fits in 15 s.
    const rounds = hasBatch && parallel ? 2 : 1;
    expect(t.result).toEqual({ deepened: rounds * DEEPEN_WIDTH, failed: 0, rounds });
    expect(t.ms).toBeLessThanOrEqual(DEEPEN_TICK_MS);
    expect(t.ms).toBeGreaterThanOrEqual(rounds * width * 6_000);
    if (hasBatch) expect(s.host.batches).toEqual(Array(rounds).fill(DEEPEN_WIDTH));
    const rows = s.deep();
    expect(rows).toHaveLength(rounds * DEEPEN_WIDTH);
    for (const r of rows) expect(r).toMatchObject({ depth: String(DEEP_DEPTH_CAP), nodes: String(DEEP_NODES) });
    // The tick writes only its own table, each write a keyed upsert.
    expect(writes(t.statements).length).toBe(rows.length);
    for (const w of writes(t.statements)) expect(w).toMatch(/^INSERT OR REPLACE INTO deep_analyses /);
  });

  it("later ticks take the rest, newest first, and a fresh deeper row is not searched again", async () => {
    const s = setup({ parallel: true });
    const fens = positions(5, 9);
    for (const [i, fen] of fens.entries()) {
      s.clock.now = T0 + i * 1000;
      await s.fetch([fen]);
    }
    const first = s.tick();
    expect(s.deep().map((r) => r.fen).sort()).toEqual(fens.slice(-first.result.deepened).sort());
    while (s.deep().length < fens.length) s.tick();
    const searches = s.host.searches;
    const idle = s.tick();
    expect(idle.result).toEqual({ deepened: 0, failed: 0, rounds: 0 });
    expect(s.host.searches).toBe(searches);
  });

  it("a later read returns the deeper analysis, in the app and through the graph's producer alike", async () => {
    const s = setup();
    const first = s.look(E4, "e4").result as { views: Record<string, { rows: Record<string, unknown>[] }> };
    expect(first.views.BestMoves.rows[0].depth).toBe(18);
    s.tick();
    const later = s.look(E4, "e4").result as { views: Record<string, { rows: Record<string, unknown>[] }> };
    expect(later.views.BestMoves.rows.map((r) => r.depth)).toEqual(later.views.BestMoves.rows.map(() => DEEP_DEPTH_CAP));
    const rows = await s.fetch([E4]);
    expect(new Set(rows.map((r) => r.analysisId))).toEqual(new Set([s.deep()[0].analysis_id]));
    expect(rows.every((r) => r.nodes === DEEP_NODES)).toBe(true);
    expect(later.views.BestMoves.rows).toEqual(runView(best, { fen: E4, withinCp: 50, maxLines: 5 }, rows));
    // A page asking for a configuration of its own is not answered from the deeper rows.
    const own = s.run("analysePosition", { fens: [E4], multiPv: 3 }).result as unknown as Record<string, unknown>[];
    expect(own.every((r) => r.depth === 18)).toBe(true);
    expect(s.engine.calls.filter((c) => c.nodes === FULL_NODES && c.multiPv === 3)).toHaveLength(1);
  });

  it("a stale deeper row is deepened again, and the same search keeps the same row", async () => {
    const s = setup();
    await s.fetch([E4]);
    s.tick();
    const kept = s.deep();
    s.clock.now += 8 * DAY;
    expect(s.tick().result.deepened).toBe(1);
    expect(s.deep().map(({ fen, analysis_id }) => ({ fen, analysis_id }))).toEqual(kept.map(({ fen, analysis_id }) => ({ fen, analysis_id })));
  });

  it("a refused search is counted and logged, the rest are kept, and the tick still publishes", async () => {
    const s = setup();
    const fens = positions(2, 13);
    await s.fetch(fens);
    const analyse = s.engine.analyse;
    const host = realmHost(s.db, {
      engine: (fen, ...rest) => (fen === fens[0] ? JSON.stringify({ error: "refused" }) : analyse(fen, ...rest)),
      clock: s.clock,
    });
    s.db.begin();
    const d = dispatch(buildGuest(), "chess.deepen", {}, { host, clock: () => (s.clock.now += TICK) });
    s.db.commit();
    expect(d.error).toBeUndefined();
    expect(d.result).toEqual({ deepened: 1, failed: 1, rounds: 1 });
    expect(d.logs.join("\n")).toContain(`deepening ${fens[0]} failed`);
    expect(s.deep().map((r) => r.fen)).toEqual([fens[1]]);
  });

  it("an empty queue costs a read and nothing else", () => {
    const s = setup();
    const t = s.tick();
    expect(t.result).toEqual({ deepened: 0, failed: 0, rounds: 0 });
    expect(writes(t.statements)).toEqual([]);
    expect(s.host.searches).toBe(0);
  });
});

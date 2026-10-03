import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Chess } from "chess.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runView } from "../wasm/lib/cypher";
import { DEADLINE_MS, DEEP_DEPTH_CAP, DEEP_NODES, DEEP_SEARCH_MS, DEEPEN_SLOTS, DEEPEN_TICK_MS, DEEPEN_WIDTH } from "../wasm/lib/config";
import { VIEWS } from "../wasm/lib/views";
import { fakeEngine, FOOLS_MATE, positions } from "./guest/fakes";
import { FakeDb, realmHost } from "./guest/host";
import { type Clock, fetchProducer } from "./guest/producer";
import { replayRefusal } from "./guest/replay";
import { buildGuest, dispatch, hasTooling, TOOLING } from "./guest/runtime";

/*
 * Deepening in the background. A page's first search of a position queues it in its slot; the
 * scheduled chess.deepen searches queued positions again at the deeper configuration, oldest
 * first, within its share of the dispatch; chess.markDeepened records what was done, so the next
 * tick skips it until someone looks again. The graph's and the app's reads prefer the deeper
 * rows; analysePosition and plans keep to the page's own.
 *
 * The engine is the fake one, each search costing whatever fake time a test sets, so the budget is
 * checked on the guest's own clock. When the appliance tooling's shim has the engine's batch call,
 * the tick uses it, and the host model here runs a batch side by side or one search after
 * another; with an older shim the tick makes one call a round.
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
const slotOf = (fen: string) => createHash("sha256").update(fen).digest("hex").slice(0, 3);

const ANSWER = JSON.stringify({
  structure: "none",
  summary: "Even.",
  plans: [
    { side: "white", priority: 1, name: "Develop", idea: "Bring the pieces out (1).", moves: ["Nf3"], imbalances: [1], engineEvidence: "" },
    { side: "black", priority: 1, name: "Answer in the centre", idea: "Contest e5.", moves: ["e5"], imbalances: [], engineEvidence: "" },
  ],
});

function setup(o: { parallel?: boolean } = {}) {
  const clock: Clock = { now: T0 };
  const db = new FakeDb();
  const cost = { ms: 0 };
  const engine = fakeEngine(clock, cost);
  const host = realmHost(db, { engine: engine.analyse, clock, parallelBatches: o.parallel, model: () => ({ text: ANSWER, truncated: false }) });
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
  const mark = () => run("markDeepened", {});
  const queued = () => db.exec("SELECT fen FROM deepen_queue ORDER BY fen").map((r) => r.fen);
  const deep = () => db.exec("SELECT fen, analysis_id, depth, nodes FROM deep_analyses ORDER BY fen");
  const fetch = async (fens: string[]) =>
    (await fetchProducer({ module: buildGuest(), handler: "chess.rowsCandidates", keyArgument: "fens", keys: fens, db, host, clock, tickMs: TICK })).rows;
  return { clock, db, host, engine, cost, run, look, tick, mark, queued, deep, fetch };
}

const writes = (statements: string[]) => statements.filter((q) => !/^\s*SELECT\b/i.test(q));

describe("the deepen schedules, as declared", () => {
  const entries = JSON.parse(readFileSync("dist/manifest.json", "utf8")).entries as Record<string, unknown>[];
  it.each([["deepen", "0 * * * * *"], ["markDeepened", "30 * * * * *"]])("%s runs every minute, at %s, with no arguments", (name, schedule) => {
    const entry = entries.find((e) => e.name === name)!;
    expect(entry.schedule).toBe(schedule);
    expect((entry.inputSchema as { required?: string[] }).required ?? []).toEqual([]);
  });

  it("the replay rule refuses what the host refuses: a write that is not a keyed upsert, and reading a table it writes", () => {
    expect(replayRefusal(["INSERT OR IGNORE INTO deepen_queue (fen, queued_at) VALUES ('x', 'y')"])).toMatch(/not a keyed upsert/);
    expect(replayRefusal([
      "SELECT q.fen FROM deepen_queue q LEFT JOIN deep_analyses d ON d.fen = q.fen",
      "INSERT OR REPLACE INTO deep_analyses (fen) VALUES ('x')",
    ])).toMatch(/reads a table it writes: deep_analyses/);
    expect(replayRefusal(["SELECT a FROM t WHERE b = 'deep_marks'", "INSERT INTO deep_marks (a) VALUES (1) ON CONFLICT(a) DO UPDATE SET a = excluded.a"])).toBeNull();
  });

  it("the queue's slots are the first three hex digits of a hash", () => {
    expect(16 ** 3).toBe(DEEPEN_SLOTS);
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

  it("looking at a position queues it once, in its slot, with a keyed upsert; later looks write nothing", async () => {
    const s = setup();
    s.look(E4, "e4");
    expect(s.queued()).toEqual([E4]);
    expect(s.db.exec("SELECT slot FROM deepen_queue")[0].slot).toBe(slotOf(E4));
    const again = s.look(E4, "e4");
    expect(writes(again.statements)).toEqual([]);
    // A position searched for the graph is queued too; a mate, never searched, is not.
    const [other] = positions(1, 11);
    await s.fetch([other, FOOLS_MATE]);
    expect(s.queued()).toEqual([E4, other].sort());
    const queueWrites = writes(s.db.statements).filter((x) => /deepen_queue/.test(x));
    expect(queueWrites.length).toBe(2);
    for (const q of queueWrites) {
      expect(q).toMatch(/^INSERT OR REPLACE INTO deepen_queue /);
      expect(replayRefusal([q])).toBeNull();
    }
  });

  it("the queue never holds more than its slots: a position queued into a taken slot takes it over", async () => {
    const all = positions(300, 21);
    const seen = new Map<string, string>();
    const pair = all.map((f) => [seen.get(slotOf(f)), seen.set(slotOf(f), f) && f] as const).find(([a]) => a !== undefined)!;
    const s = setup();
    await s.fetch([pair[0]!]);
    s.clock.now += 1000;
    await s.fetch([pair[1]]);
    expect(s.queued()).toEqual([pair[1]]);
  });

  /*
   * Each search costs the calibrated DEEP_SEARCH_MS. The first round is one search; later rounds
   * are DEEPEN_WIDTH with the batch call, side by side or one after another, and one without it.
   * A tick ends inside its budget, or one search past it when the host runs a batch one search
   * after another.
   */
  const modes = hasBatch
    ? [
      { name: "batch, side by side", parallel: true, deepened: 1 + DEEPEN_WIDTH, rounds: 2, within: DEEPEN_TICK_MS },
      { name: "batch, one after another", parallel: false, deepened: 1 + DEEPEN_WIDTH, rounds: 2, within: DEEPEN_TICK_MS + DEEP_SEARCH_MS },
    ]
    : [{ name: "no batch", parallel: false, deepened: 2, rounds: 2, within: DEEPEN_TICK_MS }];
  it.each(modes)("a tick stays within its budget and publishes deeper rows ($name)", async ({ parallel, deepened, rounds, within }) => {
    const s = setup({ parallel });
    await s.fetch(positions(10, 5));
    s.cost.ms = DEEP_SEARCH_MS;
    const t = s.tick();
    expect(t.result).toEqual({ deepened, failed: 0, rounds });
    expect(t.ms).toBeLessThanOrEqual(within);
    if (hasBatch) expect(s.host.batches).toEqual([1, DEEPEN_WIDTH]);
    const rows = s.deep();
    expect(rows).toHaveLength(deepened);
    for (const r of rows) expect(r).toMatchObject({ depth: String(DEEP_DEPTH_CAP), nodes: String(DEEP_NODES) });
    // The tick writes only deep_analyses, and the host can replay it when a page published first.
    for (const w of writes(t.statements)) expect(w).toMatch(/^INSERT OR REPLACE INTO deep_analyses /);
    expect(replayRefusal(t.statements)).toBeNull();
  });

  it.each([true, false])("on a runtime three times slower than the calibration, the first round is one search and the tick stops there (batch side by side: %s)", async (parallel) => {
    const s = setup({ parallel });
    await s.fetch(positions(6, 5));
    s.cost.ms = 3 * DEEP_SEARCH_MS;
    const t = s.tick();
    expect(t.result).toEqual({ deepened: 1, failed: 0, rounds: 1 });
    expect(t.ms).toBeLessThan(DEADLINE_MS * 0.6);
  });

  it("a tick whose start was slow (the mount waited) starts no search it cannot finish in its budget", async () => {
    const s = setup();
    await s.fetch(positions(3, 5));
    s.cost.ms = DEEP_SEARCH_MS;
    // The queue read returns 8 s into the dispatch: one more calibrated search would pass 12 s.
    const slowMount = (tool: string, args: unknown) => {
      if (tool === "dep:db.exec" && /FROM deepen_queue/.test((args as { sql: string }).sql)) s.clock.now += 8_000;
      return s.host(tool, args);
    };
    s.db.begin();
    const d = dispatch(buildGuest(), "chess.deepen", {}, { host: slowMount, clock: () => (s.clock.now += TICK) });
    s.db.commit();
    expect(d.error).toBeUndefined();
    expect(d.result).toEqual({ deepened: 0, failed: 0, rounds: 0 });
    expect(s.host.searches).toBe(3);
  });

  it("ticks take the oldest first, a marked position is skipped, and the marking tick is replayable too", async () => {
    const s = setup({ parallel: true });
    const fens = positions(5, 9);
    for (const [i, fen] of fens.entries()) {
      s.clock.now = T0 + i * 1000;
      await s.fetch([fen]);
    }
    s.cost.ms = DEEP_SEARCH_MS;
    const first = s.tick();
    expect(s.deep().map((r) => r.fen).sort()).toEqual(fens.slice(0, first.result.deepened).sort());
    const m = s.mark();
    expect(m.result).toEqual({ marked: first.result.deepened });
    expect(replayRefusal(m.statements)).toBeNull();
    for (const w of writes(m.statements)) expect(w).toMatch(/^INSERT OR REPLACE INTO deep_marks /);
    while (s.deep().length < fens.length) {
      s.tick();
      s.mark();
    }
    const searches = s.host.searches;
    expect(s.tick().result).toEqual({ deepened: 0, failed: 0, rounds: 0 });
    expect(s.host.searches).toBe(searches);
  });

  it("a later read returns the deeper analysis in the app and through the graph's producer", async () => {
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
  });

  it("analysePosition answers at the depth cap it asked for, never from a deeper row", async () => {
    const s = setup();
    await s.fetch([E4]);
    s.tick();
    const searches = s.host.searches;
    const own = s.run("analysePosition", { fens: [E4], depth: 18 }).result as unknown as Record<string, unknown>[];
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r) => r.depth === 18)).toBe(true);
    // It is the page's own kept row, so nothing is searched.
    expect(s.host.searches).toBe(searches);
  });

  it("kept plans still hit after a tick deepens their position: plans are keyed on the page's own analysis", async () => {
    const s = setup();
    const plans = s.run("explainPlans", { fens: [E4] }).result as unknown as Record<string, unknown>[];
    expect(plans.length).toBeGreaterThan(0);
    const asked = s.host.count("ai_complete");
    s.tick();
    expect(s.deep()).toHaveLength(1);
    expect(s.run("explainPlans", { fens: [E4] }).result).toEqual(plans);
    expect(s.host.count("ai_complete")).toBe(asked);
  });

  it("a stale deeper row is deepened again only once someone looks again, and the same search keeps the same row", async () => {
    const s = setup();
    await s.fetch([E4]);
    s.tick();
    s.mark();
    const kept = s.deep();
    s.clock.now += 8 * DAY;
    // Nobody looked: nothing to do, however old the row.
    expect(s.tick().result.deepened).toBe(0);
    // A page finds no fresh row, searches, and queues the position again.
    await s.fetch([E4]);
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
    expect(d.result).toEqual({ deepened: 1, failed: 1, rounds: 2 });
    expect(d.logs.join("\n")).toContain(`deepening ${fens[0]} failed`);
    expect(s.deep().map((r) => r.fen)).toEqual([fens[1]]);
    // The failure is kept, marked, and the position leaves the queue until a page queues it again.
    expect(s.db.exec("SELECT fen FROM deep_failures").map((r) => r.fen)).toEqual([fens[0]]);
    expect(s.mark().result).toEqual({ marked: 2 });
    const searches = s.host.searches;
    expect(s.tick().result).toEqual({ deepened: 0, failed: 0, rounds: 0 });
    expect(s.host.searches).toBe(searches);
  });

  it("a queued position with no legal move is given up on and leaves the queue once marked", async () => {
    const s = setup();
    s.db.exec(`INSERT INTO deepen_queue (slot, fen, queued_at) VALUES ('${slotOf(FOOLS_MATE)}', '${FOOLS_MATE}', '2026-10-03T09:00:00.000Z')`);
    const t = s.tick();
    expect(t.result).toEqual({ deepened: 0, failed: 0, rounds: 0 });
    expect(replayRefusal(t.statements)).toBeNull();
    expect(s.db.exec("SELECT fen, error FROM deep_failures")).toEqual([{ fen: FOOLS_MATE, error: "no legal move" }]);
    const m = s.mark();
    expect(m.result).toEqual({ marked: 1 });
    expect(replayRefusal(m.statements)).toBeNull();
    expect(writes(s.tick().statements)).toEqual([]);
  });

  it("an empty queue costs a read and nothing else", () => {
    const s = setup();
    const t = s.tick();
    expect(t.result).toEqual({ deepened: 0, failed: 0, rounds: 0 });
    expect(writes(t.statements)).toEqual([]);
    expect(s.host.searches).toBe(0);
  });
});

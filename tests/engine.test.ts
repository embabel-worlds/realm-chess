import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { ANALYSIS_TTL_MS, DEADLINE_MS, DEPTH_CAP, FULL_NODES, MULTI_PV, SEARCH_UNTIL, YIELD_AT } from "../wasm/lib/config";
import { realEngine, STOCKFISH } from "./guest/engine";
import { FOOLS_MATE, fakeEngine, positions, seedKept, STALEMATE } from "./guest/fakes";
import { chessHost, FakeDb } from "./guest/host";
import { fetchProducer, type Clock } from "./guest/producer";
import { buildGuest, call, dispatch, hasTooling } from "./guest/runtime";

/*
 * Candidate lines from the stockfish dependency, dispatched into the built guest. The real
 * engine runs where the module is at hand; everything about time uses a fake engine and a fake
 * clock, so a test about the deadline takes milliseconds.
 */

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DAY = 24 * 60 * 60 * 1000;
const SEARCH_MS = 3000;

/* The public candidate record: every field a row carries. `mate` is left out when there is no mate. */
const recordFields = ["candidateId", "creates", "depth", "elapsedMs", "engine", "fen", "lossCp", "pvSan", "pvUci", "rank", "removes", "san", "scoreCp", "side", "uci", "whiteCp"];

const PUBLIC = ["fen", "rank", "san", "scoreCp", "whiteCp", "lossCp", "pvSan", "pvUci", "depth", "creates", "removes"];

const run = (verb: string, args: unknown, _db: FakeDb, host: ReturnType<typeof chessHost>, clock?: Clock) =>
  call(buildGuest(), `chess.${verb}`, args, { host, clock: clock ? () => clock.now : undefined });

const candidates = (db: FakeDb, host: ReturnType<typeof chessHost>, keys: string[], clock: Clock, maxPages = 16) =>
  fetchProducer({ module: buildGuest(), handler: "chess.rowsCandidates", keyArgument: "fens", keys, maxPages, db, host, clock });

describe.skipIf(!hasTooling || !STOCKFISH)("with the real stockfish module", () => {
  it("chess.analysePosition returns one flat list across positions, and nothing for a checkmate", async () => {
    const db = new FakeDb();
    const host = chessHost(db, realEngine());
    const rows = run("analysePosition", { fens: [START, FOOLS_MATE] }, db, host) as Record<string, unknown>[];
    expect(rows).toHaveLength(5);
    expect(host.searches).toBe(1);
    for (const r of rows) {
      // Every declared field, apart from one with no value (no mate here), which is left out.
      expect(Object.keys(r).sort()).toEqual(recordFields.filter((f) => f !== "mate"));
      expect(r.fen).toBe(START);
      expect(r.depth).toBe(DEPTH_CAP);
    }
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(rows[0]).toMatchObject({ san: "e4", scoreCp: 32, whiteCp: 32, lossCp: 0, side: "white" });
  });

  it("HAS_CANDIDATE answers a fresh position at full in one read, and the second read is the kept rows", async () => {
    const db = new FakeDb();
    const host = chessHost(db, realEngine());
    const clock = { now: Date.now() };
    const first = await candidates(db, host, [START], clock);
    expect(first.refused).toBeUndefined();
    expect(first.dispatches).toBe(1);
    expect(first.rows).toHaveLength(5);
    for (const r of first.rows) {
      for (const p of PUBLIC) expect(r, p).toHaveProperty(p);
      expect(r).not.toHaveProperty("cp");
      expect(r).not.toHaveProperty("pv");
      expect(r.analysisId).toMatch(/^[0-9a-f]{64}$/);
      expect(r.nodes).toBeLessThanOrEqual(FULL_NODES + 10_000);
    }
    expect(host.searches).toBe(1);
    const second = await candidates(db, host, [START], clock);
    expect(second.rows).toEqual(first.rows);
    expect(host.searches).toBe(1);
  });
});

describe.skipIf(!hasTooling)("with a fake engine and a fake clock", () => {
  it("checkmate and stalemate have no lines and no refusal, and are never searched", async () => {
    const db = new FakeDb();
    const clock = { now: Date.now() };
    const engine = fakeEngine(clock);
    const host = chessHost(db, engine.analyse);
    const f = await candidates(db, host, [FOOLS_MATE, STALEMATE], clock);
    expect(f.refused).toBeUndefined();
    expect(f).toMatchObject({ rows: [], dispatches: 1 });
    expect(run("analysePosition", { fens: [FOOLS_MATE, STALEMATE] }, db, host)).toEqual([]);
    expect(engine.calls).toHaveLength(0);
  });

  it("an illegal FEN is refused before the engine is called", async () => {
    const db = new FakeDb();
    const clock = { now: Date.now() };
    const engine = fakeEngine(clock);
    const host = chessHost(db, engine.analyse);
    expect(() => run("analysePosition", { fens: [START, "8/8/8/8 w - - 0 1"] }, db, host)).toThrow(/Not a legal position/);
    expect((await candidates(db, host, [START, "nonsense"], clock)).refused).toBe("HANDLER_FAILED");
    expect(engine.calls).toHaveLength(0);
  });

  it("forty fresh positions complete across pages, each search started under 60 percent of the deadline", async () => {
    const db = new FakeDb();
    const clock = { now: Date.now() };
    const engine = fakeEngine(clock, { ms: SEARCH_MS });
    const host = chessHost(db, engine.analyse);
    const keys = positions(40);
    const f = await candidates(db, host, keys, clock);
    expect(f.refused).toBeUndefined();
    expect(f.rows).toHaveLength(40 * MULTI_PV);
    // About six at three seconds a search.
    const perPage = Math.ceil((SEARCH_UNTIL * DEADLINE_MS) / SEARCH_MS);
    expect(perPage).toBe(6);
    expect(f.dispatches).toBe(Math.ceil(40 / perPage));
    // Disjoint pages, in key order, the cursor the index of the first key a page owes.
    const served = f.pages.map((rows) => [...new Set(rows.map((r) => r.fen as string))]);
    expect(served.flat()).toEqual(keys);
    let index = 0;
    f.pages.forEach((_, i) => {
      expect(f.cursors[i]).toBe(i === 0 ? undefined : String(index));
      index += served[i].length;
    });
    // Every search at full, every one started inside the page's 60 percent.
    expect(engine.calls).toHaveLength(40);
    for (const c of engine.calls) expect(c).toMatchObject({ nodes: FULL_NODES, maxDepth: DEPTH_CAP, multiPv: MULTI_PV });
    const pageStarts: number[] = [];
    let seen = 0;
    for (const s of served) {
      pageStarts.push(engine.calls[seen].at);
      seen += s.length;
    }
    seen = 0;
    served.forEach((s, p) => {
      for (let i = 0; i < s.length; i++) expect(engine.calls[seen + i].at - pageStarts[p]).toBeLessThan(SEARCH_UNTIL * DEADLINE_MS);
      seen += s.length;
    });
  }, 120_000);

  it("the deadline marks come from the config: past 90 percent even kept rows wait for the next page", async () => {
    const db = new FakeDb();
    const clock = { now: Date.now() };
    const keys = positions(3);
    // Keep the last two first, cheaply.
    const quick = fakeEngine(clock);
    (await candidates(db, chessHost(db, quick.analyse), keys.slice(1), clock));
    // Then one search that runs past YIELD_AT of the deadline, without passing it.
    const slow = fakeEngine(clock, { ms: Math.ceil(((YIELD_AT + 0.98) / 2) * DEADLINE_MS) });
    const f = await candidates(db, chessHost(db, slow.analyse), keys, clock);
    expect(f.refused).toBeUndefined();
    expect(f.pages.map((rows) => new Set(rows.map((r) => r.fen)).size)).toEqual([1, 2]);
    expect(f.cursors).toEqual([undefined, "1"]);
    expect(slow.calls).toHaveLength(1);
  });

  it("a single position always completes in one read, however long its search", async () => {
    const db = new FakeDb();
    const clock = { now: Date.now() };
    const engine = fakeEngine(clock, { ms: 0.95 * DEADLINE_MS });
    const f = await candidates(db, chessHost(db, engine.analyse), positions(1), clock);
    expect(f.refused).toBeUndefined();
    expect(f.dispatches).toBe(1);
    expect(f.rows).toHaveLength(MULTI_PV);
  });

  describe("the host's limits, each refused with its own code", () => {
    it("KEY_BOUND past 256 keys, before any invocation", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      const engine = fakeEngine(clock);
      const f = await candidates(db, chessHost(db, engine.analyse), positions(257), clock);
      expect(f).toMatchObject({ refused: "KEY_BOUND", dispatches: 0 });
      expect(engine.calls).toHaveLength(0);
    });

    it("ROW_BOUND past 1024 rows, and a fetch inside the bound reads the kept rows", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      const keys = positions(210);
      await seedKept(db, keys, clock.now, { bare: true });
      const engine = fakeEngine(clock);
      const host = chessHost(db, engine.analyse);
      expect((await candidates(db, host, keys, clock)).refused).toBe("ROW_BOUND");
      const within = await candidates(db, host, keys.slice(0, 200), clock);
      expect(within.refused).toBeUndefined();
      const lines = keys.slice(0, 200).reduce((n, fen) => n + Math.min(MULTI_PV, new Chess(fen).moves().length), 0);
      expect(within.rows).toHaveLength(lines);
      expect(engine.calls).toHaveLength(0);
    }, 60_000);

    it("RESULT_BYTES past 1 MiB", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      // Rows of eight-ply lines run to about a kilobyte, so 200 kept positions pass 1 MiB first.
      const keys = positions(200);
      await seedKept(db, keys, clock.now);
      const f = await candidates(db, chessHost(db, fakeEngine(clock).analyse), keys, clock);
      expect(f.refused).toBe("RESULT_BYTES");
      expect(f.rows.length).toBeLessThanOrEqual(1024);
    }, 60_000);

    it("PAGE_BOUND past 16 pages, and the next read continues from kept rows", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      // Ten seconds a search leaves room for two a page, so 33 positions need 17 pages.
      const engine = fakeEngine(clock, { ms: 10_000 });
      const host = chessHost(db, engine.analyse);
      const keys = positions(33);
      const f = await candidates(db, host, keys, clock);
      expect(f.refused).toBe("PAGE_BOUND");
      expect(f.dispatches).toBe(16);
      expect(engine.calls).toHaveLength(32);
      const again = await candidates(db, host, keys, clock);
      expect(again.refused).toBeUndefined();
      expect(engine.calls).toHaveLength(33);
    }, 120_000);

    it("HANDLER_FAILED when the engine spends the deadline, and the dispatch published nothing", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      const engine = fakeEngine(clock, { ms: DEADLINE_MS + 1 });
      const f = await candidates(db, chessHost(db, engine.analyse), positions(1), clock);
      expect(f.refused).toBe("HANDLER_FAILED");
      expect(db.exec("SELECT count(*) AS n FROM analyses")[0].n).toBe("0");
    });
  });

  describe("kept analyses", () => {
    it("are looked up by position and configuration: a changed configuration misses and searches again", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      const engine = fakeEngine(clock);
      const host = chessHost(db, engine.analyse);
      run("analysePosition", { fens: [START] }, db, host, clock);
      run("analysePosition", { fens: [START] }, db, host, clock);
      expect(engine.calls).toHaveLength(1);
      // The public defaults are the producer's configuration, so the graph reads the same kept lines.
      (await candidates(db, host, [START], clock));
      expect(engine.calls).toHaveLength(1);
      run("analysePosition", { fens: [START], multiPv: 3 }, db, host, clock);
      run("analysePosition", { fens: [START], depth: 12 }, db, host, clock);
      expect(engine.calls.map((c) => [c.multiPv, c.maxDepth])).toEqual([[5, 18], [3, 18], [5, 12]]);
      expect(db.exec("SELECT count(DISTINCT config_key) AS n FROM analyses")[0].n).toBe("3");
    });

    it("are searched again after seven days; the same lines keep their analysisId", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      const engine = fakeEngine(clock);
      const host = chessHost(db, engine.analyse);
      const before = (await candidates(db, host, [START], clock)).rows;
      clock.now += ANALYSIS_TTL_MS - DAY;
      expect((await candidates(db, host, [START], clock)).rows).toEqual(before);
      expect(engine.calls).toHaveLength(1);
      clock.now += 2 * DAY;
      const after = (await candidates(db, host, [START], clock)).rows;
      expect(engine.calls).toHaveLength(2);
      expect(after.map((r) => r.analysisId)).toEqual(before.map((r) => r.analysisId));
    });

    it("a search after expiry that finds different lines gets a new analysisId", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      let shift = 0;
      const engine = fakeEngine(clock, { variant: () => shift });
      const host = chessHost(db, engine.analyse);
      const before = (await candidates(db, host, [START], clock)).rows;
      clock.now += ANALYSIS_TTL_MS + DAY;
      shift = 7;
      const after = (await candidates(db, host, [START], clock)).rows;
      expect(engine.calls).toHaveLength(2);
      expect(after[0].analysisId).not.toBe(before[0].analysisId);
      expect(after[0].scoreCp).toBe((before[0].scoreCp as number) + 7);
    });

    it("are written only with keyed upserts, so the host can replay them when another dispatch published first", async () => {
      const db = new FakeDb();
      const clock = { now: Date.now() };
      (await candidates(db, chessHost(db, fakeEngine(clock).analyse), positions(3), clock));
      expect(db.writes().length).toBeGreaterThan(0);
      // A new search is kept, and its position queued for deepening in its slot.
      for (const w of db.writes()) expect(w).toMatch(/^INSERT OR REPLACE INTO (analyses|deepen_queue) /);
    });
  });

  it("a cursor the realm did not write is refused", async () => {
    const db = new FakeDb();
    const clock = { now: Date.now() };
    const d = dispatch(buildGuest(), "chess.rowsCandidates", { fens: [START], cursor: "1; DROP TABLE analyses" }, {
      host: chessHost(db, fakeEngine(clock).analyse),
    });
    expect(d.error).toBe("Invalid cursor");
  });
});

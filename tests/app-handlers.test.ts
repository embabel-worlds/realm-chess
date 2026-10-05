import { readFileSync, writeFileSync } from "node:fs";
import { Chess } from "chess.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runView } from "../wasm/lib/cypher";
import { VIEWS } from "../wasm/lib/views";
import { theoryTitles } from "../wasm/lib/theory";
import { mastersAnswer, ndjsonReply, playerRecords, ratedAnswer, RUY, RUY_THEORY, START, wikibooksAnswers } from "./fixtures/lichess";
import { realEngine, STOCKFISH } from "./guest/engine";
import { fakeEngine, FOOLS_MATE } from "./guest/fakes";
import { type Answer, apiRefusal, FakeDb, realmHost } from "./guest/host";
import { type Clock, fetchProducer } from "./guest/producer";
import { buildGuest, dispatch, hasTooling } from "./guest/runtime";

/*
 * Chesscalator's three calls, dispatched into the built guest: chess.appPosition on every step,
 * chess.appPractice for Lichess, chess.appPlans on the button. Each answers the views the page
 * shows, and must answer exactly what those views answer over the producers' rows.
 *
 * With CAPTURE=1 (and the real engine) this also writes tests/fixtures/app-replies.json, the
 * replies the page harness (tests/app.spec.mjs) serves. Without it, the committed replies are
 * checked against what the handlers answer now, so the harness cannot drift from the handlers.
 */

const T0 = Date.parse("2026-10-03T09:00:00Z");
const TICK = 5;
const MiB = 1024 * 1024;
const EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";
const PAGES = theoryTitles(EXCHANGE.split(" ")).slice(0, 7);
const view = (name: string) => VIEWS.find((v) => v.name === name)!;
const fenAfter = (moves: string) => {
  const c = new Chess();
  for (const m of moves.split(" ").filter(Boolean)) c.move(m);
  return c.fen();
};
const E4 = fenAfter("e4");

const ANSWER = JSON.stringify({
  structure: "Ruy Lopez (Exchange)",
  summary: "White has the better structure for the endgame; Black has the bishops (2).",
  plans: [
    { side: "white", priority: 1, name: "Trade into the ending", idea: "Exchange pieces and use the kingside majority (1).", moves: ["Be3", "f4"], imbalances: [1, 3], engineEvidence: "the best move" },
    { side: "white", priority: 2, name: "Hold the light squares", idea: "Keep a knight on d5.", moves: ["Nc3", "Nd5"], imbalances: [2], engineEvidence: "" },
    { side: "black", priority: 1, name: "Use the bishop pair", idea: "Open the position for the bishops (2).", moves: ["Bd6", "Be6"], imbalances: [2], engineEvidence: "" },
    { side: "black", priority: 2, name: "Queenside expansion", idea: "b6 and c4.", moves: ["b6"], imbalances: [], engineEvidence: "" },
  ],
});

interface Options { engine?: "real"; engineMs?: number; modelMs?: number; latencyMs?: number; lichess?: "refused"; model?: "none" }

function setup(o: Options = {}) {
  const clock: Clock = { now: T0 };
  const db = new FakeDb();
  const slow = (f: Answer): Answer => (a) => {
    clock.now += o.latencyMs ?? 0;
    return f(a);
  };
  const apis: Record<string, Answer> = {
    lichess_mastersExplorer: slow((a) => mastersAnswer(String(a.fen))),
    lichess_playerExplorer: slow((a) => ndjsonReply(playerRecords(String(a.fen), String(a.player), String(a.color)))),
    lichess_lichessExplorer: slow((a) => ratedAnswer(String(a.fen), String(a.ratings), a.speeds as string | undefined)),
    wikibooks_wikibooksQuery: slow(wikibooksAnswers(PAGES, RUY_THEORY)),
  };
  if (o.lichess === "refused") for (const k of Object.keys(apis)) if (k.startsWith("lichess_")) apis[k] = apiRefusal;
  const engine = fakeEngine(clock, { ms: o.engineMs ?? 0 });
  const host = realmHost(db, {
    engine: o.engine === "real" ? realEngine() : engine.analyse,
    apis,
    model: o.model === "none" ? undefined : () => {
      clock.now += o.modelMs ?? 0;
      return { text: ANSWER, truncated: false };
    },
    clock,
  });
  /** One app call as the bridge makes it: its own dispatch, published when it returns. */
  const app = (verb: string, args: Record<string, unknown>) => {
    const started = clock.now;
    db.begin();
    const d = dispatch(buildGuest(), `chess.${verb}`, args, { host, clock: () => (clock.now += TICK) });
    if (d.error !== undefined) {
      db.rollback();
      throw new Error(d.error);
    }
    db.commit();
    return { reply: d.result as Reply, ms: clock.now - started };
  };
  const fetch = async (handler: string, keyArgument: string, keys: string[], extra: Record<string, unknown> = {}) =>
    (await fetchProducer({ module: buildGuest(), handler: `chess.${handler}`, keyArgument, keys, db, host, clock, tickMs: TICK, extra })).rows;
  return { clock, db, host, engine, app, fetch };
}

interface Reply {
  fen: string;
  views: Record<string, { rows: Record<string, unknown>[]; error?: string; skipped?: string }>;
  status: Record<string, string>;
}

/** What the bridge carries back: the reply inside the host's JSON envelope. */
const bridged = (r: Reply) => Buffer.byteLength(JSON.stringify({ result: r }), "utf8");

describe.skipIf(!hasTooling)("the app's calls, in the guest", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((f: () => void) => {
      f();
      return 0;
    }) as unknown as typeof setTimeout);
  });
  afterEach(() => vi.restoreAllMocks());

  describe("answer what the views answer over the producers' rows", () => {
    it("appPosition with a line: the line's opening and theory, the imbalances and the engine's moves", async () => {
      const s = setup();
      const fen = fenAfter(EXCHANGE);
      const { reply } = s.app("appPosition", { fen, moves: EXCHANGE, withinCp: 100 });
      expect(Object.keys(reply.views).sort()).toEqual(["BestMoves", "ImbalancesOf", "OpeningOfLine", "TheoryOfLine"]);
      expect(reply.views.BestMoves.rows).toEqual(runView(view("BestMoves"), { fen, withinCp: 100, maxLines: 5 }, await s.fetch("rowsCandidates", "fens", [fen])));
      expect(reply.views.ImbalancesOf.rows).toEqual(runView(view("ImbalancesOf"), { fen }, await s.fetch("rowsImbalances", "fens", [fen])));
      expect(reply.views.OpeningOfLine.rows).toEqual(runView(view("OpeningOfLine"), { moves: EXCHANGE }, await s.fetch("rowsOpeningOfLine", "lines", [EXCHANGE])));
      expect(reply.views.OpeningOfLine.rows[0]).toMatchObject({ name: expect.stringContaining("Exchange"), pliesPast: expect.any(Number) });
      expect(Number(reply.views.OpeningOfLine.rows[0].pliesPast)).toBeGreaterThan(0);
      expect(reply.views.TheoryOfLine.rows).toEqual(runView(view("TheoryOfLine"), { moves: EXCHANGE }, await s.fetch("rowsTheory", "lines", [EXCHANGE])));
      expect(reply.views.TheoryOfLine.rows).toHaveLength(1);
      expect(s.engine.calls).toHaveLength(1);
    });

    it("appPosition from a FEN alone: the opening by position, and no theory", async () => {
      const s = setup();
      const { reply } = s.app("appPosition", { fen: RUY, withinCp: 50 });
      expect(Object.keys(reply.views).sort()).toEqual(["BestMoves", "ImbalancesOf", "OpeningOf"]);
      expect(reply.views.OpeningOf.rows).toEqual([]);
      expect(reply.views.BestMoves.rows).toEqual(runView(view("BestMoves"), { fen: RUY, withinCp: 50 }, await s.fetch("rowsCandidates", "fens", [RUY])));
      expect(s.host.count("wikibooks_wikibooksQuery")).toBe(0);
    });

    it("appPosition refuses moves that do not reach the position, and an illegal FEN", () => {
      const s = setup();
      expect(() => s.app("appPosition", { fen: START, moves: "e4" })).toThrow(/do not reach/);
      expect(() => s.app("appPosition", { fen: "8/8/8/8/8/8/8/8 w - - 0 1" })).toThrow(/Not a legal position/);
    });

    it("appPosition on a checkmate has no engine moves and makes no search", () => {
      const s = setup();
      const { reply } = s.app("appPosition", { fen: FOOLS_MATE });
      expect(reply.views.BestMoves.rows).toEqual([]);
      expect(s.engine.calls).toHaveLength(0);
    });

    it("appPractice: masters, a player (white when no colour is given), and both popularity grids", async () => {
      const s = setup();
      const masters = s.app("appPractice", { fen: E4, filters: { masters: true } }).reply.views;
      expect(masters.MastersAtPosition.rows).toEqual(runView(view("MastersAtPosition"), { fen: E4 }, await s.fetch("rowsMasterMoves", "fens", [E4])));
      expect(masters.MasterGamesAtPosition.rows).toEqual(runView(view("MasterGamesAtPosition"), { fen: E4 }, await s.fetch("rowsMasterGames", "fens", [E4])));
      const player = s.app("appPractice", { fen: START, filters: { player: "DrNykterstein" } }).reply.views;
      const args = { fen: START, player: "DrNykterstein", color: "white" };
      const pushed = { player: ["DrNykterstein"] };
      expect(player.PlayerAtPosition.rows.length).toBeGreaterThan(0);
      expect(player.PlayerAtPosition.rows).toEqual(runView(view("PlayerAtPosition"), args, await s.fetch("rowsPlayerMoves", "fens", [START], pushed)));
      expect(player.PlayerGamesAtPosition.rows).toEqual(runView(view("PlayerGamesAtPosition"), args, await s.fetch("rowsPlayerGames", "fens", [START], pushed)));
      const rating = s.app("appPractice", { fen: E4, filters: { speed: "blitz", minShare: 3 } }).reply.views.MovesByRating;
      expect(rating.rows.length).toBeGreaterThan(0);
      expect(rating.rows).toEqual(runView(view("MovesByRating"), { fen: E4, speed: "blitz", minShare: 3 }, await s.fetch("rowsRatedMoves", "fens", [E4], { speed: ["blitz"] })));
      const speeds = s.app("appPractice", { fen: E4, filters: { band: "1600", minShare: 3 } }).reply.views.MovesByTimeControl;
      expect(speeds.rows).toEqual(runView(view("MovesByTimeControl"), { fen: E4, band: "1600", minShare: 3 }, await s.fetch("rowsRatedMoves", "fens", [E4], { band: ["1600"] })));
    });

    it("appPlans: line plans along the moves, position plans without them, at the asked level, the same rows as the views", async () => {
      const s = setup();
      const fen = fenAfter(EXCHANGE);
      const line = s.app("appPlans", { fen, moves: EXCHANGE, level: "beginner" }).reply.views;
      expect(Object.keys(line)).toEqual(["PlansInLine"]);
      expect(line.PlansInLine.rows.length).toBeGreaterThan(0);
      expect(line.PlansInLine.rows).toEqual(runView(view("PlansInLine"), { moves: EXCHANGE, level: "beginner" },
        await s.fetch("rowsLinePlans", "lines", [EXCHANGE], { level: ["beginner"] })));
      const position = s.app("appPlans", { fen: RUY }).reply.views;
      expect(Object.keys(position)).toEqual(["PlansInPosition"]);
      expect(position.PlansInPosition.rows.every((r) => r.level === "intermediate")).toBe(true);
      expect(position.PlansInPosition.rows).toEqual(runView(view("PlansInPosition"), { fen: RUY, level: "intermediate" },
        await s.fetch("rowsPositionPlans", "fens", [RUY])));
      // The views read the plans the app made: no model call beyond the app's own two.
      expect(s.host.count("ai_complete")).toBe(2);
    });
  });

  describe("bounded", () => {
    it("each call cold completes under 30 seconds with a 3 s search, 6 s model calls and slow APIs, and replies under 1 MiB", () => {
      const s = setup({ engineMs: 3000, modelMs: 6000, latencyMs: 400 });
      const fen = fenAfter(EXCHANGE);
      const calls: [string, Record<string, unknown>][] = [
        ["appPlans", { fen, moves: EXCHANGE, level: "expert" }],
        ["appPosition", { fen, moves: EXCHANGE, withinCp: 1000 }],
        ["appPractice", { fen: E4, filters: { masters: true } }],
        ["appPractice", { fen: START, filters: { player: "DrNykterstein", color: "black" } }],
        ["appPractice", { fen: E4, filters: { speed: "all", minShare: 0 } }],
        ["appPractice", { fen: START, filters: { band: "1600", minShare: 0 } }],
      ];
      for (const [verb, args] of calls) {
        const { reply, ms } = s.app(verb, args);
        expect(ms, verb).toBeLessThan(30_000);
        expect(bridged(reply), verb).toBeLessThan(MiB);
        for (const [name, v] of Object.entries(reply.views)) {
          expect(v.error, `${verb} ${name}`).toBeUndefined();
          expect(v.skipped, `${verb} ${name}`).toBeUndefined();
        }
      }
    });

    it("a grid that does not fit says skipped and keeps what it fetched; the next call finishes it from kept answers", () => {
      const s = setup({ latencyMs: 4000 });
      const first = s.app("appPractice", { fen: E4, filters: { speed: "blitz" } });
      expect(first.ms).toBeLessThan(30_000);
      expect(first.reply.views.MovesByRating.skipped).toBe("time");
      const second = s.app("appPractice", { fen: E4, filters: { speed: "blitz" } });
      const third = second.reply.views.MovesByRating.skipped ? s.app("appPractice", { fen: E4, filters: { speed: "blitz" } }) : second;
      expect(third.reply.views.MovesByRating.skipped).toBeUndefined();
      expect(new Set(third.reply.views.MovesByRating.rows.map((r) => r.rating)).size).toBe(9);
    });
  });

  describe("the model only on the button", () => {
    it("ten positions through appPosition and appPractice make no model call; appPlans makes one", () => {
      const s = setup();
      const moves = EXCHANGE.split(" ");
      for (let ply = 1; ply <= 10; ply++) {
        const line = moves.slice(0, ply).join(" ");
        const fen = fenAfter(line);
        s.app("appPosition", { fen, moves: line, withinCp: 50 });
        s.app("appPractice", { fen, filters: { masters: true } });
      }
      expect(s.host.count("ai_complete")).toBe(0);
      s.app("appPlans", { fen: fenAfter(moves.slice(0, 10).join(" ")), moves: moves.slice(0, 10).join(" ") });
      expect(s.host.count("ai_complete")).toBe(1);
    }, 60_000);
  });

  describe("empty, and why", () => {
    it("without a Lichess token the practice views say Lichess refused, and the status says refused", () => {
      const s = setup({ lichess: "refused" });
      const { reply } = s.app("appPractice", { fen: E4, filters: { masters: true } });
      expect(reply.views.MastersAtPosition).toMatchObject({ rows: [], error: expect.stringMatching(/^Lichess refused/) });
      expect(reply.status).toMatchObject({ lichess: "refused", lastRefusal: "LICHESS_REFUSED" });
    });

    it("without the model grant there are no plans, and the status says not_granted", () => {
      const s = setup({ model: "none" });
      const { reply } = s.app("appPlans", { fen: RUY });
      expect(reply.views.PlansInPosition.rows).toEqual([]);
      expect(reply.status).toMatchObject({ model: "not_granted", lastRefusal: "MODEL_NOT_GRANTED" });
    });
  });

  describe.skipIf(!STOCKFISH)("the page harness's replies", () => {
    /* Every call tests/app.spec.mjs makes, with the arguments the page makes it with. */
    const LINES = ["", "e4", "e4 e5", "e4 c5", EXCHANGE];
    const calls: [string, Record<string, unknown>][] = [];
    for (const line of LINES) {
      const fen = fenAfter(line);
      calls.push(["appPosition", line ? { fen, moves: line, withinCp: 50 } : { fen, withinCp: 50 }], ["appPractice", { fen, filters: { masters: true } }]);
    }
    calls.push(["appPosition", { fen: RUY, withinCp: 50 }], ["appPosition", { fen: RUY, withinCp: 20 }], ["appPosition", { fen: RUY, withinCp: 100 }]);
    calls.push(["appPractice", { fen: E4, filters: { speed: "blitz", minShare: 3 } }], ["appPractice", { fen: E4, filters: { band: "1600", minShare: 3 } }]);
    calls.push(["appPlans", { fen: RUY, level: "intermediate" }], ["appPlans", { fen: RUY, moves: EXCHANGE, level: "intermediate" }],
      ["appPlans", { fen: RUY, moves: EXCHANGE, level: "beginner" }]);
    const key = (verb: string, args: Record<string, unknown>) => `call:chess.${verb}:${JSON.stringify(Object.fromEntries(Object.entries(args).sort()))}`;

    it("are what the handlers answer now, with the real engine", () => {
      const s = setup({ engine: "real" });
      const replies: Record<string, Reply> = {};
      for (const [verb, args] of calls) replies[key(verb, args)] = s.app(verb, args).reply;
      if (process.env.CAPTURE) writeFileSync("tests/fixtures/app-replies.json", `${JSON.stringify(replies, null, 1)}\n`);
      expect(JSON.parse(readFileSync("tests/fixtures/app-replies.json", "utf8"))).toEqual(replies);
    }, 120_000);

    it("give the engine moves, imbalances and openings the recorded views returned", () => {
      const replies = JSON.parse(readFileSync("tests/fixtures/app-replies.json", "utf8")) as Record<string, Reply>;
      const envelopes = JSON.parse(readFileSync("tests/fixtures/envelopes.json", "utf8")) as Record<string, { data: unknown[] }>;
      const env = (name: string, args: Record<string, unknown>) => envelopes[`view:${name}:${JSON.stringify(Object.fromEntries(Object.entries(args).sort()))}`]?.data;
      let compared = 0;
      for (const [verb, args] of calls.filter(([v]) => v === "appPosition")) {
        const r = replies[key(verb, args)];
        const fen = String(args.fen);
        const pairs: [string, Record<string, unknown>][] = [["BestMoves", { fen, withinCp: args.withinCp, maxLines: 5 }], ["ImbalancesOf", { fen }]];
        if (args.moves) pairs.push(["OpeningOfLine", { moves: args.moves }]);
        else pairs.push(["OpeningOf", { fen }]);
        for (const [name, a] of pairs) {
          const want = env(name, a);
          if (!want) continue;
          expect(r.views[name].rows, `${name} ${JSON.stringify(a)}`).toEqual(want);
          compared++;
        }
      }
      expect(compared).toBeGreaterThanOrEqual(15);
    });
  });
});

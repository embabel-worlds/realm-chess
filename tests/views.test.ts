import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { parseView, runView } from "../wasm/lib/cypher";
import { GRAPH_VIEWS, STATUS_VIEW, VIEWS, type ViewSpec } from "../wasm/lib/views";
import { theoryTitles } from "../wasm/lib/theory";
import {
  AFTER_E4, mastersAnswer, ndjsonReply, ndjsonText, playerRecords, ratedAnswer, RUY, RUY_THEORY, START, wikibooksAnswers,
} from "./fixtures/lichess";
import { realEngine, STOCKFISH } from "./guest/engine";
import { fakeEngine, FOOLS_MATE, STALEMATE } from "./guest/fakes";
import { type Answer, apiRefusal, FakeDb, realmHost } from "./guest/host";
import { type Clock, fetchProducer } from "./guest/producer";
import { buildGuest, call, hasTooling } from "./guest/runtime";

/*
 * Every view, run over what the realm's producers return for the fixture positions.
 *
 * The views are run by wasm/lib/cypher.ts, the reader the app handlers use. It is checked first
 * against envelopes the views returned on a live appliance (tests/fixtures/envelopes.json):
 * where the realm's own inputs are deterministic (the board, the book, the engine at depth 18), the
 * rows must be those rows, field by field. Where the inputs come from outside (Lichess, the wikibook,
 * the model), the recorded explorer answers (tests/fixtures/explorer-answers.json) go through the same
 * view, and the rows must agree; the recorded envelope then fixes the columns.
 *
 * tests/live/views.mjs runs the same views against an appliance and compares with the same envelopes.
 */

interface Envelope { status: string; outcome?: string; data: Record<string, unknown>[] }
const envelopes = JSON.parse(readFileSync("tests/fixtures/envelopes.json", "utf8")) as Record<string, Envelope>;
const recorded = Object.entries(envelopes).map(([k, env]) => {
  const m = k.match(/^view:(\w+):(.*)$/)!;
  return { view: m[1], args: JSON.parse(m[2]) as Record<string, unknown>, env };
});
const view = (name: string) => VIEWS.find((v) => v.name === name)!;
const columns = (v: ViewSpec) => parseView(v.cypher).columns.map((c) => c.alias);

const T0 = Date.parse("2026-10-03T09:00:00Z");
const TICK = 5;
const EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";
const explorerAnswers = JSON.parse(readFileSync("tests/fixtures/explorer-answers.json", "utf8")) as Record<string, unknown>;
const PAGES = theoryTitles(EXCHANGE.split(" ")).slice(0, 7);

/** A model answer naming plans for both sides, as the plan tests use. */
const ANSWER = JSON.stringify({
  structure: "Ruy Lopez (Exchange)",
  summary: "White has the better structure for the endgame; Black has the bishops (2).",
  plans: [
    { side: "white", priority: 2, name: "Use the kingside majority", idea: "f4 and e5 (1).", moves: ["f4", "e5"], imbalances: [1], engineEvidence: "" },
    { side: "white", priority: 1, name: "Trade into the ending", idea: "Exchange pieces (3).", moves: ["Be3"], imbalances: [3], engineEvidence: "the best move" },
    { side: "black", priority: 1, name: "Use the bishop pair", idea: "Open the position.", moves: ["Bd6"], imbalances: [2], engineEvidence: "" },
  ],
});

function setup(o: { engine?: "real"; lichess?: "refused"; model?: "none" } = {}) {
  const clock: Clock = { now: T0 };
  const db = new FakeDb();
  const apis: Record<string, Answer> = {
    lichess_mastersExplorer: (a) => mastersAnswer(String(a.fen)),
    lichess_playerExplorer: (a) => ndjsonReply(playerRecords(String(a.fen), String(a.player), String(a.color))),
    lichess_lichessExplorer: (a) => ratedAnswer(String(a.fen), String(a.ratings), a.speeds as string | undefined),
    wikibooks_wikibooksQuery: wikibooksAnswers(PAGES, RUY_THEORY),
  };
  if (o.lichess === "refused") for (const k of Object.keys(apis)) if (k.startsWith("lichess_")) apis[k] = apiRefusal;
  const fake = fakeEngine(clock);
  const host = realmHost(db, {
    engine: o.engine === "real" ? realEngine() : fake.analyse,
    apis,
    model: o.model === "none" ? undefined : () => ({ text: ANSWER, truncated: false }),
    clock,
  });
  const fetch = async (handler: string, keyArgument: string, keys: string[], extra: Record<string, unknown> = {}) => {
    const f = await fetchProducer({ module: buildGuest(), handler: `chess.${handler}`, keyArgument, keys, db, host, clock, tickMs: TICK, extra });
    expect(f.refused, f.error).toBeUndefined();
    return f.rows;
  };
  const run = (verb: string, args: unknown) => call(buildGuest(), `chess.${verb}`, args, { host, clock: () => (clock.now += TICK) });
  return { fetch, run, host, searches: () => fake.calls.length };
}

describe("the views the realm declares", () => {
  it("are the thirteen in views/chess.yml, plus ChessStatus", () => {
    expect(parse(readFileSync("views/chess.yml", "utf8"))).toEqual(GRAPH_VIEWS.concat([STATUS_VIEW]).map((v) => ({ ...v })));
  });

  it("can all be read by the reader the app handlers use", () => {
    for (const v of VIEWS) expect(() => parseView(v.cypher), v.name).not.toThrow();
  });
});

describe("the view reader, on rows written by hand", () => {
  const best = view("BestMoves");
  const rows = [
    { rank: "2", san: "d4", lossCp: 9, whiteCp: 23 },
    { rank: "1", san: "e4", lossCp: 0, whiteCp: 32 },
    { rank: "3", san: "Nf3", lossCp: 60, whiteCp: -28 },
    { rank: "4", san: "c4", lossCp: null, whiteCp: null },
  ];

  it("filters, converts, orders and limits as the Cypher says", () => {
    expect(runView(best, { withinCp: 50 }, rows).map((r) => [r.rank, r.move])).toEqual([[1, "e4"], [2, "d4"]]);
    expect(runView(best, { withinCp: 100, maxLines: 2 }, rows).map((r) => r.move)).toEqual(["e4", "d4"]);
    expect(runView(best, { withinCp: 100 }, rows).map((r) => r.move)).toEqual(["e4", "d4", "Nf3"]);
  });

  it("returns every column, null for a property the row lacks", () => {
    const [r] = runView(best, { withinCp: 0 }, rows);
    expect(Object.keys(r)).toEqual(columns(best));
    expect(r.mate).toBeNull();
  });

  it("sorts nulls last going up and first going down, and compares strings to strings only", () => {
    const v: ViewSpec = { name: "T", description: "", cypher: "MATCH (p:Position {fen: $fen})-[:R]->(x:X)\nWHERE x.band = $band\nRETURN x.n AS n ORDER BY n DESC" };
    const rs = [{ band: "1600", n: 1 }, { band: "1600", n: null }, { band: 1600, n: 3 }, { band: "1600", n: 2 }];
    expect(runView(v, { band: "1600" }, rs).map((r) => r.n)).toEqual([null, 2, 1]);
  });

  it("refuses Cypher it cannot read, so a new view fails here and never answers wrongly", () => {
    expect(() => parseView("MATCH (a)-[:R*1..2]->(b) RETURN b")).toThrow();
    expect(() => parseView("MATCH (p:Position {fen: $fen})-[:R]->(x:X) RETURN count(x) AS n")).toThrow();
    expect(() => parseView("MATCH (p:Position {fen: $fen})-[:R]->(x:X) RETURN x.a")).toThrow();
  });
});

describe.skipIf(!hasTooling)("each view over the realm's producers", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((f: () => void) => {
      f();
      return 0;
    }) as unknown as typeof setTimeout);
  });
  afterEach(() => vi.restoreAllMocks());

  describe("against the recorded envelopes", () => {
    it("ImbalancesOf: one row per position, as recorded, for every recorded position", async () => {
      const { fetch } = setup();
      const cases = recorded.filter((r) => r.view === "ImbalancesOf");
      expect(cases.length).toBeGreaterThanOrEqual(5);
      for (const c of cases) {
        const rows = runView(view("ImbalancesOf"), c.args, await fetch("rowsImbalances", "fens", [String(c.args.fen)]));
        expect(rows, String(c.args.fen)).toEqual(c.env.data);
        expect(rows).toHaveLength(1);
      }
    });

    it("OpeningOf: none for the Exchange Ruy position, which is past the book, as recorded", async () => {
      const { fetch } = setup();
      const c = recorded.find((r) => r.view === "OpeningOf")!;
      expect(c.env.outcome).toBe("EMPTY");
      expect(runView(view("OpeningOf"), c.args, await fetch("rowsOpeningOfPosition", "fens", [String(c.args.fen)]))).toEqual([]);
      const named = runView(view("OpeningOf"), { fen: AFTER_E4 }, await fetch("rowsOpeningOfPosition", "fens", [AFTER_E4]));
      expect(named).toEqual([{ eco: "B00", name: "King's Pawn Game", moves: "1. e4" }]);
    });

    it("OpeningOfLine: the deepest name along each recorded line, with how far past it, as recorded", async () => {
      const { fetch } = setup();
      const cases = recorded.filter((r) => r.view === "OpeningOfLine");
      expect(cases.map((c) => c.args.moves)).toContain(EXCHANGE);
      for (const c of cases) {
        const rows = runView(view("OpeningOfLine"), c.args, await fetch("rowsOpeningOfLine", "lines", [String(c.args.moves)]));
        expect(rows, String(c.args.moves)).toEqual(c.env.data);
      }
    });

    it.skipIf(!STOCKFISH)("BestMoves: the engine's lines at depth 18, for every recorded position and tolerance, as recorded", async () => {
      const { fetch } = setup({ engine: "real" });
      const cases = recorded.filter((r) => r.view === "BestMoves");
      expect(cases.length).toBeGreaterThanOrEqual(9);
      const byFen = new Map<string, Record<string, unknown>[]>();
      for (const c of cases) {
        const fen = String(c.args.fen);
        if (!byFen.has(fen)) byFen.set(fen, await fetch("rowsCandidates", "fens", [fen]));
        const rows = runView(view("BestMoves"), c.args, byFen.get(fen)!);
        expect(rows, `${fen} within ${c.args.withinCp}`).toEqual(c.env.data);
      }
    }, 120_000);
  });

  describe("against the recorded explorer answers", () => {
    const recordedAnswer = (handler: string, args: Record<string, unknown>) => {
      const key = `${handler}:${JSON.stringify(args)}`;
      if (!(key in explorerAnswers)) throw new Error(`no recorded answer for ${key}`);
      return explorerAnswers[key];
    };
    const columnsOf = (name: string) => {
      const env = recorded.find((r) => r.view === name && r.env.data.length);
      return env ? Object.keys(env.env.data[0]).sort() : undefined;
    };

    it.each([START, AFTER_E4, RUY])("MastersAtPosition and MasterGamesAtPosition at %s", async (fen) => {
      const { fetch } = setup();
      const recordedRows = recordedAnswer("mastersAtPosition", { fens: [fen] }) as { moves: Record<string, unknown>[]; games: Record<string, unknown>[] };
      const moves = runView(view("MastersAtPosition"), { fen }, await fetch("rowsMasterMoves", "fens", [fen]));
      const games = runView(view("MasterGamesAtPosition"), { fen }, await fetch("rowsMasterGames", "fens", [fen]));
      expect(moves.length).toBeGreaterThan(0);
      expect(games.length).toBeGreaterThan(0);
      expect(moves).toEqual(runView(view("MastersAtPosition"), { fen }, recordedRows.moves));
      expect(games).toEqual(runView(view("MasterGamesAtPosition"), { fen }, recordedRows.games));
      expect(Object.keys(moves[0]).sort()).toEqual(columnsOf("MastersAtPosition"));
      expect(Object.keys(games[0]).sort()).toEqual(columnsOf("MasterGamesAtPosition"));
    });

    it("PlayerAtPosition and PlayerGamesAtPosition: the default player as White, and as Black", async () => {
      const { fetch } = setup();
      for (const color of ["white", "black"]) {
        const args = { fen: START, player: "DrNykterstein", color };
        const recordedRows = recordedAnswer("playerAtPosition", { fens: [START], filters: `player=DrNykterstein color=${color}` }) as {
          moves: Record<string, unknown>[]; games: Record<string, unknown>[];
        };
        const pushed = { player: ["DrNykterstein"], color: [color] };
        const moves = runView(view("PlayerAtPosition"), args, await fetch("rowsPlayerMoves", "fens", [START], pushed));
        const games = runView(view("PlayerGamesAtPosition"), args, await fetch("rowsPlayerGames", "fens", [START], pushed));
        expect(moves.length, color).toBeGreaterThan(0);
        expect(moves).toEqual(runView(view("PlayerAtPosition"), args, recordedRows.moves));
        expect(games).toEqual(runView(view("PlayerGamesAtPosition"), args, recordedRows.games));
      }
    });

    it("MovesByRating and MovesByTimeControl after 1.e4, at their recorded arguments", async () => {
      const { fetch } = setup();
      for (const name of ["MovesByRating", "MovesByTimeControl"]) {
        const c = recorded.find((r) => r.view === name)!;
        const pin = name === "MovesByRating" ? { speed: [String(c.args.speed)] } : { band: [String(c.args.band)] };
        const filters = name === "MovesByRating" ? `speed=${c.args.speed}` : `band=${c.args.band}`;
        const recordedRows = recordedAnswer("ratedMoves", { fens: [AFTER_E4], filters }) as Record<string, unknown>[];
        const ours = runView(view(name), c.args, await fetch("rowsRatedMoves", "fens", [AFTER_E4], pin));
        expect(ours.length, name).toBeGreaterThan(0);
        expect(ours, name).toEqual(runView(view(name), c.args, recordedRows));
        expect(Object.keys(ours[0]).sort(), name).toEqual(columnsOf(name));
      }
    });

    it("TheoryOfLine: the deepest wikibook page along the Exchange Ruy, and none for a line it has no page for", async () => {
      const { fetch } = setup();
      const recordedRows = recordedAnswer("theoryOfGameLine", { lines: [EXCHANGE] }) as Record<string, unknown>[];
      const ours = runView(view("TheoryOfLine"), { moves: EXCHANGE }, await fetch("rowsTheory", "lines", [EXCHANGE]));
      expect(ours).toHaveLength(1);
      expect(ours).toEqual(runView(view("TheoryOfLine"), { moves: EXCHANGE }, recordedRows));
      expect(Object.keys(ours[0]).sort()).toEqual(columnsOf("TheoryOfLine"));
      expect(runView(view("TheoryOfLine"), { moves: "d4" }, await fetch("rowsTheory", "lines", ["d4"]))).toEqual([]);
    });
  });

  describe("plans, from the model", () => {
    it("PlansInPosition: both sides at the asked level, White first, each in priority order", async () => {
      const { fetch } = setup();
      const args = { fen: RUY, level: "intermediate" };
      const rows = runView(view("PlansInPosition"), args, await fetch("rowsPositionPlans", "fens", [RUY], { level: ["intermediate"] }));
      expect(rows.map((r) => [r.side, r.priority, r.plan])).toEqual([
        ["white", 1, "Trade into the ending"], ["white", 2, "Use the kingside majority"], ["black", 1, "Use the bishop pair"],
      ]);
      expect(rows.every((r) => r.level === "intermediate")).toBe(true);
      const rec = recorded.find((r) => r.view === "PlansInPosition")!;
      expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(rec.env.data[0]).sort());
      expect(runView(view("PlansInPosition"), { fen: RUY, level: "expert" }, rows.map((r) => ({ ...r })))).toEqual([]);
    });

    it("PlansInLine: told the line's opening, at each recorded level", async () => {
      const { fetch } = setup();
      for (const c of recorded.filter((r) => r.view === "PlansInLine")) {
        const rows = runView(view("PlansInLine"), c.args, await fetch("rowsLinePlans", "lines", [EXCHANGE], { level: [String(c.args.level)] }));
        expect(rows.length, String(c.args.level)).toBeGreaterThan(0);
        expect(rows.every((r) => r.level === c.args.level)).toBe(true);
        expect(String(rows[0].opening)).toContain("Ruy Lopez");
        expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(c.env.data[0]).sort());
      }
    });
  });

  describe("legitimately empty, and why", () => {
    it("BestMoves, PlansInPosition: nothing for a checkmate or a stalemate, and no search", async () => {
      const { fetch, searches, host } = setup();
      for (const fen of [FOOLS_MATE, STALEMATE]) {
        expect(runView(view("BestMoves"), { fen }, await fetch("rowsCandidates", "fens", [fen]))).toEqual([]);
        expect(runView(view("PlansInPosition"), { fen }, await fetch("rowsPositionPlans", "fens", [fen]))).toEqual([]);
      }
      expect(searches()).toBe(0);
      expect(host.count("ai_complete")).toBe(0);
    });

    it("the Lichess views without a token, and ChessStatus saying Lichess refused", async () => {
      const { fetch, run } = setup({ lichess: "refused" });
      expect(runView(view("MastersAtPosition"), { fen: START }, await fetch("rowsMasterMoves", "fens", [START]))).toEqual([]);
      expect(runView(view("MovesByRating"), { fen: START }, await fetch("rowsRatedMoves", "fens", [START], { speed: ["blitz"] }))).toEqual([]);
      const status = await fetch("status", "username", ["james"]);
      expect(runView(STATUS_VIEW, {}, status)).toEqual([{ lichess: "refused", model: "unknown", lastRefusal: "LICHESS_REFUSED", at: expect.any(String) }]);
    });

    it("PlansInPosition without the model grant, and ChessStatus saying not_granted", async () => {
      const { fetch, run } = setup({ model: "none" });
      expect(runView(view("PlansInPosition"), { fen: RUY }, await fetch("rowsPositionPlans", "fens", [RUY]))).toEqual([]);
      const status = await fetch("status", "username", ["james"]);
      expect(runView(STATUS_VIEW, {}, status)[0]).toMatchObject({ model: "not_granted", lastRefusal: "MODEL_NOT_GRANTED" });
    });
  });
});

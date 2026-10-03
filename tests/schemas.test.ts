import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { theoryTitles } from "../wasm/lib/theory";
import { mastersAnswer, ndjsonReply, playerRecords, ratedAnswer, RUY, RUY_THEORY, START, wikibooksAnswers } from "./fixtures/lichess";
import { realEngine, STOCKFISH } from "./guest/engine";
import { fakeEngine, FOOLS_MATE, STALEMATE } from "./guest/fakes";
import { type Answer, FakeDb, realmHost } from "./guest/host";
import type { Clock } from "./guest/producer";
import { buildGuest, call, hasTooling } from "./guest/runtime";

/*
 * Every handler the manifest declares, dispatched into the built guest on representative inputs
 * (a mate, a stalemate, a miss, Lichess answers with missing ratings and a move nobody played),
 * with each input checked against its inputSchema and each output against its outputSchema, as
 * the host checks them. A field declared as a number may be absent; it may not be null.
 *
 * The producers' `rows*` handlers declare only an object, so their rows are also checked against
 * the record schema of the public handler they serve. The app handlers return view rows, where
 * a column the row lacks is null, as a view's is.
 */

interface Entry { namespace: string; name: string; inputSchema: object; outputSchema: object }
const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8")) as { entries: Entry[] };
const entry = (name: string) => manifest.entries.find((e) => e.name === name)!;
const ajv = new Ajv({ strict: false, allErrors: true });
const itemOf = (name: string, path: "moves" | "games" | null = null) => {
  const s = entry(name).outputSchema as { items?: object; properties?: Record<string, { items: object }> };
  return path ? s.properties![path].items : s.items!;
};

const T0 = Date.parse("2026-10-03T09:00:00Z");
const EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";
const E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
/** White mates in one with Rd8. */
const MATE_IN_ONE = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
const PLANS = JSON.stringify({
  structure: "Ruy Lopez (Exchange)",
  summary: "Even.",
  plans: [
    { side: "white", priority: 1, name: "Kingside majority", idea: "f4 and e5.", moves: ["f4"], imbalances: [1], engineEvidence: "" },
    { side: "black", priority: 1, name: "Bishop pair", idea: "Open lines.", moves: ["Bd6"], imbalances: [2], engineEvidence: "" },
  ],
});

/** The masters answer with one move nobody won, drew or lost with: its percentages have no value. */
const mastersWithEmptyMove = (fen: string) => {
  const a = mastersAnswer(fen);
  return { ...a, moves: [...a.moves, { ...a.moves[0], uci: "h7h6", san: "h6", white: 0, draws: 0, black: 0 }] };
};

function setup(engine: "fake" | "real") {
  const clock: Clock = { now: T0 };
  const db = new FakeDb();
  const apis: Record<string, Answer> = {
    lichess_mastersExplorer: (a) => mastersWithEmptyMove(String(a.fen)),
    lichess_playerExplorer: (a) => ndjsonReply(playerRecords(String(a.fen), String(a.player), String(a.color))),
    lichess_lichessExplorer: (a) => ratedAnswer(String(a.fen), String(a.ratings), a.speeds as string | undefined),
    wikibooks_wikibooksQuery: wikibooksAnswers(theoryTitles(EXCHANGE.split(" ")).slice(0, 7), RUY_THEORY),
  };
  const host = realmHost(db, {
    engine: engine === "real" ? realEngine() : fakeEngine(clock).analyse,
    apis,
    model: () => ({ text: PLANS, truncated: false }),
    clock,
  });
  return (verb: string, args: Record<string, unknown>) => call(buildGuest(), `chess.${verb}`, args, { host, clock: () => (clock.now += 5) });
}

/** Each handler with the inputs it is run on, and the record schema its rows are checked against. */
const CASES: [string, Record<string, unknown>, (() => object)?][] = [
  ["analysePosition", { fens: [START, FOOLS_MATE, STALEMATE] }],
  ["positionImbalances", { fens: [START, RUY, FOOLS_MATE] }],
  ["openingLookup", { fens: [E4, RUY] }],
  ["openingOfGameLine", { lines: [EXCHANGE, "a3 a6 h3 h6 b3 b6"] }],
  ["theoryOfGameLine", { lines: [EXCHANGE, "a3"] }],
  ["explainPlans", { fens: [RUY, STALEMATE] }],
  ["explainLinePlans", { lines: [EXCHANGE] }],
  ["mastersAtPosition", { fens: [E4] }],
  ["playerAtPosition", { fens: [START], filters: "player=DrNykterstein color=black" }],
  ["ratedMoves", { fens: [E4], filters: "band=1600 speed=blitz" }],
  ["rowsCandidates", { fens: [START, FOOLS_MATE, STALEMATE] }, () => itemOf("analysePosition")],
  ["rowsImbalances", { fens: [START, RUY] }, () => itemOf("positionImbalances")],
  ["rowsOpeningOfPosition", { fens: [E4, RUY] }, () => itemOf("openingLookup")],
  ["rowsOpeningOfLine", { lines: [EXCHANGE] }, () => itemOf("openingOfGameLine")],
  ["rowsTheory", { lines: [EXCHANGE, "a3"] }, () => itemOf("theoryOfGameLine")],
  ["rowsPositionPlans", { fens: [RUY], level: ["beginner"] }, () => itemOf("explainPlans")],
  ["rowsLinePlans", { lines: [EXCHANGE] }, () => itemOf("explainLinePlans")],
  ["rowsMasterMoves", { fens: [E4] }, () => itemOf("mastersAtPosition", "moves")],
  ["rowsMasterGames", { fens: [E4] }, () => itemOf("mastersAtPosition", "games")],
  ["rowsPlayerMoves", { fens: [START], player: ["DrNykterstein"] }, () => itemOf("playerAtPosition", "moves")],
  ["rowsPlayerGames", { fens: [START], player: ["DrNykterstein"], color: ["black"] }, () => itemOf("playerAtPosition", "games")],
  ["rowsRatedMoves", { fens: [E4], speed: ["blitz"], band: ["1600"] }, () => itemOf("ratedMoves")],
  ["status", { username: ["james"] }],
  ["appPosition", { fen: RUY, moves: EXCHANGE, withinCp: 100 }],
  ["appPractice", { fen: E4, filters: { masters: true, player: "DrNykterstein", speed: "blitz", minShare: 3 } }],
  ["appPlans", { fen: RUY }],
];

const errorsOf = (schema: object, value: unknown) => {
  const validate = ajv.compile(schema);
  return validate(value) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
};

describe("the manifest's schemas", () => {
  it("cover every handler the cases run, and every handler has a case", () => {
    expect(CASES.map(([n]) => n).sort()).toEqual(manifest.entries.map((e) => e.name).sort());
  });

  it("accept every case's input", () => {
    for (const [name, input] of CASES) expect(errorsOf(entry(name).inputSchema, input), name).toEqual([]);
  });
});

describe.skipIf(!hasTooling)("every handler's output, as the host checks it", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((f: () => void) => {
      f();
      return 0;
    }) as unknown as typeof setTimeout);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(CASES)("%s", (name, input, rowSchema) => {
    const out = setup("fake")(name, input);
    expect(errorsOf(entry(name).outputSchema, out), name).toEqual([]);
    if (rowSchema) {
      const rows = (out as { rows: unknown[] }).rows;
      for (const r of rows) expect(errorsOf(rowSchema(), r), `${name} ${JSON.stringify(r).slice(0, 120)}`).toEqual([]);
    }
  });

  it.skipIf(!STOCKFISH)("analysePosition and rowsCandidates on a mate in one, with the real engine's mate scores", () => {
    const run = setup("real");
    const lines = run("analysePosition", { fens: [MATE_IN_ONE] }) as Record<string, unknown>[];
    expect(lines.some((l) => typeof l.mate === "number")).toBe(true);
    expect(errorsOf(entry("analysePosition").outputSchema, lines)).toEqual([]);
    const rows = (run("rowsCandidates", { fens: [MATE_IN_ONE] }) as { rows: unknown[] }).rows;
    for (const r of rows) expect(errorsOf(itemOf("analysePosition"), r)).toEqual([]);
  }, 60_000);
});

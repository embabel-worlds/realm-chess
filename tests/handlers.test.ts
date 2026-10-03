import { describe, expect, it } from "vitest";
import { imbalancesOf } from "../wasm/lib/imbalances";
import { openingOfLine, structureOf, structureSentence } from "../wasm/lib/openings";
import { battery } from "./battery/battery";
import { chessHost, FakeDb } from "./guest/host";
import { buildGuest, call, dispatch, hasTooling } from "./guest/runtime";
import { fullBook, fullSkeletons } from "./impl";

/*
 * The handlers, dispatched into the built guest with the realm's SQLite behind them, the way
 * the appliance runs them. Fixture positions are the battery's.
 */

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const RUY_EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";

const noEngine = () => {
  throw new Error("no engine in this test");
};

describe.skipIf(!hasTooling)("the book and imbalance handlers, in the guest", () => {
  const db = new FakeDb();
  const run = (verb: string, args: unknown) => call(buildGuest(), `chess.${verb}`, args, { host: chessHost(db, noEngine) });
  const fens = battery().map((p) => p.fen);

  it("chess.positionImbalances answers Rod's record for every battery position, structure included", () => {
    const rows = run("positionImbalances", { fens }) as Record<string, unknown>[];
    expect(rows).toHaveLength(fens.length);
    rows.forEach((r, i) => {
      const x = imbalancesOf(fens[i]);
      expect(r.fen).toBe(fens[i]);
      expect(r.facts).toBe(x.facts.join("\n"));
      expect(r.structure).toBe(structureSentence(structureOf(fens[i], fullSkeletons())) ?? "");
      expect(r.detail).toBe(JSON.stringify(x));
    });
  });

  it("chess.openingLookup names a book position and returns nothing for one past the book", () => {
    const past = battery().find((p) => p.id === "kid-classical-mar-del-plata")!.fen;
    const rows = run("openingLookup", { fens: [START, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", past] }) as Record<string, string>[];
    expect(rows.map((r) => r.name)).toEqual(["King's Pawn Game"]);
    expect(rows[0]).toMatchObject({ eco: "B00", pgn: "1. e4" });
  });

  it("chess.openingOfGameLine keeps the Exchange Ruy's name past the book, as Node computes it", () => {
    const rows = run("openingOfGameLine", { lines: [RUY_EXCHANGE] }) as Record<string, unknown>[];
    const expected = openingOfLine(RUY_EXCHANGE.split(" "), fullBook())!;
    expect(rows).toEqual([{ line: RUY_EXCHANGE, fen: expected.fen, eco: expected.eco, name: expected.name, pgn: expected.pgn, namedAtPly: expected.namedAtPly, pliesPast: expected.pliesPast }]);
  });

  it("refuses an illegal position and names it", () => {
    expect(() => run("positionImbalances", { fens: ["not a fen"] })).toThrow(/Not a legal position: not a fen/);
    expect(() => run("openingOfGameLine", { lines: ["e4 e5 Ke3"] })).toThrow(/Move 3 \(Ke3\)/);
  });

  it("the producer adapters answer the same records as rows, in one page", () => {
    expect(run("rowsImbalances", { fens: [START] })).toEqual({ rows: run("positionImbalances", { fens: [START] }), next: null });
    expect(run("rowsOpeningOfLine", { lines: [RUY_EXCHANGE] })).toEqual({ rows: run("openingOfGameLine", { lines: [RUY_EXCHANGE] }), next: null });
    const e4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(run("rowsOpeningOfPosition", { fens: [e4] })).toEqual({ rows: run("openingLookup", { fens: [e4] }), next: null });
  });

  it("the producer adapters refuse keys the host would never send", () => {
    expect(() => run("rowsImbalances", { fens: [] })).toThrow("Invalid producer keys");
    expect(() => run("rowsImbalances", { fens: START })).toThrow("Invalid producer keys");
    expect(() => run("rowsImbalances", { fens: Array(257).fill(START) })).toThrow("Invalid producer keys");
  });

  it("a FEN with a quote in it stays a value in SQL", () => {
    expect(() => run("openingLookup", { fens: ["x' OR '1'='1"] })).toThrow(/Not a legal position/);
    const d = dispatch(buildGuest(), "chess.rowsOpeningOfLine", { lines: ["e4"] }, { host: chessHost(db, noEngine) });
    expect(d.error).toBeUndefined();
  });

  it("a whole battery of imbalances fits one dispatch's time", () => {
    const t = Date.now();
    run("rowsImbalances", { fens });
    expect(Date.now() - t).toBeLessThan(5000);
  });

  it("the handlers not yet ported say so", () => {
    expect(() => run("theoryOfGameLine", { lines: ["e4"] })).toThrow(/not available in this build/);
  });
});

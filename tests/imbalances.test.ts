import { describe, expect, it } from "vitest";
import { imbalancesOf } from "../src/lib/imbalances";
import { battery } from "./battery/battery";

/*
 * Every imbalance the battery names for a position must be among the facts computed for it.
 * The expectations are what a player would say about the position, written down first; a
 * failure here is the computation being wrong about the board, not the expectation.
 */
describe("imbalances of the battery positions", () => {
  for (const p of battery()) {
    it(`${p.id}: ${p.opening}`, () => {
      const facts = imbalancesOf(p.fen).facts.join("\n");
      for (const expected of p.imbalances) expect(facts).toContain(expected);
    });
  }
});

describe("imbalance details", () => {
  const fen = (id: string) => battery().find((p) => p.id === id)!.fen;

  it("a1 is a dark square: the Stonewall's c8 bishop is light-squared and bad", () => {
    const b = imbalancesOf(fen("stonewall-dutch")).black.bishops.find((x) => x.square === "c8")!;
    expect(b.colour).toBe("light");
    expect(b.verdict).toBe("bad");
  });

  it("a bad bishop outside its chain is bad but active (Bg5 in the Carlsbad)", () => {
    const b = imbalancesOf(fen("carlsbad")).white.bishops.find((x) => x.square === "g5")!;
    expect(b.verdict).toBe("bad but active");
  });

  it("a chain counts only where both pawns are blocked (c4 beside d5 is not a chain)", () => {
    const chains = imbalancesOf(fen("kid-classical-mar-del-plata")).chains.map((c) => `${c.side} ${c.pawns.join("/")} ${c.pointsTo}`);
    expect(chains).toEqual(expect.arrayContaining(["white d5/e4 queenside", "black e5/d6 kingside"]));
    expect(chains).toHaveLength(2);
  });

  it("untouched flank pawns beside an empty file are not hanging pawns", () => {
    expect(imbalancesOf(fen("carlsbad")).white.pawns.hanging).toEqual([]);
  });

  it("hanging pawns: an advanced central pair with no neighbours", () => {
    const x = imbalancesOf("r1bq1rk1/p3bppp/1p2pn2/8/2PP4/5N2/P3BPPP/R1BQ1RK1 w - - 0 11");
    expect(x.white.pawns.hanging.sort()).toEqual(["c4", "d4"]);
    expect(x.facts.join("\n")).toContain("White has hanging pawns on c4 and d4");
  });

  it("a single pawn is not reported as isolated", () => {
    const facts = imbalancesOf(fen("rook-endgame-lucena")).facts.join("\n");
    expect(facts).not.toContain("isolated");
    expect(facts).toContain("White has a passed pawn on b7");
  });

  it("the Exchange Ruy's material is level with the bishop pair to Black", () => {
    const x = imbalancesOf(fen("ruy-lopez-exchange"));
    expect(x.black.bishopPair).toBe(true);
    expect(x.white.bishopPair).toBe(false);
    expect(x.facts).toContain("Material: the sides are level.");
  });
});

describe("imbalance names", () => {
  it("every imbalance is filed under one of Silman's names", async () => {
    const { CATEGORIES } = await import("../src/lib/imbalances");
    for (const p of battery()) {
      for (const f of imbalancesOf(p.fen).facts) {
        if (f.startsWith("Phase:")) continue;
        expect(CATEGORIES.some((c) => f.startsWith(`${c}: `)), f).toBe(true);
      }
    }
  });
});

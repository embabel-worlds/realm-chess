import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { battery } from "./battery/battery";
import { libs } from "./impl";

/* Rod's tests, run against Node and against the built guest (tests/impl.ts). */
describe.each(libs)("$name", ({ imbalancesOf, CATEGORIES }) => {
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
      for (const p of battery()) {
        for (const f of imbalancesOf(p.fen).facts) {
          if (f.startsWith("Phase:")) continue;
          expect(CATEGORIES.some((c) => f.startsWith(`${c}: `)), f).toBe(true);
        }
      }
    });
  });

  describe("material mid-exchange, and tactics", () => {
    const at = (moves: string) => { const c = new Chess(); for (const m of moves.split(" ")) c.move(m); return c.fen(); };
    const facts = (moves: string) => imbalancesOf(at(moves)).facts.join("\n");

    it("straight after 4.Bxc6 the material is level once Black recaptures, not 'White is 3 up'", () => {
      const f = facts("e4 e5 Nf3 Nc6 Bb5 a6 Bxc6");
      expect(f).toContain("Material: the sides are level once Black recaptures on c6");
      expect(f).not.toMatch(/White is 3 points up/);
    });

    it("an undefended pawn is reported as a fact, never as a win (Nxe5 loses to ...Qd4)", () => {
      const f = facts("e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6");
      expect(f).toContain("Tactics: Black's pawn on e5 is attacked and not defended.");
      expect(f).not.toMatch(/can win/);
    });

    it("a fork shows as two loose pieces", () => {
      const f = facts("e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 Nxe5 Qd4");
      expect(f).toContain("White's knight on e5 is attacked and not defended");
      expect(f).toContain("White's pawn on e4 is attacked and not defended");
    });

    it("mate in one, and a mate threat", () => {
      expect(facts("e4 e5 Qh5 Nc6 Bc4 Nf6")).toContain("Tactics: White can mate at once with Qxf7#.");
      expect(facts("e4 e5 Qh5 Nc6 Bc4")).toContain("Tactics: White threatens mate with Qxf7#.");
    });
  });
});

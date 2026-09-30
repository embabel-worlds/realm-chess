import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { readLine } from "../src/lib/lines";
import { openingOfLine, positionAfter } from "../src/lib/openings";

function uci(fen: string, san: string): string[] {
  const c = new Chess(fen);
  return san.split(" ").map((s) => { const m = c.move(s); return m.from + m.to + (m.promotion ?? ""); });
}

/*
 * A line is read for what it changes, never for what it is for. These pin the changes a player
 * would name.
 */
describe("what a line changes", () => {
  const RUY = "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4";

  it("Bxc6 dxc6 hands Black the bishop pair and doubled c-pawns", () => {
    const r = readLine(RUY, uci(RUY, "Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1"));
    const created = r.gained.join("\n");
    expect(created).toContain("Black has the bishop pair");
    expect(created).toContain("Black has doubled pawns on the c-file");
  });

  it("a line stopped mid-exchange is read once the exchange is over", () => {
    // Qxd1 is the tenth ply; Rxd1 completes the trade and is read too.
    const r = readLine(RUY, uci(RUY, "Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1 Bd6"));
    expect(r.settledPlies).toBe(11);
    expect(r.gained.join("\n")).not.toMatch(/up in material/);
  });

  it("reports the line in SAN", () => {
    const r = readLine(RUY, uci(RUY, "Ba4 Nf6 O-O"));
    expect(r.pvSan).toEqual(["Ba4", "Nf6", "O-O"]);
  });
});

describe("what is not a change", () => {
  const RUY_EX = "r1b1kbnr/1pp3pp/p4p2/2p5/4P3/1N6/PPP2PPP/RNBR2K1 b kq - 0 9";

  it("a bishop that moves but keeps its verdict is not a change, and development is not an imbalance", () => {
    const r = readLine(RUY_EX, uci(RUY_EX, "Be6 N1d2 O-O-O"));
    const all = [...r.gained, ...r.lost].join("\n");
    expect(all).not.toMatch(/bishop on [a-h][1-8] is good/);
    expect(all).not.toMatch(/undeveloped/);
    expect(all).not.toMatch(/freer pieces/);
  });
});

describe("the opening a game line became", () => {
  const line = (s: string) => s.split(" ");

  it("the Exchange Ruy keeps its name after it leaves the book", () => {
    const o = openingOfLine(line("e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1"))!;
    expect(o.name).toMatch(/^Ruy Lopez: Exchange Variation/);
    expect(o.namedAtPly).toBeGreaterThanOrEqual(8);
    expect(o.pliesPast).toBe(17 - o.namedAtPly);
  });

  it("the closed Ruy is named deep into the Chigorin", () => {
    const o = openingOfLine(line("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7 Nbd2 cxd4 cxd4 Nc6 Nb3 a5 Be3 a4 Nbd2 Bd7"))!;
    expect(o.name).toMatch(/^Ruy Lopez: Closed, Chigorin/);
    expect(o.namedAtPly).toBeGreaterThan(20);
  });

  it("an illegal move ends the lookup and the error names it", () => {
    expect(() => positionAfter(line("e4 e5 Ke3"))).toThrow(/Move 3 \(Ke3\)/);
  });
});

describe("opening theory pages", async () => {
  const { theoryTitles, theoryText, pageUrl } = await import("../src/lib/theory");

  it("titles follow the wikibook's move-number scheme", () => {
    const t = theoryTitles("e4 e5 Nf3 Nc6 Bb5 a6 Bxc6".split(" "));
    expect(t[0]).toBe("Chess Opening Theory/1. e4");
    expect(t[1]).toBe("Chess Opening Theory/1. e4/1...e5");
    expect(t[6]).toBe("Chess Opening Theory/1. e4/1...e5/2. Nf3/2...Nc6/3. Bb5/3...a6/4. Bxc6");
  });

  it("castling and checks keep their notation", () => {
    const t = theoryTitles("e4 e5 Nf3 Nc6 Bc4 Nf6 O-O".split(" "));
    expect(t[6].endsWith("/4. O-O")).toBe(true);
  });

  it("the theory text stops where the theory table and references begin", () => {
    const text = theoryText("== 4. Bxc6 ==\nWhite trades.\n\n\n\n== Theory table ==\n.\n== References ==\nbooks");
    expect(text).toBe("== 4. Bxc6 ==\nWhite trades.");
  });

  it("links are the page's wiki URL", () => {
    expect(pageUrl("Chess Opening Theory/1. e4/1...e5")).toBe("https://en.wikibooks.org/wiki/Chess_Opening_Theory/1._e4/1...e5");
  });
});

import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { readLine } from "../src/lib/lines";

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

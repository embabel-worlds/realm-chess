import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { readLine } from "../src/lib/plans";

/*
 * Each case is a real Stockfish 19 line captured from the realm's own handler, pinned here as
 * SAN so the test does not depend on the engine choosing the same line twice (it does not,
 * even at a fixed depth). What is asserted is the READING: given these moves, this plan.
 */

function uci(fen: string, san: string): string[] {
  const c = new Chess(fen);
  return san.split(" ").map((s) => {
    const m = c.move(s);
    return m.from + m.to + (m.promotion ?? "");
  });
}

const YUGOSLAV = "r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 3 9";
const CARLSBAD = "r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/R4RK1 w - - 8 11";
const QGD_NGE2 = "r1bq1rk1/pp1nbppp/2p2n2/3p2B1/3P4/2NBP3/PPQ1NPPP/R3K2R w KQ - 4 10";
const ROOK_MATE = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const read = (fen: string, san: string, cp: number | null = 0, mate: number | null = null) =>
  readLine(fen, uci(fen, san), { cp, mate });

describe("plans read off engine lines", () => {
  it("g4 with queenside castling in the line is a kingside pawn storm (opposite wings)", () => {
    const s = read(YUGOSLAV, "g4 Be6 Nxe6 fxe6 O-O-O d5 exd5 Nxd5 Nxd5 Qxd5", 81);
    expect(s.plan).toBe("kingside-pawn-storm");
    expect(s.ownKing).toBe("queenside");
    expect(s.enemyKing).toBe("kingside");
  });

  it("taking back on d5 answers Black's break; it is not White's", () => {
    const s = read(YUGOSLAV, "O-O-O d5 exd5 Nxd5 Nxc6 bxc6 Bd4 Bxd4 Qxd4 Qb6", 47);
    expect(s.pawnBreaks).toEqual([]);
    expect(s.plan).toBe("king-safety");
  });

  it("a line that ends mid-exchange is not a sacrifice", () => {
    const s = read(YUGOSLAV, "Nb3 Be6 O-O-O Ne5 Be2 Rc8 Kb1 Nc4 Bxc4 Bxc4", 26);
    expect(s.materialDelta).toBe(0);
    expect(s.tags).not.toContain("sacrifice-for-initiative");
  });

  it("Rab1 then b4 in the Carlsbad structure is the minority attack", () => {
    const s = read(CARLSBAD, "Rab1 Ng6 b4 a6 a4 Ne4 Bxe7 Qxe7 b5 axb5", 37);
    expect(s.plan).toBe("minority-attack");
  });

  it("f3 behind e3 prepares e4: central control, not king safety", () => {
    const s = read(QGD_NGE2, "f3 Re8 O-O b5 a3 Nf8 Kh1 h6 Bh4 Ne6", 61);
    expect(s.plan).toBe("central-control");
  });

  it("castling as the move itself is king safety", () => {
    expect(read(QGD_NGE2, "O-O h6 Bh4 Nh5 Bxe7 Qxe7 Rae1 Re8 Nc1 Qh4", 57).plan).toBe("king-safety");
  });

  it("castling late in a quiet line does not claim the plan", () => {
    const s = read(QGD_NGE2, "Rd1 h6 Bh4 Nh5 Bxe7 Qxe7 O-O Nb6 Rfe1 Bd7", 39);
    expect(s.tags).not.toContain("king-safety");
  });

  it("a forced mate is a mating attack", () => {
    expect(read(ROOK_MATE, "Rd8#", null, 1).plan).toBe("mating-attack");
  });

  it("pawn moves in a rook-less endgame are not a storm", () => {
    const s = read(ROOK_MATE, "g4 Kf8 Kf1 Ke7 g5 Ke6 Ke2 g6 Kf3 Kf5", 732);
    expect(s.tags).not.toContain("kingside-pawn-storm");
    expect(s.plan).toBe("king-activity");
  });

  it("1.e4 with d4 to follow is a central break", () => {
    expect(read(START, "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6", 32).plan).toBe("central-break");
  });

  it("a line that ends on a capture is taken at its word", () => {
    // After 4.Nxe5? Qg5 the knight on e5 is lost: Bxf7+ and Bxg8 win back a pawn and a knight,
    // but ...Rxg8 takes the bishop, and the line stops there. White is two points down.
    const fen = "r1b1kbnr/pppp1ppp/8/4N1q1/2BnP3/8/PPPP1PPP/RNBQK2R w KQkq - 1 5";
    const s = read(fen, "Bxf7+ Ke7 O-O Qxe5 Bxg8 Rxg8", -200);
    expect(s.materialDelta).toBe(-2);
  });

  it("reports the line in SAN and every fact it tagged from", () => {
    const s = read(CARLSBAD, "Rab1 Ng6 b4 a6 a4 Ne4 Bxe7 Qxe7 b5 axb5", 37);
    expect(s.pvSan.slice(0, 3)).toEqual(["Rab1", "Ng6", "b4"]);
    expect(s.facts).toContain("queenside: b4 a4 b5");
  });
});

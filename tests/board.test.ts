import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { Board } from "../wasm/lib/board";
import { battery } from "./battery/battery";

/*
 * The handlers' board must answer what chess.js answers. Every position here is read by both, and
 * everything the realm asks of a board is compared: the FEN, the legal moves as SAN and in full, in
 * the same order, the attackers of every square, check, mate and stalemate, and each move played,
 * written in the loose ways a reader types them, and taken back.
 */

const moveFields = (m: { color: string; from: string; to: string; piece: string; captured?: string; promotion?: string; flags: string; san: string; lan: string }) => ({
  color: m.color, from: m.from, to: m.to, piece: m.piece, captured: m.captured, promotion: m.promotion, flags: m.flags, san: m.san, lan: m.lan,
});

/* A small seeded generator, so the random games are the same on every run. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const SPECIAL = [
  // Castling through, out of and into check, and with the rook taken.
  "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
  "r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1",
  "r3k2r/8/8/8/8/8/5q2/R3K2R w KQkq - 0 1",
  "r3k2r/8/8/8/8/2b5/8/R3K2R w KQkq - 0 1",
  "1r2k2r/8/8/8/8/8/8/R3K2R b KQk - 0 1",
  // En passant: open, pinned along the rank, and named in the FEN with no pawn to take.
  "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
  "8/8/8/K2pP2r/8/8/8/7k w - d6 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
  // Promotions, by push and by capture, and under-promotion to avoid stalemate.
  "1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1",
  "8/P5k1/8/8/8/8/8/K7 w - - 0 1",
  "k7/2P5/1K6/8/8/8/8/8 w - - 0 1",
  // Mate, stalemate, check, and pieces that need disambiguating by file, rank and square.
  "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
  "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
  "4k3/8/8/8/8/8/3q4/4K3 w - - 0 1",
  "N3k2N/8/8/8/N6N/8/8/4K3 w - - 0 1",
  "4k3/8/8/1Q3Q2/8/1Q3Q2/8/4K3 w - - 0 1",
  "R3k2R/8/8/8/8/8/8/R3K2R w - - 0 1",
  // Two or five fields: chess.js fills in the rest.
  "4k3/8/8/8/8/8/8/4K3 w",
  "4k3/8/8/8/8/8/8/4K3 b - -",
];

function randomGames(games: number, plies: number): string[] {
  const random = seeded(19);
  const out: string[] = [];
  for (let g = 0; g < games; g++) {
    const c = new Chess();
    for (let p = 0; p < plies && !c.isGameOver(); p++) {
      const moves = c.moves();
      c.move(moves[Math.floor(random() * moves.length)]);
      out.push(c.fen());
    }
  }
  return out;
}

const POSITIONS = [new Chess().fen(), ...SPECIAL, ...battery().map((p) => p.fen), ...randomGames(24, 140)];
/* Every position of the hand-picked ones, and every fifth from the random games, for the tests that play each move. */
const PLAYED = POSITIONS.filter((_, i) => i < SPECIAL.length + 1 + battery().length || i % 5 === 0);

const SQUARES = "abcdefgh".split("").flatMap((f) => "12345678".split("").map((r) => `${f}${r}`)) as Parameters<Chess["get"]>[0][];

/* chess.js and the board each try a move; both answer the move or both refuse it with the same text. */
function same(fen: string, move: string | { from: string; to: string; promotion?: string }) {
  const c = new Chess(fen), b = new Board(fen);
  const tryIt = (f: () => unknown) => {
    try {
      return { ok: f() };
    } catch (e) {
      return { error: (e as Error).message };
    }
  };
  const want = tryIt(() => moveFields(c.move(move as never)));
  const got = tryIt(() => moveFields(b.move(move)));
  expect(got, `${fen} ${JSON.stringify(move)}`).toEqual(want);
  if ("ok" in want) expect(b.fen(), `${fen} ${JSON.stringify(move)}`).toBe(c.fen());
}

describe("the board answers what chess.js answers", () => {
  it(`in ${POSITIONS.length} positions: the FEN, the moves in order, check and mate, every square's attackers`, () => {
    for (const fen of POSITIONS) {
      const c = new Chess(fen), b = new Board(fen);
      expect(b.fen(), fen).toBe(c.fen());
      expect(b.turn(), fen).toBe(c.turn());
      expect(b.moveNumber(), fen).toBe(c.moveNumber());
      expect(b.board(), fen).toEqual(c.board());
      for (const colour of ["w", "b"] as const) expect(b.getCastlingRights(colour), fen).toEqual(c.getCastlingRights(colour));
      expect(b.moves(), fen).toEqual(c.moves());
      expect(b.moves({ verbose: true }).map(moveFields), fen).toEqual(c.moves({ verbose: true }).map(moveFields));
      expect(b.inCheck(), fen).toBe(c.inCheck());
      expect(b.isCheckmate(), fen).toBe(c.isCheckmate());
      expect(b.isStalemate(), fen).toBe(c.isStalemate());
      expect(b.moveCount(), fen).toBe(c.moves().length);
      expect(b.mates(), fen).toEqual(c.moves().filter((san) => san.endsWith("#")));
      expect(b.hasEnPassant(), fen).toBe(c.moves({ verbose: true }).some((m) => m.flags.includes("e")));
      for (const sq of SQUARES) {
        expect(b.get(sq), `${fen} ${sq}`).toEqual(c.get(sq));
        for (const colour of ["w", "b"] as const) expect(b.attackers(sq, colour), `${fen} ${sq} ${colour}`).toEqual(c.attackers(sq, colour));
      }
    }
  }, 120_000);

  it("every legal move, played as SAN and as squares, leaves the same FEN, and taking it back restores the position", () => {
    for (const fen of PLAYED) {
      for (const m of new Chess(fen).moves({ verbose: true })) {
        same(fen, m.san);
        same(fen, { from: m.from, to: m.to, promotion: m.promotion });
        const c = new Chess(fen), b = new Board(fen);
        c.move(m.san);
        b.move(m.san);
        expect(moveFields(b.undo()!), `${fen} undo ${m.san}`).toEqual(moveFields(c.undo()!));
        expect(b.fen(), `${fen} undo ${m.san}`).toBe(c.fen());
      }
    }
  }, 120_000);

  it("reads the loose spellings chess.js reads, and refuses what it refuses, with its words", () => {
    for (const fen of PLAYED.slice(0, 160)) {
      for (const m of new Chess(fen).moves({ verbose: true })) {
        const piece = m.piece.toUpperCase();
        for (const loose of [
          m.lan, `${m.from}-${m.to}${m.promotion ?? ""}`, `${piece}${m.from}${m.to}`, `${piece}${m.from}-${m.to}`, `${m.san}!?`,
          m.san.replace("x", ""), m.san.replace("=", ""), `${piece}${m.from[0]}${m.to}`, `${piece}${m.from[1]}${m.to}`,
          m.san.replace(/^O-O/, "0-0"), m.san.toLowerCase(),
        ]) {
          same(fen, loose);
        }
      }
      for (const wrong of ["", "--", "Ke9", "Nf9", "Zz9", "e2e5", "xyz", "Qxh7#", "O-O-O-O", "a8=Q"]) same(fen, wrong);
      for (const wrong of [{ from: "e2", to: "e5" }, { from: "E2", to: "E4" }, { from: "a7", to: "a8" }, { from: "zz", to: "e4" }]) same(fen, wrong);
    }
  });

  it("refuses the FENs chess.js refuses, with its words", () => {
    for (const bad of [
      "", "8/8/8/8/8/8/8/8 w - - 0 1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1",
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - -1 1",
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkx - 0 1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1",
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e3 0 1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1",
      "rnbqkbnr/pppppppp/44/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "rnbqkbnr/ppppxppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "rnbqkbnr/ppppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "rnbqqbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "rnbkkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "pnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 extra",
    ]) {
      const message = (f: () => unknown) => {
        try {
          f();
          return "loaded";
        } catch (e) {
          return (e as Error).message;
        }
      };
      expect(message(() => new Board(bad)), bad).toBe(message(() => new Chess(bad)));
    }
  });
});

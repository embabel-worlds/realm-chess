import { Chess } from "chess.js";

/*
 * Explorer answers in the shapes Lichess sends them, for the tests' three positions: the start,
 * after 1.e4, and the Exchange Ruy past the book. The moves are each position's own legal moves
 * and the counts are fixed numbers, so every test and the Node realm read the same answers.
 * The player database's answer streams: each record a fuller version of the one before.
 */

export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
export const RUY = "r1b1kbnr/1pp3pp/p4p2/2p5/4P3/1N6/PPP2PPP/RNBR2K1 b kq - 0 9";
export const FIXTURE_FENS = [START, AFTER_E4, RUY];

const seedOf = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function movesFrom(fen: string, salt: string, n: number) {
  const seed = seedOf(fen + salt);
  return new Chess(fen).moves({ verbose: true }).slice(0, n).map((m, i) => {
    const k = (seed >>> (i % 16)) % 997;
    return { uci: m.lan, san: m.san, white: 1200 - 90 * i + k, draws: 800 - 40 * i + (k % 300), black: 700 - 30 * i + (k % 200) };
  });
}

const ids = ["Ab3dE5gH", "zY9xW8vU", "k2L3m4N5", "QqRrSsTt", "u1V2w3X4"];
const names = [["Carlsen, Magnus", "Caruana, Fabiano"], ["Kasparov, Garry", "Karpov, Anatoly"], ["Fischer, Robert James", "Spassky, Boris V."]];

function gamesFrom(fen: string, n: number) {
  const moves = new Chess(fen).moves({ verbose: true });
  return ids.slice(0, n).map((id, i) => ({
    id,
    uci: moves[i % moves.length].lan,
    winner: i % 3 === 0 ? "white" : i % 3 === 1 ? "black" : null,
    white: { name: names[i % 3][0], rating: 2700 + i * 7 },
    black: { name: names[i % 3][1], rating: 2690 + i * 5 },
    year: 2010 + i,
    month: `${2010 + i}-0${(i % 9) + 1}`,
  }));
}

/** The masters database's answer for a position. */
export function mastersAnswer(fen: string) {
  const moves = movesFrom(fen, "masters", 6);
  const sum = (k: "white" | "draws" | "black") => moves.reduce((n, m) => n + m[k], 0);
  return { white: sum("white"), draws: sum("draws"), black: sum("black"), moves, topGames: gamesFrom(fen, 4), opening: null };
}

/** The player database's answer, as the records it streams: the last is the whole answer. */
export function playerRecords(fen: string, player: string, color: string) {
  const full = movesFrom(fen, `player ${player} ${color}`, 4).map((m) => ({ ...m, averageOpponentRating: 2400, performance: 2550 }));
  const recentGames = gamesFrom(fen, 3).map((g) => ({ ...g, speed: "blitz", year: undefined, month: "2026-09" }));
  return [
    { white: 0, draws: 0, black: 0, moves: [], recentGames: [], opening: null, queuePosition: 0 },
    { white: 10, draws: 3, black: 4, moves: full.slice(0, 2), recentGames: recentGames.slice(0, 1), opening: null },
    { white: 40, draws: 12, black: 9, moves: full, recentGames, opening: null },
  ];
}

/** One rating band and time control's answer. Different for each cell, so rows keep per-cell statistics. */
export function ratedAnswer(fen: string, ratings: string, speeds?: string) {
  const moves = movesFrom(fen, `rated ${ratings} ${speeds ?? "all"}`, 5);
  const sum = (k: "white" | "draws" | "black") => moves.reduce((n, m) => n + m[k], 0) + 37;
  return { white: sum("white"), draws: sum("draws"), black: sum("black"), moves, topGames: [], recentGames: [] };
}

/** The NDJSON body the player database sends, and what the host hands the guest from it. */
export const ndjsonText = (records: unknown[], fragment = "") => `${records.map((r) => JSON.stringify(r)).join("\n")}\n${fragment}`;
export const ndjsonReply = (records: unknown[], truncated = false) => ({ records, truncated });

/** Wikibooks answers for one line: which pages exist, and the deepest one's text. */
export function wikibooksAnswers(present: string[], extract: string) {
  return (args: Record<string, unknown>) => {
    const titles = String(args.titles).split("|");
    if (args.prop === "info") {
      return { query: { pages: Object.fromEntries(titles.map((t, i) => [present.includes(t) ? String(100 + i) : String(-1 - i), present.includes(t) ? { title: t } : { title: t, missing: "" }])) } };
    }
    return { query: { pages: { "100": { title: titles[0], extract } } } };
  };
}

export const RUY_THEORY = `The Exchange Variation gives up the bishop pair for a pawn structure White can use in the endgame.

White's plan is to trade queens and use the kingside pawn majority; Black's is the bishop pair and quick development.


== Theory table ==
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6

== References ==
Some book.`;

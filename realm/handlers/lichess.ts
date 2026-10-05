/* What people played from a position on Lichess: masters, one chosen player, and every rating band. */
import type { HandlerSpec } from "@embabel/realm-types";
import { z } from "zod";
import { cursor, fens, rows } from "./position.ts";

/** A list of the values a query pinned for one property, at most 64 of them. The handler checks each one. */
export const pushed = (description: string) => z.array(z.string().max(64)).max(64).describe(description);

/** One move played from a position, with its game count and results, as mastersAtPosition and playerAtPosition return it. */
export const explorerMove = z.object({
  moveId: z.string(),
  fen: z.string(),
  uci: z.string(),
  san: z.string(),
  games: z.number(),
  white: z.number(),
  draws: z.number(),
  black: z.number(),
  whiteWinPct: z.number().optional(),
  drawPct: z.number().optional(),
  blackWinPct: z.number().optional(),
  scoreForMover: z.number().optional(),
  averageRating: z.number().optional(),
  player: z.string(),
  color: z.string(),
});

/** One game through a position, as mastersAtPosition and playerAtPosition return it. */
export const explorerGame = z.object({
  gameId: z.string(),
  fen: z.string(),
  uci: z.string(),
  white: z.string(),
  whiteElo: z.number().optional(),
  black: z.string(),
  blackElo: z.number().optional(),
  result: z.string(),
  year: z.number().optional(),
  month: z.string(),
  speed: z.string(),
  url: z.string(),
  player: z.string(),
  color: z.string(),
});

/** The moves from a position and the games through it, which one Lichess request answers together. */
export const movesAndGames = z.object({ moves: z.array(explorerMove), games: z.array(explorerGame) });

/** How often one move is played from a position in one rating band and time control, as ratedMoves returns it. */
export const ratedMove = z.object({
  rowId: z.string(),
  fen: z.string(),
  band: z.string(),
  bandLabel: z.string(),
  speed: z.string(),
  san: z.string(),
  uci: z.string(),
  games: z.number(),
  share: z.number().optional(),
  whiteWinPct: z.number().optional(),
  drawPct: z.number().optional(),
  blackWinPct: z.number().optional(),
  scoreForMover: z.number().optional(),
  bandGames: z.number(),
});

const pinnedPlayers = () => pushed("The Lichess usernames the query pinned.");
const pinnedColours = () => pushed("The colours the query pinned: white or black.");

export const mastersAtPosition = {
  namespace: "chess",
  description:
    "What masters played from each position — every move with its game count and results — and the top master games through it. One request per position feeds both: the moves (MASTERS_PLAYED) and the games (MASTER_GAME). Needs the Lichess token.",
  input: z.object({ fens: z.array(z.string()) }),
  output: movesAndGames,
} satisfies HandlerSpec;

export const rowsMasterMoves = {
  namespace: "chess",
  description:
    "What masters played from each position the host names, as MasterMove rows. Shares one kept Lichess answer with rowsMasterGames.",
  input: z.strictObject({ fens, cursor: cursor.optional() }),
  output: rows,
} satisfies HandlerSpec;

export const rowsMasterGames = {
  namespace: "chess",
  description:
    "The top master games through each position the host names, as MasterGame rows. Shares one kept Lichess answer with rowsMasterMoves.",
  input: z.strictObject({ fens, cursor: cursor.optional() }),
  output: rows,
} satisfies HandlerSpec;

export const playerAtPosition = {
  namespace: "chess",
  description:
    "What one Lichess player played from each position, as one colour — every move with its results — and their recent games through it (PLAYER_PLAYED, PLAYER_GAME). Covers the player's whole Lichess history in one request. Needs the Lichess token.",
  input: z.object({ fens: z.array(z.string()), filters: z.string().optional() }),
  output: movesAndGames,
} satisfies HandlerSpec;

export const rowsPlayerMoves = {
  namespace: "chess",
  description:
    "What the pinned Lichess players played from each position, in the pinned colours (White when none is pinned), as PlayerMove rows.",
  input: z.strictObject({
    fens,
    player: pinnedPlayers().optional(),
    color: pinnedColours().optional(),
    cursor: cursor.optional(),
  }),
  output: rows,
} satisfies HandlerSpec;

export const rowsPlayerGames = {
  namespace: "chess",
  description:
    "The pinned Lichess players' recent games through each position, in the pinned colours (White when none is pinned), as PlayerGame rows.",
  input: z.strictObject({
    fens,
    player: pinnedPlayers().optional(),
    color: pinnedColours().optional(),
    cursor: cursor.optional(),
  }),
  output: rows,
} satisfies HandlerSpec;

export const ratedMoves = {
  namespace: "chess",
  description:
    "How often each move is played from a position by rating band and time control on Lichess, and how it scores.",
  input: z.object({ fens: z.array(z.string()), filters: z.string().optional() }),
  output: z.array(ratedMove),
} satisfies HandlerSpec;

export const rowsRatedMoves = {
  namespace: "chess",
  description:
    "How often each move is played from each position by rating band and time control on Lichess, one request per band and time control, as RatedMove rows.",
  input: z.strictObject({
    fens,
    band: pushed(
      "The rating band floors the query pinned: 0, 1000, 1200, 1400, 1600, 1800, 2000, 2200 or 2500.",
    ).optional(),
    speed: pushed("The time controls the query pinned, or all.").optional(),
    cursor: cursor.optional(),
  }),
  output: rows,
} satisfies HandlerSpec;

/** The Lichess handlers, in the order the realm declares them. */
export const lichessHandlers = {
  mastersAtPosition,
  rowsMasterMoves,
  rowsMasterGames,
  playerAtPosition,
  rowsPlayerMoves,
  rowsPlayerGames,
  ratedMoves,
  rowsRatedMoves,
};

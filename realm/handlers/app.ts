/*
 * The handlers Chesscalator calls. The app's frame has one serialized realm.call and no views,
 * so each of these answers the views the page shows at one moment of use, under the views' names.
 */
import type { HandlerSpec } from "@embabel/realm-types";
import { z } from "zod";

/** The position the page is on. */
export const fen = z.string().min(1).max(100).describe("The position, as a complete FEN.");

/** The moves that reached the position, when the page knows them. */
export const moves = z
  .string()
  .max(4096)
  .describe("The game's moves from the start in SAN, space-separated, when the game was played from the start. They must reach `fen`.");

/** What every app handler answers: the rows of each view the page shows, and the realm's status. */
export const reply = z
  .object({})
  .describe(
    "`views`: for each view the page shows, `{rows}` as the view returns them, or `{rows: [], error}` when the realm could not get them, or `{rows: [], skipped: \"time\"}` when there was no time left in the call. `status`: ChessStatus, which says why a column is empty.",
  );

export const appPosition = {
  namespace: "chess",
  description:
    "For Chesscalator, on every step: ImbalancesOf, the opening (OpeningOfLine along `moves`, else OpeningOf), TheoryOfLine along `moves`, and BestMoves within `withinCp` of the best. A new position costs one engine search.",
  input: z.strictObject({
    fen,
    moves: moves.optional(),
    withinCp: z
      .int()
      .min(0)
      .max(1000)
      .describe("Keep moves at most this many centipawns worse than the best. 50 when absent.")
      .optional(),
  }),
  output: reply,
} satisfies HandlerSpec;

export const appPractice = {
  namespace: "chess",
  description:
    "For Chesscalator: what Lichess says about a position. `masters` gives MastersAtPosition and MasterGamesAtPosition; `player` (and `color`, white when absent) gives PlayerAtPosition and PlayerGamesAtPosition; `speed` gives MovesByRating and `band` gives MovesByTimeControl, with `minShare`. Needs the Lichess token.",
  input: z.strictObject({
    fen,
    filters: z.strictObject({
      masters: z.boolean().optional(),
      player: z.string().max(30).optional(),
      color: z.enum(["white", "black"]).optional(),
      speed: z.enum(["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence", "all"]).optional(),
      band: z.enum(["0", "1000", "1200", "1400", "1600", "1800", "2000", "2200", "2500"]).optional(),
      minShare: z.int().min(0).max(100).optional(),
    }),
  }),
  output: reply,
} satisfies HandlerSpec;

export const appPlans = {
  namespace: "chess",
  description:
    "For Chesscalator, when the reader asks for plans: PlansInLine along `moves`, else PlansInPosition, at `level`. A new position costs an engine search and a model call.",
  input: z.strictObject({
    fen,
    moves: moves.optional(),
    level: z.enum(["beginner", "intermediate", "expert"]).describe("Who the plans are for. intermediate when absent.").optional(),
  }),
  output: reply,
} satisfies HandlerSpec;

/** The app handlers, in the order the realm declares them. */
export const appHandlers = { appPosition, appPractice, appPlans };

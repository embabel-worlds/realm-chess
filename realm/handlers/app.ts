/*
 * The handlers Chesscalator calls. The app's frame has one serialized realm.call and no views,
 * so each of these answers the views the page shows at one moment of use, under the views' names.
 */
import type { HandlerSpec } from "@embabel/realm-types";

export const appPosition = {
  namespace: "chess",
  description:
    "For Chesscalator, on every step: ImbalancesOf, the opening (OpeningOfLine along `moves`, else OpeningOf), TheoryOfLine along `moves`, and BestMoves within `withinCp` of the best, searched to `depth`. A new position costs one engine search.",
  input: {
    type: "object",
    properties: {
      fen: { type: "string", minLength: 1, maxLength: 100, description: "The position, as a complete FEN." },
      moves: {
        type: "string",
        maxLength: 4096,
        description: "The game's moves from the start in SAN, space-separated, when the game was played from the start. They must reach `fen`.",
      },
      withinCp: {
        type: "integer",
        minimum: 0,
        maximum: 1000,
        description: "Keep moves at most this many centipawns worse than the best. 50 when absent.",
      },
      depth: {
        type: "integer",
        minimum: 6,
        maximum: 22,
        description: "The depth to search to, as BestMoves's `depth`. 10, the default search, when absent.",
      },
    },
    required: ["fen"],
    additionalProperties: false,
  },
  output: {
    type: "object",
    description: "`views`: for each view the page shows, `{rows}` as the view returns them, or `{rows: [], error}` when the realm could not get them, or `{rows: [], skipped: \"time\"}` when there was no time left in the call. `status`: ChessStatus, which says why a column is empty.",
  },
} satisfies HandlerSpec;

export const appPractice = {
  namespace: "chess",
  description:
    "For Chesscalator: what Lichess says about a position. `masters` gives MastersAtPosition and MasterGamesAtPosition; `player` (and `color`, white when absent) gives PlayerAtPosition and PlayerGamesAtPosition; `speed` gives MovesByRating and `band` gives MovesByTimeControl, with `minShare`. Needs the Lichess token.",
  input: {
    type: "object",
    properties: {
      fen: { type: "string", minLength: 1, maxLength: 100, description: "The position, as a complete FEN." },
      filters: {
        type: "object",
        properties: {
          masters: { type: "boolean" },
          player: { type: "string", maxLength: 30 },
          color: { type: "string", enum: ["white", "black"] },
          speed: {
            type: "string",
            enum: ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence", "all"],
          },
          band: { type: "string", enum: ["0", "1000", "1200", "1400", "1600", "1800", "2000", "2200", "2500"] },
          minShare: { type: "integer", minimum: 0, maximum: 100 },
        },
        additionalProperties: false,
      },
    },
    required: ["fen", "filters"],
    additionalProperties: false,
  },
  output: {
    type: "object",
    description: "`views`: for each view the page shows, `{rows}` as the view returns them, or `{rows: [], error}` when the realm could not get them, or `{rows: [], skipped: \"time\"}` when there was no time left in the call. `status`: ChessStatus, which says why a column is empty.",
  },
} satisfies HandlerSpec;

export const appPlans = {
  namespace: "chess",
  description:
    "For Chesscalator, when the reader asks for plans: PlansInLine along `moves`, else PlansInPosition, at `level`. A new position costs an engine search and a model call.",
  input: {
    type: "object",
    properties: {
      fen: { type: "string", minLength: 1, maxLength: 100, description: "The position, as a complete FEN." },
      moves: {
        type: "string",
        maxLength: 4096,
        description: "The game's moves from the start in SAN, space-separated, when the game was played from the start. They must reach `fen`.",
      },
      level: {
        type: "string",
        enum: ["beginner", "intermediate", "expert"],
        description: "Who the plans are for. intermediate when absent.",
      },
    },
    required: ["fen"],
    additionalProperties: false,
  },
  output: {
    type: "object",
    description: "`views`: for each view the page shows, `{rows}` as the view returns them, or `{rows: [], error}` when the realm could not get them, or `{rows: [], skipped: \"time\"}` when there was no time left in the call. `status`: ChessStatus, which says why a column is empty.",
  },
} satisfies HandlerSpec;

/** The app handlers, in the order the realm declares them. */
export const appHandlers = { appPosition, appPractice, appPlans };

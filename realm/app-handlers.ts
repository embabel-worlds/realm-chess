/*
 * The handlers Chesscalator calls. The app's frame has one serialized realm.call and no views,
 * so each of these answers the views the page shows at one moment of use, under the views' names.
 */

const fen = { type: "string", minLength: 1, maxLength: 100, description: "The position, as a complete FEN." };
const moves = {
  type: "string",
  maxLength: 4096,
  description: "The game's moves from the start in SAN, space-separated, when the game was played from the start. They must reach `fen`.",
};
const reply = {
  type: "object",
  description:
    "`views`: for each view the page shows, `{rows}` as the view returns them, or `{rows: [], error}` when the realm could not get them, or `{rows: [], skipped: \"time\"}` when there was no time left in the call. `status`: ChessStatus, which says why a column is empty.",
};

export const appHandlers = {
  appPosition: {
    namespace: "chess",
    description:
      "For Chesscalator, on every step: ImbalancesOf, the opening (OpeningOfLine along `moves`, else OpeningOf), TheoryOfLine along `moves`, and BestMoves within `withinCp` of the best. A new position costs one engine search.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: {
        fen,
        moves,
        withinCp: { type: "integer", minimum: 0, maximum: 1000, description: "Keep moves at most this many centipawns worse than the best. 50 when absent." },
      },
      required: ["fen"],
    },
    output: reply,
  },
  appPractice: {
    namespace: "chess",
    description:
      "For Chesscalator: what Lichess says about a position. `masters` gives MastersAtPosition and MasterGamesAtPosition; `player` (and `color`, white when absent) gives PlayerAtPosition and PlayerGamesAtPosition; `speed` gives MovesByRating and `band` gives MovesByTimeControl, with `minShare`. Needs the Lichess token.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: {
        fen,
        filters: {
          type: "object",
          additionalProperties: false,
          properties: {
            masters: { type: "boolean" },
            player: { type: "string", maxLength: 30 },
            color: { type: "string", enum: ["white", "black"] },
            speed: { type: "string", enum: ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence", "all"] },
            band: { type: "string", enum: ["0", "1000", "1200", "1400", "1600", "1800", "2000", "2200", "2500"] },
            minShare: { type: "integer", minimum: 0, maximum: 100 },
          },
        },
      },
      required: ["fen", "filters"],
    },
    output: reply,
  },
  appPlans: {
    namespace: "chess",
    description:
      "For Chesscalator, when the reader asks for plans: PlansInLine along `moves`, else PlansInPosition, at `level`. A new position costs an engine search and a model call.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: {
        fen,
        moves,
        level: { type: "string", enum: ["beginner", "intermediate", "expert"], description: "Who the plans are for. intermediate when absent." },
      },
      required: ["fen"],
    },
    output: reply,
  },
};

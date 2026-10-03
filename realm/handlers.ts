import type { HandlerSpec } from "@embabel/realm-types";

/*
 * The handlers the graph's producers call. A captured producer sends the anchor keys it is
 * fetching for as one list and expects `{ rows, next }` back, so each of these wraps one of
 * the public handlers for that shape.
 */

const keys = (description: string) => ({
  type: "array",
  minItems: 1,
  maxItems: 256,
  items: { type: "string", minLength: 1, maxLength: 2048 },
  description,
});

const rows = { type: "object" };

/* A list of the values a query pinned for one property. The handler checks each one. */
const pushed = (description: string) => ({
  type: "array",
  maxItems: 64,
  items: { type: "string", maxLength: 64 },
  description,
});

const cursor = { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." };

const fens = keys("The Position FENs the host is fetching for.");
const lines = keys("The GameLine move lists the host is fetching for: SAN from the start, space-separated.");

export const producerHandlers = {
  rowsImbalances: {
    namespace: "chess",
    description: "Silman's imbalances of each position the host names, as PositionImbalances rows.",
    input: { type: "object", additionalProperties: false, properties: { fens }, required: ["fens"] },
    output: rows,
  },
  rowsOpeningOfPosition: {
    namespace: "chess",
    description: "The book's name for each position the host names, as Opening rows. A position the book does not name has none.",
    input: { type: "object", additionalProperties: false, properties: { fens }, required: ["fens"] },
    output: rows,
  },
  rowsOpeningOfLine: {
    namespace: "chess",
    description: "The deepest book name along each game line the host names, as Opening rows.",
    input: { type: "object", additionalProperties: false, properties: { lines }, required: ["lines"] },
    output: rows,
  },
  rowsCandidates: {
    namespace: "chess",
    description:
      "The engine's best lines in each position the host names, as CandidateMove rows carrying the analysis they came from. Pages when there are more new positions than one dispatch can search.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: {
        fens,
        cursor,
      },
      required: ["fens"],
    },
    output: rows,
  },
  rowsTheory: {
    namespace: "chess",
    description:
      "What the Chess Opening Theory wikibook says along each game line the host names, as OpeningTheory rows: the deepest page the line reaches, as an attributed excerpt with its link.",
    input: { type: "object", additionalProperties: false, properties: { lines, cursor }, required: ["lines"] },
    output: rows,
  },
  rowsPositionPlans: {
    namespace: "chess",
    description:
      "The plans for both sides in each position the host names, as Plan rows carrying the analysis they were made from. One position a page.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: { fens, level: pushed("The reader's levels the query pinned: beginner, intermediate or expert."), cursor },
      required: ["fens"],
    },
    output: rows,
  },
  rowsLinePlans: {
    namespace: "chess",
    description:
      "The plans in the position each game line reaches, told the line's opening name and theory, as Plan rows. One line a page.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: { lines, level: pushed("The reader's levels the query pinned: beginner, intermediate or expert."), cursor },
      required: ["lines"],
    },
    output: rows,
  },
  rowsMasterMoves: {
    namespace: "chess",
    description: "What masters played from each position the host names, as MasterMove rows. Shares one kept Lichess answer with rowsMasterGames.",
    input: { type: "object", additionalProperties: false, properties: { fens, cursor }, required: ["fens"] },
    output: rows,
  },
  rowsMasterGames: {
    namespace: "chess",
    description: "The top master games through each position the host names, as MasterGame rows. Shares one kept Lichess answer with rowsMasterMoves.",
    input: { type: "object", additionalProperties: false, properties: { fens, cursor }, required: ["fens"] },
    output: rows,
  },
  rowsPlayerMoves: {
    namespace: "chess",
    description: "What the pinned Lichess players played from each position, in the pinned colours (White when none is pinned), as PlayerMove rows.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: { fens, player: pushed("The Lichess usernames the query pinned."), color: pushed("The colours the query pinned: white or black."), cursor },
      required: ["fens"],
    },
    output: rows,
  },
  rowsPlayerGames: {
    namespace: "chess",
    description: "The pinned Lichess players' recent games through each position, in the pinned colours (White when none is pinned), as PlayerGame rows.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: { fens, player: pushed("The Lichess usernames the query pinned."), color: pushed("The colours the query pinned: white or black."), cursor },
      required: ["fens"],
    },
    output: rows,
  },
  rowsRatedMoves: {
    namespace: "chess",
    description:
      "How often each move is played from each position by rating band and time control on Lichess, one request per band and time control, as RatedMove rows.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: {
        fens,
        band: pushed("The rating band floors the query pinned: 0, 1000, 1200, 1400, 1600, 1800, 2000, 2200 or 2500."),
        speed: pushed("The time controls the query pinned, or all."),
        cursor,
      },
      required: ["fens"],
    },
    output: rows,
  },
  status: {
    namespace: "chess",
    description:
      "What the realm could not do, as the guest last recorded it: whether Lichess and the model answered, the last refusal code and when.",
    input: {
      type: "object",
      additionalProperties: false,
      properties: { username: keys("The AssistantUser usernames the host is fetching for.") },
      required: ["username"],
    },
    output: rows,
  },
} satisfies Record<string, HandlerSpec>;

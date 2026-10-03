import type { HandlerSpec } from "@embabel/realm-types";

/*
 * The handlers the graph's producers call. A captured producer sends the anchor keys it is
 * fetching for as one list and expects `{ rows, next }` back, so each of these wraps one of
 * Rod's handlers for that shape.
 */

const keys = (description: string) => ({
  type: "array",
  minItems: 1,
  maxItems: 256,
  items: { type: "string", minLength: 1, maxLength: 2048 },
  description,
});

const rows = { type: "object" };

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
} satisfies Record<string, HandlerSpec>;

/* What a position and a game line are on their own: their imbalances and the opening the book calls them. */
import type { HandlerSpec } from "@embabel/realm-types";

/*
 * What the graph's producers send and expect back. A captured producer sends the anchor keys it is
 * fetching for as one list, at most 256 of them. A paged producer expects `{ rows, next }` back; one
 * with no page expects the rows as a plain list. The rows* handlers in every concern module declare
 * those shapes.
 */

export const positionImbalances = {
  namespace: "chess",
  description:
    "Jeremy Silman's imbalances for each position: material, minor pieces, pawn structure, space, files, key squares, development and king safety.",
  input: { type: "object", properties: { fens: { type: "array", items: { type: "string" } } }, required: ["fens"] },
  output: {
    type: "array",
    items: {
      type: "object",
      properties: {
        fen: { type: "string" },
        sideToMove: { type: "string" },
        phase: { type: "string" },
        facts: { type: "string" },
        structure: { type: "string" },
        materialWhite: { type: "number" },
        materialBlack: { type: "number" },
        bishopPairWhite: { type: "boolean" },
        bishopPairBlack: { type: "boolean" },
        isolatedQueenPawnWhite: { type: "boolean" },
        isolatedQueenPawnBlack: { type: "boolean" },
        passedWhite: { type: "string" },
        passedBlack: { type: "string" },
        openFiles: { type: "string" },
        oppositeSideCastling: { type: "boolean" },
        oppositeColouredBishops: { type: "boolean" },
        detail: { type: "string" },
      },
      required: [
        "fen",
        "sideToMove",
        "phase",
        "facts",
        "structure",
        "materialWhite",
        "materialBlack",
        "bishopPairWhite",
        "bishopPairBlack",
        "isolatedQueenPawnWhite",
        "isolatedQueenPawnBlack",
        "passedWhite",
        "passedBlack",
        "openFiles",
        "oppositeSideCastling",
        "oppositeColouredBishops",
        "detail",
      ],
    },
  },
} satisfies HandlerSpec;

export const openingLookup = {
  namespace: "chess",
  description: "The named opening each position is, from the Lichess opening book. A position the book does not name returns nothing.",
  input: { type: "object", properties: { fens: { type: "array", items: { type: "string" } } }, required: ["fens"] },
  output: {
    type: "array",
    items: {
      type: "object",
      properties: { fen: { type: "string" }, eco: { type: "string" }, name: { type: "string" }, pgn: { type: "string" } },
      required: ["fen", "eco", "name", "pgn"],
    },
  },
} satisfies HandlerSpec;

export const openingOfGameLine = {
  namespace: "chess",
  description:
    "The deepest named opening along each game line (SAN from the start): the name a game keeps after it leaves the book. A line the book never names returns nothing.",
  input: { type: "object", properties: { lines: { type: "array", items: { type: "string" } } }, required: ["lines"] },
  output: {
    type: "array",
    items: {
      type: "object",
      properties: {
        line: { type: "string" },
        namedAtPly: { type: "number" },
        pliesPast: { type: "number" },
        fen: { type: "string" },
        eco: { type: "string" },
        name: { type: "string" },
        pgn: { type: "string" },
      },
      required: ["line", "namedAtPly", "pliesPast", "fen", "eco", "name", "pgn"],
    },
  },
} satisfies HandlerSpec;

export const rowsImbalances = {
  namespace: "chess",
  description: "Silman's imbalances of each position the host names, as PositionImbalances rows.",
  input: {
    type: "object",
    properties: {
      fens: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The Position FENs the host is fetching for.",
      },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "array", items: { type: "object" } },
} satisfies HandlerSpec;

export const rowsOpeningOfPosition = {
  namespace: "chess",
  description: "The book's name for each position the host names, as Opening rows. A position the book does not name has none.",
  input: {
    type: "object",
    properties: {
      fens: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The Position FENs the host is fetching for.",
      },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "array", items: { type: "object" } },
} satisfies HandlerSpec;

export const rowsOpeningOfLine = {
  namespace: "chess",
  description: "The deepest book name along each game line the host names, as Opening rows.",
  input: {
    type: "object",
    properties: {
      lines: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The GameLine move lists the host is fetching for: SAN from the start, space-separated.",
      },
    },
    required: ["lines"],
    additionalProperties: false,
  },
  output: { type: "array", items: { type: "object" } },
} satisfies HandlerSpec;

/** The position handlers, in the order the realm declares them. */
export const positionHandlers = {
  positionImbalances,
  openingLookup,
  openingOfGameLine,
  rowsImbalances,
  rowsOpeningOfPosition,
  rowsOpeningOfLine,
};

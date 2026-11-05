/* The plans for both sides in a position, which a model decides from the facts the other handlers compute. */
import type { HandlerSpec } from "@embabel/realm-types";

export const explainPlans = {
  namespace: "chess",
  description:
    "The plans for both sides in each position, decided by a model with the chess-plans skill from the position's imbalances, its opening-book name and the engine's candidate moves. The facts are computed; the judgement is the model's.",
  // The published contract has always left this input open, so it stays a schema that accepts anything.
  input: {},
  output: {
    type: "array",
    items: {
      type: "object",
      properties: {
        planId: { type: "string" },
        fen: { type: "string" },
        side: { type: "string" },
        priority: { type: "number" },
        name: { type: "string" },
        idea: { type: "string" },
        moves: { type: "string" },
        imbalances: { type: "string" },
        engineEvidence: { type: "string" },
        summary: { type: "string" },
        structure: { type: "string" },
        level: { type: "string" },
        opening: { type: "string" },
        model: { type: "string" },
      },
      required: [
        "planId",
        "fen",
        "side",
        "priority",
        "name",
        "idea",
        "moves",
        "imbalances",
        "engineEvidence",
        "summary",
        "structure",
        "level",
        "opening",
        "model",
      ],
    },
  },
} satisfies HandlerSpec;

export const explainLinePlans = {
  namespace: "chess",
  description:
    "The plans in the position a game line reaches, told the line's deepest opening name — which a position looked up alone has lost once it is past the book.",
  input: {},
  output: {
    type: "array",
    items: {
      type: "object",
      properties: {
        line: { type: "string" },
        planId: { type: "string" },
        fen: { type: "string" },
        side: { type: "string" },
        priority: { type: "number" },
        name: { type: "string" },
        idea: { type: "string" },
        moves: { type: "string" },
        imbalances: { type: "string" },
        engineEvidence: { type: "string" },
        summary: { type: "string" },
        structure: { type: "string" },
        level: { type: "string" },
        opening: { type: "string" },
        model: { type: "string" },
      },
      required: [
        "line",
        "planId",
        "fen",
        "side",
        "priority",
        "name",
        "idea",
        "moves",
        "imbalances",
        "engineEvidence",
        "summary",
        "structure",
        "level",
        "opening",
        "model",
      ],
    },
  },
} satisfies HandlerSpec;

export const rowsPositionPlans = {
  namespace: "chess",
  description:
    "The plans for both sides in each position the host names, as Plan rows carrying the analysis they were made from. One position a page.",
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
      level: {
        maxItems: 64,
        type: "array",
        items: { type: "string", maxLength: 64 },
        description: "The reader's levels the query pinned: beginner, intermediate or expert.",
      },
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

export const rowsLinePlans = {
  namespace: "chess",
  description:
    "The plans in the position each game line reaches, told the line's opening name and theory, as Plan rows. One line a page.",
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
      level: {
        maxItems: 64,
        type: "array",
        items: { type: "string", maxLength: 64 },
        description: "The reader's levels the query pinned: beginner, intermediate or expert.",
      },
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["lines"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

/** The plans handlers, in the order the realm declares them. */
export const plansHandlers = { explainPlans, explainLinePlans, rowsPositionPlans, rowsLinePlans };

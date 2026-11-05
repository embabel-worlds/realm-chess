/* What the engine says about a position: its best lines, strongest first. */
import type { HandlerSpec } from "@embabel/realm-types";

export const analysePosition = {
  namespace: "chess",
  description:
    "The engine's best lines in each position, strongest first, each with what it changes about the position's imbalances. A position with no legal moves returns nothing: there is nothing to recommend in a checkmate or a stalemate, and the FEN says which.",
  input: {
    type: "object",
    properties: {
      fens: { type: "array", items: { type: "string" } },
      multiPv: { type: "number" },
      depth: { type: "number" },
    },
    required: ["fens"],
  },
  output: {
    type: "array",
    items: {
      type: "object",
      properties: {
        candidateId: { type: "string" },
        fen: { type: "string" },
        rank: { type: "number" },
        uci: { type: "string" },
        san: { type: "string" },
        side: { type: "string" },
        scoreCp: { type: "number" },
        mate: { type: "number" },
        whiteCp: { type: "number" },
        lossCp: { type: "number" },
        depth: { type: "number" },
        pvSan: { type: "string" },
        pvUci: { type: "string" },
        creates: { type: "string" },
        removes: { type: "string" },
        engine: { type: "string" },
        elapsedMs: { type: "number" },
      },
      required: [
        "candidateId",
        "fen",
        "rank",
        "uci",
        "san",
        "side",
        "depth",
        "pvSan",
        "pvUci",
        "creates",
        "removes",
        "engine",
        "elapsedMs",
      ],
    },
  },
} satisfies HandlerSpec;

export const rowsCandidates = {
  namespace: "chess",
  description:
    "The engine's best lines in each position the host names, as CandidateMove rows carrying the analysis they came from. Pages when there are more new positions than one dispatch can search.",
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
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

/** The engine handlers, in the order the realm declares them. */
export const engineHandlers = { analysePosition, rowsCandidates };

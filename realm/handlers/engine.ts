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
      multiPv: { type: "number", description: "Lines per position, 1 to 8. 3 when absent." },
      depth: {
        type: "number",
        description:
          "The depth to search to, 6 to 22. 10 when absent, the default search. Each ply past 10 doubles the node budget, up to what one request can spend, so past about 11 a row's `depth` says how far it got.",
      },
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
    "The engine's best lines in each position the host names, at each depth the query pinned, as CandidateMove rows carrying the analysis they came from. Pages when there are more new positions than one dispatch can search.",
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
      depth: {
        maxItems: 17,
        type: "array",
        items: { type: "string", maxLength: 2 },
        description: "The depths the query pinned on askedDepth, 6 to 22. The default depth, 10, when absent.",
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

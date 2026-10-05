/* What the engine says about a position: its best lines, strongest first. */
import type { HandlerSpec } from "@embabel/realm-types";
import { z } from "zod";
import { cursor, fens, rows } from "./position.ts";

/** One of the engine's best lines in a position, as analysePosition returns it. */
export const candidateLine = z.object({
  candidateId: z.string(),
  fen: z.string(),
  rank: z.number(),
  uci: z.string(),
  san: z.string(),
  side: z.string(),
  scoreCp: z.number().optional(),
  mate: z.number().optional(),
  whiteCp: z.number().optional(),
  lossCp: z.number().optional(),
  depth: z.number(),
  pvSan: z.string(),
  pvUci: z.string(),
  creates: z.string(),
  removes: z.string(),
  engine: z.string(),
  elapsedMs: z.number(),
});

export const analysePosition = {
  namespace: "chess",
  description:
    "The engine's best lines in each position, strongest first, each with what it changes about the position's imbalances. A position with no legal moves returns nothing: there is nothing to recommend in a checkmate or a stalemate, and the FEN says which.",
  input: z.object({ fens: z.array(z.string()), multiPv: z.number().optional(), depth: z.number().optional() }),
  output: z.array(candidateLine),
} satisfies HandlerSpec;

export const rowsCandidates = {
  namespace: "chess",
  description:
    "The engine's best lines in each position the host names, as CandidateMove rows carrying the analysis they came from. Pages when there are more new positions than one dispatch can search.",
  input: z.strictObject({ fens, cursor: cursor.optional() }),
  output: rows,
} satisfies HandlerSpec;

/** The engine handlers, in the order the realm declares them. */
export const engineHandlers = { analysePosition, rowsCandidates };

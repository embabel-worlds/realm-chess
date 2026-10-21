/* The plans for both sides in a position, which a model decides from the facts the other handlers compute. */
import type { HandlerSpec } from "@embabel/realm-types";
import { z } from "zod";
import { pushed } from "./lichess.ts";
import { cursor, fens, lines, rows } from "./position.ts";

/** One side's plan in a position, as explainPlans returns it. */
export const planRecord = z.object({
  planId: z.string(),
  fen: z.string(),
  side: z.string(),
  priority: z.number(),
  name: z.string(),
  idea: z.string(),
  moves: z.string(),
  imbalances: z.string(),
  engineEvidence: z.string(),
  summary: z.string(),
  structure: z.string(),
  level: z.string(),
  opening: z.string(),
  model: z.string(),
});

/** One side's plan in the position a game line reaches, led by the line, as explainLinePlans returns it. */
export const linePlanRecord = z.object({ line: z.string(), ...planRecord.shape });

const pinnedLevels = () => pushed("The reader's levels the query pinned: beginner, intermediate or expert.");

export const explainPlans = {
  namespace: "chess",
  description:
    "The plans for both sides in each position, decided by a model with the chess-plans skill from the position's imbalances, its opening-book name and the engine's candidate moves. The facts are computed; the judgement is the model's.",
  // The published contract has always left this input open, so it stays a schema that accepts anything.
  input: z.unknown(),
  output: z.array(planRecord),
} satisfies HandlerSpec;

export const explainLinePlans = {
  namespace: "chess",
  description:
    "The plans in the position a game line reaches, told the line's deepest opening name — which a position looked up alone has lost once it is past the book.",
  input: z.unknown(),
  output: z.array(linePlanRecord),
} satisfies HandlerSpec;

export const rowsPositionPlans = {
  namespace: "chess",
  description:
    "The plans for both sides in each position the host names, as Plan rows carrying the analysis they were made from. One position a page.",
  input: z.strictObject({ fens, level: pinnedLevels().optional(), cursor: cursor.optional() }),
  output: rows,
} satisfies HandlerSpec;

export const rowsLinePlans = {
  namespace: "chess",
  description:
    "The plans in the position each game line reaches, told the line's opening name and theory, as Plan rows. One line a page.",
  input: z.strictObject({ lines, level: pinnedLevels().optional(), cursor: cursor.optional() }),
  output: rows,
} satisfies HandlerSpec;

/** The plans handlers, in the order the realm declares them. */
export const plansHandlers = { explainPlans, explainLinePlans, rowsPositionPlans, rowsLinePlans };

/* What opening theory says along a game line, from the Chess Opening Theory wikibook. */
import type { HandlerSpec } from "@embabel/realm-types";
import { z } from "zod";
import { cursor, lines, rows } from "./position.ts";

/** The deepest wikibook page one game line reaches, as theoryOfGameLine returns it. */
export const theoryRecord = z.object({
  line: z.string(),
  title: z.string(),
  url: z.string(),
  pliesCovered: z.number(),
  pliesPast: z.number(),
  theory: z.string(),
  licence: z.string(),
});

export const theoryOfGameLine = {
  namespace: "chess",
  description:
    "What opening theory says along each game line: the deepest page of the Chess Opening Theory wikibook the line reaches.",
  input: z.object({ lines: z.array(z.string()) }),
  output: z.array(theoryRecord),
} satisfies HandlerSpec;

export const rowsTheory = {
  namespace: "chess",
  description:
    "What the Chess Opening Theory wikibook says along each game line the host names, as OpeningTheory rows: the deepest page the line reaches, as an attributed excerpt with its link.",
  input: z.strictObject({ lines, cursor: cursor.optional() }),
  output: rows,
} satisfies HandlerSpec;

/** The theory handlers, in the order the realm declares them. */
export const theoryHandlers = { theoryOfGameLine, rowsTheory };

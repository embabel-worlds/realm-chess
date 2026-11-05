/* What opening theory says along a game line, from the Chess Opening Theory wikibook. */
import type { HandlerSpec } from "@embabel/realm-types";

export const theoryOfGameLine = {
  namespace: "chess",
  description:
    "What opening theory says along each game line: the deepest page of the Chess Opening Theory wikibook the line reaches.",
  input: { type: "object", properties: { lines: { type: "array", items: { type: "string" } } }, required: ["lines"] },
  output: {
    type: "array",
    items: {
      type: "object",
      properties: {
        line: { type: "string" },
        title: { type: "string" },
        url: { type: "string" },
        pliesCovered: { type: "number" },
        pliesPast: { type: "number" },
        theory: { type: "string" },
        licence: { type: "string" },
      },
      required: ["line", "title", "url", "pliesCovered", "pliesPast", "theory", "licence"],
    },
  },
} satisfies HandlerSpec;

export const rowsTheory = {
  namespace: "chess",
  description:
    "What the Chess Opening Theory wikibook says along each game line the host names, as OpeningTheory rows: the deepest page the line reaches, as an attributed excerpt with its link.",
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
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["lines"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

/** The theory handlers, in the order the realm declares them. */
export const theoryHandlers = { theoryOfGameLine, rowsTheory };

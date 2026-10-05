import type { HandlerSpec } from "@embabel/realm-types";

/*
 * The handlers not yet declared in Zod: the status producer, which answers with its rows as a
 * plain list, and the two background jobs the host runs on a schedule.
 */

const keys = (description: string) => ({
  type: "array",
  minItems: 1,
  maxItems: 256,
  items: { type: "string", minLength: 1, maxLength: 2048 },
  description,
});

/* What an unpaged producer's handler answers: every row, as a list. */
const rowList = { type: "array", items: { type: "object" } };

export const producerHandlers = {
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
    output: rowList,
  },
  // Not a producer: the host runs it on its schedule, in the background class, with no arguments.
  deepen: {
    namespace: "chess",
    description:
      "Searches the positions people have looked at again, deeper than a page can wait for, and keeps the answers, which later reads prefer. Runs every minute on its own.",
    schedule: "0 * * * * *",
    input: { type: "object", additionalProperties: false, properties: {} },
    output: {
      type: "object",
      additionalProperties: false,
      properties: { deepened: { type: "integer" }, failed: { type: "integer" }, rounds: { type: "integer" } },
      required: ["deepened", "failed", "rounds"],
    },
  },
  // Not a producer either: half a minute after each deepen tick, it records which positions are done.
  markDeepened: {
    namespace: "chess",
    description:
      "Records which positions the background search has deepened, so the next search skips them until someone looks at them again. Runs every minute on its own.",
    schedule: "30 * * * * *",
    input: { type: "object", additionalProperties: false, properties: {} },
    output: {
      type: "object",
      additionalProperties: false,
      properties: { marked: { type: "integer" } },
      required: ["marked"],
    },
  },
} satisfies Record<string, HandlerSpec>;

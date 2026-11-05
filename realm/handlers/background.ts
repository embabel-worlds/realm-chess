/* What the realm does on its own: the status it last recorded, and the deeper engine searches the host runs on a schedule. */
import type { HandlerSpec } from "@embabel/realm-types";

export const status = {
  namespace: "chess",
  description:
    "What the realm could not do, as the guest last recorded it: whether Lichess and the model answered, the last refusal code and when.",
  input: {
    type: "object",
    properties: {
      username: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The AssistantUser usernames the host is fetching for.",
      },
    },
    required: ["username"],
    additionalProperties: false,
  },
  output: { type: "array", items: { type: "object" } },
} satisfies HandlerSpec;

// Not a producer: the host runs it on its schedule, in the background class, with no arguments.
export const deepen = {
  namespace: "chess",
  description:
    "Searches the positions people have looked at again, deeper than a page can wait for, and keeps the answers, which later reads prefer. Runs every minute on its own.",
  schedule: "0 * * * * *",
  input: { type: "object", properties: {}, additionalProperties: false },
  output: {
    type: "object",
    properties: { deepened: { type: "integer" }, failed: { type: "integer" }, rounds: { type: "integer" } },
    required: ["deepened", "failed", "rounds"],
    additionalProperties: false,
  },
} satisfies HandlerSpec;

// Not a producer either: half a minute after each deepen tick, it records which positions are done.
export const markDeepened = {
  namespace: "chess",
  description:
    "Records which positions the background search has deepened, so the next search skips them until someone looks at them again. Runs every minute on its own.",
  schedule: "30 * * * * *",
  input: { type: "object", properties: {}, additionalProperties: false },
  output: {
    type: "object",
    properties: { marked: { type: "integer" } },
    required: ["marked"],
    additionalProperties: false,
  },
} satisfies HandlerSpec;

/** The background handlers, in the order the realm declares them. */
export const backgroundHandlers = { status, deepen, markDeepened };

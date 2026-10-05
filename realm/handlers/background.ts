/* What the realm does on its own: the status it last recorded, and the deeper engine searches the host runs on a schedule. */
import type { HandlerSpec } from "@embabel/realm-types";
import { z } from "zod";
import { rowList } from "./position.ts";

/**
 * A whole number with no stated range. Zod checks it's an integer at runtime, but on its own it
 * would also publish the safe-integer limits; clearing them keeps the published schema saying only
 * "integer", which is what these counts have always said.
 */
const integer = () => z.int().meta({ minimum: undefined, maximum: undefined });

/** The owners a status producer is fetching for, at most 256 of them. */
const usernames = z
  .array(z.string().min(1).max(2048))
  .min(1)
  .max(256)
  .describe("The AssistantUser usernames the host is fetching for.");

export const status = {
  namespace: "chess",
  description:
    "What the realm could not do, as the guest last recorded it: whether Lichess and the model answered, the last refusal code and when.",
  input: z.strictObject({ username: usernames }),
  output: rowList,
} satisfies HandlerSpec;

// Not a producer: the host runs it on its schedule, in the background class, with no arguments.
export const deepen = {
  namespace: "chess",
  description:
    "Searches the positions people have looked at again, deeper than a page can wait for, and keeps the answers, which later reads prefer. Runs every minute on its own.",
  schedule: "0 * * * * *",
  input: z.strictObject({}),
  output: z.strictObject({ deepened: integer(), failed: integer(), rounds: integer() }),
} satisfies HandlerSpec;

// Not a producer either: half a minute after each deepen tick, it records which positions are done.
export const markDeepened = {
  namespace: "chess",
  description:
    "Records which positions the background search has deepened, so the next search skips them until someone looks at them again. Runs every minute on its own.",
  schedule: "30 * * * * *",
  input: z.strictObject({}),
  output: z.strictObject({ marked: integer() }),
} satisfies HandlerSpec;

/** The background handlers, in the order the realm declares them. */
export const backgroundHandlers = { status, deepen, markDeepened };

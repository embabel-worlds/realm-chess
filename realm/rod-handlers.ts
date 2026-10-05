import type { HandlerSpec } from "@embabel/realm-types";

/* Nothing is left here: every public handler is now declared in Zod under realm/handlers/. */
export const publicHandlers = {} satisfies Record<string, HandlerSpec>;

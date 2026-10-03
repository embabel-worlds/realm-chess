import type { AiCompleteReply, AiCompleteRequest, HandlerContext, ModelRole } from "../generated/realm.ts";

/*
 * The host's model call. A handler asks with `ai_complete` and gets `{ text, truncated }` back,
 * typed by synth for a realm with the model capability. The owner has to grant the realm the
 * model, and each dispatch may make two calls with 64 KiB of prompt and 4096 output tokens
 * between them.
 */

export type { ModelRole };
export const ROLES: readonly ModelRole[] = ["cheap", "workhorse", "best"];

export type ModelRequest = AiCompleteRequest;
export type ModelReply = AiCompleteReply;

/**
 * The refusals a handler can do something about: no grant, a skill the host does not know, or a
 * budget spent. Each of these means no plans this time, said in ChessStatus, never a failed answer.
 */
export const MODEL_REFUSALS = [
  "MODEL_NOT_GRANTED", "MODEL_SKILL_UNKNOWN", "MODEL_DAILY_BUDGET", "MODEL_CALL_BUDGET", "MODEL_PROMPT_TOO_LARGE",
] as const;

export class ModelRefused extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`The model was not asked: ${code}`);
    this.code = code;
  }
}

/** One completion. A coded model refusal is thrown as ModelRefused; anything else as it came. */
export function aiComplete(ctx: Pick<HandlerContext, "call">, request: ModelRequest): ModelReply {
  let reply: unknown;
  try {
    reply = ctx.call("ai_complete", request);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code && (MODEL_REFUSALS as readonly string[]).includes(code)) throw new ModelRefused(code);
    throw e;
  }
  // The host's reply is checked all the same: a type says what it should be, not what arrived.
  const r = reply as Partial<ModelReply> | null;
  if (!r || typeof r.text !== "string" || typeof r.truncated !== "boolean") throw new Error("The model's reply was not { text, truncated }");
  return { text: r.text, truncated: r.truncated };
}

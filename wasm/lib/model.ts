/*
 * The host's model call, typed here until the SDK has a helper for it. A handler asks with
 * `ai_complete` and gets `{ text, truncated }` back. The owner has to grant the realm the model,
 * and each dispatch may make two calls with 64 KiB of prompt and 4096 output tokens between them.
 */

export type ModelRole = "cheap" | "workhorse" | "best";
export const ROLES: readonly ModelRole[] = ["cheap", "workhorse", "best"];

export interface ModelRequest {
  prompt: string;
  role?: ModelRole;
  /** Up to eight skill names: this realm's own, bare or as `chess-<skill>`, or the owner's. */
  skills?: string[];
  maxOutputTokens?: number;
}

export interface ModelReply {
  /** At most 64 KiB; `truncated` says whether the host cut it. */
  text: string;
  truncated: boolean;
}

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

/** The raw host call as the shim hands it to a handler. It answers in place and throws a refusal. */
export type HostCall = (tool: string, args: unknown) => unknown;

/** One completion. A coded model refusal is thrown as ModelRefused; anything else as it came. */
export function aiComplete(call: HostCall, request: ModelRequest): ModelReply {
  let reply: unknown;
  try {
    reply = call("ai_complete", request);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code && (MODEL_REFUSALS as readonly string[]).includes(code)) throw new ModelRefused(code);
    throw e;
  }
  const r = reply as Partial<ModelReply> | null;
  if (!r || typeof r.text !== "string" || typeof r.truncated !== "boolean") throw new Error("The model's reply was not { text, truncated }");
  return { text: r.text, truncated: r.truncated };
}

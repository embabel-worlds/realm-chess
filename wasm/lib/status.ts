import { sqlText } from "./store.ts";
import type { Db, Row } from "./store.ts";

/*
 * What the realm can say about what it could not do. A captured producer returns rows and
 * nothing beside them, so a handler that was refused writes the outcome here, and the
 * ChessStatus producer reads it back.
 *
 * Only a dispatch that published leaves a mark: one that died publishes nothing, so its
 * outcome is never seen here. And a refused API call reaches the guest without its cause, so
 * Lichess is only ever `ok`, `refused` or `unknown`.
 */

export type LichessStatus = "ok" | "refused" | "unknown";
export type ModelStatus = "ok" | "not_granted" | "unknown";

export interface ChessStatus {
  lichess: LichessStatus;
  model: ModelStatus;
  /** The code of the last refusal a handler saw, or empty. */
  lastRefusal: string;
  /** When the last outcome was recorded, ISO 8601, or empty. */
  at: string;
}

export interface Outcome {
  source: "lichess" | "model";
  /** The refusal code, or nothing when the call worked. */
  code?: string;
  at: number;
}

/**
 * Records one outcome. A keyed upsert on the one owner row, so it replays cleanly when another
 * dispatch published first. A model refusal other than MODEL_NOT_GRANTED (a budget, say) says
 * nothing about the grant, so it only moves `lastRefusal`.
 */
export async function recordOutcome(db: Db, o: Outcome): Promise<void> {
  const at = sqlText(new Date(o.at).toISOString());
  const value =
    o.source === "lichess" ? (o.code ? "refused" : "ok")
    : !o.code ? "ok"
    : o.code === "MODEL_NOT_GRANTED" ? "not_granted"
    : null;
  const column = o.source === "lichess" ? "lichess" : "model";
  const sets = [`at = excluded.at`];
  if (value !== null) sets.push(`${column} = excluded.${column}`);
  if (o.code) sets.push(`last_refusal = excluded.last_refusal`);
  const lichess = sqlText(o.source === "lichess" && value ? value : "unknown");
  const model = sqlText(o.source === "model" && value ? value : "unknown");
  await db.exec(
    `INSERT INTO chess_status (owner, lichess, model, last_refusal, at) VALUES ('owner', ${lichess}, ${model}, ` +
      `${sqlText(o.code ?? "")}, ${at}) ON CONFLICT(owner) DO UPDATE SET ${sets.join(", ")}`,
  );
}

const pick = <T extends string>(value: Row[string] | undefined, allowed: readonly T[]): T =>
  (allowed as readonly string[]).includes(String(value)) ? (value as T) : ("unknown" as T);

/** The recorded status, or every field unknown when nothing has been recorded yet. */
export async function readStatus(db: Db): Promise<ChessStatus> {
  const rows = await db.exec(`SELECT lichess, model, last_refusal, at FROM chess_status WHERE owner = 'owner'`);
  const r = rows[0] ?? {};
  return {
    lichess: pick(r.lichess, ["ok", "refused", "unknown"] as const),
    model: pick(r.model, ["ok", "not_granted", "unknown"] as const),
    lastRefusal: r.last_refusal == null ? "" : String(r.last_refusal),
    at: r.at == null ? "" : String(r.at),
  };
}

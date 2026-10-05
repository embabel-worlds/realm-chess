import { waitUntil } from "./clock.ts";
import { LICHESS_SPACING_MS } from "./config.ts";
import { checkedAnswer, isEmptyAnswer, ndjsonAnswer } from "./explorer.ts";
import type { ExplorerAnswer } from "./explorer.ts";
import { recordOutcome } from "./status.ts";
import { num, sqlText } from "./store.ts";
import type { Db } from "./store.ts";

/*
 * Asking the Lichess explorer, through the host's gateway, and keeping what it answers.
 *
 * Every answer is kept under its request: the operation, the position and every parameter sent.
 * A kept answer is reused while it is younger than its operation's time to live. An empty answer
 * is never kept, and neither is a refusal, as the Node realm's producers never cached either: a
 * refused call (an unbound token, a rate limit) would otherwise read as "nothing here" for a month.
 *
 * Lichess wants one request at a time on a token. Requests are spaced 1.1 seconds apart within a
 * dispatch. Across dispatches the lichess_last_request_at row is a best effort, as each dispatch
 * sees it: two dispatches that read the same row at once both ask straight away, a dispatch that
 * dies publishes nothing, and one that loses a publishing race has its writes refused, so the next
 * one may ask early. Nothing on the host holds a slot for the token.
 */

export type ExplorerOperation = "mastersExplorer" | "lichessExplorer" | "playerExplorer";

/** The gateway as a handler sees it: one method per declared operation, each a host call. */
export interface LichessGateway {
  lichess: Record<ExplorerOperation, (args: Record<string, unknown>) => Promise<unknown>>;
}

/** One dispatch's dealings with Lichess: when it last asked, and how the asking went. */
export interface LichessSession {
  db: Db;
  gateway: LichessGateway;
  /** When the last request finished, once known. */
  lastAt?: number;
  /** Whether any request was made, and the code of the last one refused. */
  asked: boolean;
  refused?: string;
}

export const lichessSession = (db: Db, gateway: LichessGateway): LichessSession => ({ db, gateway, asked: false });

const CLOCK_ROW = "lichess_last_request_at";

/** The key an answer is kept under: the operation and every parameter, in a fixed order. */
export function requestKey(op: ExplorerOperation, params: Record<string, unknown>): string {
  const sorted = Object.fromEntries(Object.keys(params).sort().map((k) => [k, params[k]]));
  return `${op} ${JSON.stringify(sorted)}`;
}

/** The kept answer for a request, while it is fresh. */
export async function keptAnswer(db: Db, op: ExplorerOperation, params: Record<string, unknown>, ttlMs: number): Promise<ExplorerAnswer | undefined> {
  const rows = await db.exec(`SELECT response_json, fetched_at FROM explorer WHERE request_key = ${sqlText(requestKey(op, params))}`);
  const r = rows[0];
  if (!r || Date.now() - Date.parse(String(r.fetched_at)) >= ttlMs) return undefined;
  return JSON.parse(String(r.response_json)) as ExplorerAnswer;
}

/** A request the gateway refused. The host says no more than that, so neither can the realm. */
export class LichessRefused extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/*
 * Lichess answers one request at a time per token, and a burst draws HTTP 429, after which it
 * asks for a full minute's quiet. The host passes a refusal on without its status, so the
 * message can only say 429 when the host's text does.
 */
function lichessRefusal(e: unknown): LichessRefused {
  const m = (e as Error)?.message ?? String(e);
  const code = (e as { code?: string })?.code ?? "LICHESS_REFUSED";
  return /\b429\b/.test(m)
    ? new LichessRefused(code, "Lichess is rate-limiting this token (HTTP 429): wait a minute, then ask again.")
    : new LichessRefused(code, m);
}

/**
 * The answer to one explorer request: the kept one while it is fresh, else a new one, spaced
 * from the last request, checked, and kept unless it is empty. A refusal is thrown as
 * LichessRefused and noted on the session; nothing is kept for it. When nothing fresh is kept
 * and `mayFetch` says there is no time to ask, answers undefined without asking.
 */
export async function explorerAnswerFor(
  s: LichessSession, op: ExplorerOperation, params: Record<string, unknown>, ttlMs: number, mayFetch: () => boolean = () => true,
): Promise<ExplorerAnswer | undefined> {
  const kept = await keptAnswer(s.db, op, params, ttlMs);
  if (kept) return kept;
  if (!mayFetch()) return undefined;
  if (s.lastAt === undefined) {
    const rows = await s.db.exec(`SELECT at FROM lichess_clock WHERE name = '${CLOCK_ROW}'`);
    s.lastAt = rows[0] ? num(rows[0].at) : 0;
  }
  waitUntil(s.lastAt + LICHESS_SPACING_MS);
  s.asked = true;
  let reply: unknown;
  try {
    reply = await s.gateway.lichess[op](params);
  } catch (e) {
    const refused = lichessRefusal(e);
    s.refused = refused.code;
    throw refused;
  } finally {
    s.lastAt = Date.now();
    await s.db.exec(
      `INSERT INTO lichess_clock (name, at) VALUES ('${CLOCK_ROW}', ${Math.trunc(s.lastAt)}) ON CONFLICT(name) DO UPDATE SET at = excluded.at`,
    );
  }
  const answer = checkedAnswer(op === "playerExplorer" ? ndjsonAnswer(reply) : reply);
  if (!isEmptyAnswer(answer)) {
    const fen = typeof params.fen === "string" ? params.fen : "";
    await s.db.exec(
      `INSERT OR REPLACE INTO explorer (request_key, operation, fen, filters_json, response_json, fetched_at) VALUES (` +
        `${sqlText(requestKey(op, params))}, ${sqlText(op)}, ${sqlText(fen)}, ${sqlText(JSON.stringify(params))}, ` +
        `${sqlText(JSON.stringify(answer))}, ${sqlText(new Date().toISOString())})`,
    );
  }
  return answer;
}

/** Records how this dispatch's Lichess requests went, if it made any, for ChessStatus. */
export async function recordLichess(s: LichessSession): Promise<void> {
  if (!s.asked) return;
  await recordOutcome(s.db, { source: "lichess", code: s.refused, at: Date.now() });
}

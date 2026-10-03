import type { FakeDb } from "./host";
import { dispatch, type HostCall } from "./runtime";

/*
 * A model of how the host fetches a captured producer: every anchor key in one list, the realm's
 * cursor resent until it answers `next: null`, and the refusals the host raises when a fetch
 * grows past its limits. The numbers and codes are the host's own (the plumbing spike proved them
 * on the host); this model exists to drive the realm's handler through them quickly, with a fake
 * clock standing for the time each step takes.
 */

export const LIMITS = { keys: 256, rows: 1024, bytes: 1024 * 1024, pages: 16, deadlineMs: 30_000 } as const;

export type Refusal = "KEY_BOUND" | "ROW_BOUND" | "RESULT_BYTES" | "PAGE_BOUND" | "HANDLER_FAILED";

export interface Fetch {
  rows: Record<string, unknown>[];
  /** Each page's rows, as returned. */
  pages: Record<string, unknown>[][];
  /** The cursor each page was sent. */
  cursors: (string | undefined)[];
  refused?: Refusal;
  /** The handler's error, when it failed. */
  error?: string;
  dispatches: number;
}

export interface Clock {
  now: number;
}

export async function fetchProducer(o: {
  module: WebAssembly.Module;
  handler: string;
  keyArgument: string;
  keys: string[];
  maxPages?: number;
  db: FakeDb;
  host: HostCall;
  clock: Clock;
  /** Fake time each read of the guest's clock takes. A guest that waits spins on its clock, so a test of waiting needs it to move. */
  tickMs?: number;
  /** Arguments the host adds to every page, such as the values a query pushed down. */
  extra?: Record<string, unknown>;
}): Promise<Fetch> {
  const out: Fetch = { rows: [], pages: [], cursors: [], dispatches: 0 };
  if (o.keys.length > LIMITS.keys) return { ...out, refused: "KEY_BOUND" };
  const maxPages = Math.min(o.maxPages ?? LIMITS.pages, LIMITS.pages);
  let bytes = 0;
  let cursor: string | undefined;
  for (;;) {
    if (out.dispatches === maxPages) return { ...out, refused: "PAGE_BOUND" };
    // Let the test runner breathe between pages: each dispatch blocks while it runs.
    await new Promise((r) => setImmediate(r));
    out.dispatches++;
    out.cursors.push(cursor);
    const started = o.clock.now;
    o.db.begin();
    const d = dispatch(o.module, o.handler, { [o.keyArgument]: o.keys, ...o.extra, ...(cursor === undefined ? {} : { cursor }) }, {
      host: o.host,
      clock: () => (o.clock.now += o.tickMs ?? 0),
    });
    if (d.error !== undefined || o.clock.now - started > LIMITS.deadlineMs) {
      o.db.rollback();
      return { ...out, refused: "HANDLER_FAILED", error: d.error };
    }
    o.db.commit();
    const page = d.result as { rows: Record<string, unknown>[]; next: string | null };
    out.pages.push(page.rows);
    out.rows.push(...page.rows);
    bytes += Buffer.byteLength(JSON.stringify(page.rows));
    if (out.rows.length > LIMITS.rows) return { ...out, refused: "ROW_BOUND" };
    if (bytes > LIMITS.bytes) return { ...out, refused: "RESULT_BYTES" };
    if (page.next === null) return out;
    cursor = page.next;
    // A page's publication and the next dispatch's start take a little time of their own.
    o.clock.now += 150;
  }
}

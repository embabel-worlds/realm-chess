import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import type { FakeDb } from "./host";
import { dispatch, type HostCall } from "./runtime";

/*
 * A model of how the host fetches a captured producer: every anchor key in one list, the realm's
 * cursor resent until it answers `next: null`, and the refusals the host raises when a fetch
 * grows past its limits or an answer has the wrong shape. A producer declared with a page must
 * answer `{ rows, next }` and nothing else; one with no page is dispatched once and must answer
 * a plain list of rows. The declaration is read from producers/, as the host reads it. The numbers and codes are the host's own (the plumbing spike proved them
 * on the host); this model exists to drive the realm's handler through them quickly, with a fake
 * clock standing for the time each step takes.
 */

export const LIMITS = { keys: 256, rows: 1024, bytes: 1024 * 1024, pages: 16, deadlineMs: 30_000 } as const;

export type Refusal = "KEY_BOUND" | "ROW_BOUND" | "RESULT_BYTES" | "PAGE_BOUND" | "HANDLER_FAILED" | "RESULT_NOT_OBJECT" | "PAGE_SHAPE";

export interface ProducerDeclaration {
  name: string;
  handler: string;
  keyArgument: string;
  page?: { argument: string; maxPages: number };
}

/** Every producer the realm declares, as synth wrote them into producers/. */
export function declaredProducers(): ProducerDeclaration[] {
  const dir = resolve(__dirname, "..", "..", "producers");
  return readdirSync(dir).filter((f) => f.endsWith(".yml")).sort().map((f) => parse(readFileSync(join(dir, f), "utf8")) as ProducerDeclaration);
}

function declarationFor(handler: string): ProducerDeclaration {
  const d = declaredProducers().find((p) => p.handler === handler);
  if (!d) throw new Error(`No producer is declared with the handler ${handler}`);
  return d;
}

const isRow = (r: unknown) => typeof r === "object" && r !== null && !Array.isArray(r);

/** Whether a paged answer has exactly the host's page shape. */
export function isPage(result: unknown): result is { rows: Record<string, unknown>[]; next: string | null } {
  if (!isRow(result)) return false;
  const r = result as Record<string, unknown>;
  return Object.keys(r).sort().join(",") === "next,rows" && Array.isArray(r.rows) && r.rows.every(isRow) &&
    (r.next === null || (typeof r.next === "string" && r.next.length > 0));
}

/** Whether an unpaged answer is what the host takes: a plain list of row objects. */
export const isRowList = (result: unknown): result is Record<string, unknown>[] => Array.isArray(result) && result.every(isRow);

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
  /** The producer's declaration, when the handler is not one producers/ declares. */
  declaration?: ProducerDeclaration;
}): Promise<Fetch> {
  const out: Fetch = { rows: [], pages: [], cursors: [], dispatches: 0 };
  if (o.keys.length > LIMITS.keys) return { ...out, refused: "KEY_BOUND" };
  const declared = o.declaration ?? declarationFor(o.handler);
  const paged = declared.page !== undefined;
  if (o.keyArgument !== declared.keyArgument) throw new Error(`${o.handler} takes its keys as ${declared.keyArgument}`);
  const maxPages = paged ? Math.min(o.maxPages ?? declared.page!.maxPages, LIMITS.pages) : 1;
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
    const d = dispatch(o.module, o.handler, { [o.keyArgument]: o.keys, ...o.extra, ...(cursor === undefined ? {} : { [declared.page!.argument]: cursor }) }, {
      host: o.host,
      clock: () => (o.clock.now += o.tickMs ?? 0),
    });
    if (d.error !== undefined || o.clock.now - started > LIMITS.deadlineMs) {
      o.db.rollback();
      return { ...out, refused: "HANDLER_FAILED", error: d.error };
    }
    o.db.commit();
    if (paged ? !isPage(d.result) : !isRowList(d.result)) return { ...out, refused: paged ? "PAGE_SHAPE" : "RESULT_NOT_OBJECT" };
    const page = paged ? (d.result as { rows: Record<string, unknown>[]; next: string | null }) : { rows: d.result as Record<string, unknown>[], next: null };
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

/*
 * What the concern modules share: the handler context, the board check, the key and cursor
 * checks, paging, and the one per-dispatch cache of imbalances. The cache lives here, and only
 * here, so the engine's lines, the deepening tick and the imbalance rows all read the same one.
 */

import type { Handler, HandlerContext } from "../generated/realm.ts";
import { Chess } from "../lib/chess.js";
import { spent } from "../lib/clock.ts";
import { MAX_KEYS, YIELD_AT } from "../lib/config.ts";
import { allWithValues } from "../lib/records.ts";
import type { WithValues } from "../lib/records.ts";
import { timedSync } from "../lib/timing.ts";
import { imbalancesOf } from "../lib/imbalances.ts";
import type { Imbalances } from "../lib/imbalances.ts";

/** What the host passes every handler, as synth typed it from realm.ts. */
export type Ctx = HandlerContext;

/** The position a FEN describes, or an error saying it is not a legal one. */
export function legal(fen: string): Chess {
  try {
    return new Chess(fen.trim());
  } catch (e) {
    throw new Error(`Not a legal position: ${fen} (${(e as Error).message})`);
  }
}

/*
 * Every verb is typed with what synth generated from its declaration, so a result the manifest
 * would refuse (a null where it says a number, a missing field) fails `npm run typecheck`. The
 * rows* adapters declare only "an object" or "a list of objects" to the host, so they are typed
 * by the records of the public handler they serve: one item of its output, plus their own fields.
 */
export type Item<O> = O extends readonly (infer T)[] ? T : never;
export interface Page<R> { rows: R[]; next: string | null }
export type Paged<I, R> = Handler<I, Page<R>>;

export const clamp = (v: number | undefined, dflt: number, lo: number, hi: number) =>
  Math.min(Math.max(Math.trunc(v ?? dflt), lo), hi);

/** The keys a producer was sent: a list of 1 to 256 strings, or a refusal. */
export function keysOf(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_KEYS || value.some((k) => typeof k !== "string")) {
    throw new Error("Invalid producer keys");
  }
  return value as string[];
}

/*
 * A position's imbalances, worked out once a dispatch: the ImbalancesOf row, the candidate lines
 * and the deeper lines all start from them. A dispatch is a fresh instance, so this lives as long
 * as it does. Every module reaches it through imbalancesFor, so there is only ever one.
 */
const imbalancesSeen = new Map<string, Imbalances>();
export function imbalancesFor(fen: string): Imbalances {
  let x = imbalancesSeen.get(fen);
  if (!x) {
    x = timedSync("imbalances", () => imbalancesOf(fen));
    imbalancesSeen.set(fen, x);
  }
  return x;
}

/** What serving one unit of a producer's work came to: its rows, "later" when it did not fit, or "stop". */
export type Served<R> = R[] | "later" | "stop";

/** The index a page starts at: the cursor this realm handed back last time, or the start. */
export function cursorOf(cursor: unknown, count: number): number {
  if (cursor === undefined || cursor === null) return 0;
  if (typeof cursor !== "string" || !/^\d{1,5}$/.test(cursor) || Number(cursor) >= count) throw new Error("Invalid cursor");
  return Number(cursor);
}

/**
 * Serves units from the cursor until one does not fit, handing back the index of the first one
 * owed. Pages are disjoint: each returns rows only for the units it served. The first unit of a
 * page is always served, so the host's resent cursor always moves on. "stop" ends the whole
 * fetch, for a refusal that would only repeat.
 */
export async function paged<U, R extends object>(units: U[], cursor: unknown, serve: (u: U, first: boolean) => Promise<Served<R>>): Promise<Page<WithValues<R>>> {
  const start = cursorOf(cursor, Math.max(units.length, 1));
  const rows: R[] = [];
  for (let i = start; i < units.length; i++) {
    const first = i === start;
    if (!first && spent() >= YIELD_AT) return { rows: allWithValues(rows), next: String(i) };
    const r = await serve(units[i], first);
    if (r === "later") return { rows: allWithValues(rows), next: String(i) };
    if (r === "stop") return { rows: allWithValues(rows), next: null };
    rows.push(...r);
  }
  return { rows: allWithValues(rows), next: null };
}

/** Each FEN trimmed and checked to be a legal position. */
export const fensOf = (keys: string[]) => keys.map((f) => f.trim()).map((f) => (legal(f), f));

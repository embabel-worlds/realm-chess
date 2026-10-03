import { DEADLINE_MS, YIELD_AT } from "./config.ts";

/*
 * Time inside one dispatch. The host starts a fresh instance for every dispatch, so the moment
 * this file is evaluated is when the dispatch began. A dispatch can lose time waiting for its
 * SQLite mount before the handler's first query returns, so every measure starts here and never
 * at the handler's own start.
 */
export const dispatchStarted = Date.now();

export const elapsedMs = (): number => Date.now() - dispatchStarted;

/** The share of the deadline spent so far. */
export const spent = (): number => elapsedMs() / DEADLINE_MS;

/** Whether a step that may take `worstMs` can still finish before the page has to hand back. */
export const fits = (worstMs: number): boolean => elapsedMs() + worstMs <= DEADLINE_MS * YIELD_AT;

/** Waits until the clock reaches `at`. A Javy guest has no timers, so this spins on the clock. */
export function waitUntil(at: number): void {
  while (Date.now() < at) {
    // nothing to do but wait
  }
}

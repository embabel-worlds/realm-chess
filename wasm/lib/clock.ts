import { DEADLINE_MS, YIELD_AT } from "./config.ts";

/*
 * Time inside one dispatch. The host starts a fresh instance for every dispatch, so the moment
 * this file is evaluated is when the dispatch began. A dispatch can lose time waiting for its
 * SQLite mount before the handler's first query returns, so every measure starts here and never
 * at the handler's own start.
 *
 * A host may also hold the guest's clock still for the whole dispatch, so that a replay sees the
 * same time; shinar does. Date.now() then never moves from where it started, and cannot say how
 * much of the deadline is gone. So every costly step also charges what it can cost at worst
 * (charge(), with the calibrations in config.ts), and while the clock has not moved, the time
 * spent is what has been charged. Once the clock moves, it is believed.
 */
export const dispatchStarted = Date.now();

let charged = 0;

/** Adds what one step can cost at worst to the time this dispatch has spent. */
export const charge = (worstMs: number): void => {
  charged += worstMs;
};

export const elapsedMs = (): number => {
  const measured = Date.now() - dispatchStarted;
  return measured > 0 ? measured : charged;
};

/** The share of the deadline spent so far. */
export const spent = (): number => elapsedMs() / DEADLINE_MS;

/** Whether a step that may take `worstMs` can still finish before the page has to hand back. */
export const fits = (worstMs: number): boolean => elapsedMs() + worstMs <= DEADLINE_MS * YIELD_AT;

/*
 * How many times a wait reads a clock that has not moved since the dispatch began before it
 * decides the clock is held still: a few milliseconds where the clock runs, a fraction of a
 * second under an interpreter.
 */
const STILL_READS = 2_000;

/**
 * Waits until the clock reaches `at` and answers true. A Javy guest has no timers, so this spins
 * on the clock. On a clock that is held still no wait can end, so it answers false instead,
 * having waited for nothing.
 */
export function waitUntil(at: number): boolean {
  for (let reads = 0; Date.now() < at; reads++) {
    if (reads >= STILL_READS && Date.now() === dispatchStarted) return false;
  }
  return true;
}

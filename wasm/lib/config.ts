/*
 * The numbers the realm runs by, in one place. realm.ts reads the engine's identity from here
 * too, so the dependency it declares and the configuration the handlers key their analyses on
 * cannot drift apart.
 */

/** The stockfish registry module: Stockfish 19 lite, single thread, SIMD, no imports. */
export const ENGINE_MODULE = {
  module: "stockfish",
  version: "19.0.0",
  sha256: "de1517a78b37ea79925b78124a6afb4e8eb20afa3695523131548883fddaed0a",
} as const;

/*
 * How long the engine searches. A chess engine without a clock is timed by the nodes it may
 * visit: the same position with the same budget gives the same lines every time, and the wall
 * time follows the budget. 3,500,000 nodes is about three seconds on the SIMD module under a
 * native Wasm runtime, enough for depth 18 on the start position and the three middlegames the
 * engine was calibrated on. A slower runtime reaches less depth in the same budget's time or
 * takes longer; every row reports the depth and nodes it reached.
 */
export const FULL_NODES = 3_500_000;

/** The search stops at this depth even with budget left, as `go depth 18` did in the Node realm. */
export const DEPTH_CAP = 18;

/** Lines per position. */
export const MULTI_PV = 5;

/** The host's dispatch deadline. */
export const DEADLINE_MS = 30_000;

/** A page starts a new search only while it has spent less than this share of the deadline. */
export const SEARCH_UNTIL = 0.6;

/** Past this share of the deadline a page stops and hands back a cursor, whatever is left. */
export const YIELD_AT = 0.9;

/** Kept analyses are searched again after seven days, as the Node realm's cache kept them. */
export const ANALYSIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The most keys the host sends a producer at once. */
export const MAX_KEYS = 256;

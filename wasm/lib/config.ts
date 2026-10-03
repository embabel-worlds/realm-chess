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

/*
 * The worst case of each step a handler may take, for the yield rule: a step starts only when
 * it can finish inside the page (see clock.ts). These are the host's own bounds where it has one.
 */

/** A `full` search, calibrated above. */
export const SEARCH_MS = 3_000;

/** One API call: the host's transport gives up after 10 seconds. */
export const API_CALL_MS = 10_000;

/** Lichess asks for one request at a time on a token; the Node realm spaced them 1.1 s apart. */
export const LICHESS_SPACING_MS = 1_100;

/** One model call. The host bounds it only by the dispatch deadline, so this is the measured worst case. */
export const MODEL_CALL_MS = 6_000;

/** Output tokens asked for on each model call. Two calls fit the host's 4096 per dispatch. */
export const MODEL_OUTPUT_TOKENS = 2_048;

const DAY_MS = 24 * 60 * 60 * 1000;

/* How long kept answers stay fresh, as the Node realm's producers cached them. */
export const MASTERS_TTL_MS = 30 * DAY_MS;
export const RATED_TTL_MS = 30 * DAY_MS;
export const PLAYER_TTL_MS = DAY_MS;
export const THEORY_TTL_MS = 7 * DAY_MS;
export const PLANS_TTL_MS = 7 * DAY_MS;

/*
 * Deepening in the background. A position someone looked at is queued, and a scheduled tick
 * searches it again with more nodes and a higher depth cap than a page can wait for. A tick
 * spends at most DEEPEN_TICK_MS, well short of the 30 s dispatch deadline. Its first round is one
 * search, timed; before every round it checks that the round still fits, by the calibration for
 * the first and by measurement after. With the engine's batch call the later rounds are
 * DEEPEN_WIDTH searches side by side.
 */
export const DEEP_NODES = 6_000_000;
export const DEEP_DEPTH_CAP = 22;
export const DEEPEN_TICK_MS = 12_000;
export const DEEPEN_WIDTH = 2;
/** One deep search on the SIMD module under a native runtime: about 1.2M nodes a second. */
export const DEEP_SEARCH_MS = 5_000;
/** The most queued positions one tick looks at. */
export const DEEPEN_PICK = 32;
/** The queue has this many slots, so it never grows past it (see db/0007-deepen-slots.sql). */
export const DEEPEN_SLOTS = 4096;
/** How far back the marking tick looks for deeper rows to record as done. */
export const MARK_WINDOW_MS = 15 * 60 * 1000;

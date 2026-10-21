/*
 * The numbers the realm runs by, in one place. realm.ts reads the engine's identity from here
 * too, so the dependency it declares and the configuration the handlers key their analyses on
 * cannot drift apart.
 */

/**
 * The engine: Stockfish 19 lite, single thread, no SIMD, no imports. The realm carries the module
 * itself, at modules/<sha256>.wasm, and its source in vendor/stockfish.
 */
export const ENGINE_MODULE = {
  module: "stockfish",
  version: "19.0.0",
  sha256: "b6e43bfbb09335610d64c93e343a2e42b03ebdf80aafa54db42a4dcc1f168056",
} as const;

/*
 * How long the engine searches. A chess engine without a clock is timed by the nodes it may
 * visit: the same position with the same budget gives the same lines every time, and the wall
 * time follows the budget. The budget is set for the slowest host the realm runs on, a JVM that
 * compiles the module itself, where the engine visits 8,500 to 10,000 nodes a second, and as few
 * as 5,500 when the host is busy. There 30,000 nodes take about 3.3 s and reach depth 10 on the start position, 8 to 9 in the
 * middlegames it was calibrated on, and 10 in a king and pawn ending; a faster runtime reaches the
 * same depth sooner. Five lines would cost two plies of depth in the same budget, so there are
 * three. Every row reports the depth and nodes it reached.
 */
export const FULL_NODES = 30_000;

/** The search stops at this depth even with budget left (depth 18). */
export const DEPTH_CAP = 18;

/** Lines per position. */
export const MULTI_PV = 3;

/** The engine's speed on the slowest host, as the worst case a search is charged by (see clock.ts). */
export const ENGINE_NODES_PER_SECOND = 5_000;

/** The host's dispatch deadline. */
export const DEADLINE_MS = 30_000;

/** A page starts a new search only while it has spent less than this share of the deadline. */
export const SEARCH_UNTIL = 0.6;

/** Past this share of the deadline a page stops and hands back a cursor, whatever is left. */
export const YIELD_AT = 0.9;

/** Kept analyses are searched again after seven days. */
export const ANALYSIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The most keys the host sends a producer at once. */
export const MAX_KEYS = 256;

/*
 * The worst case of each step a handler may take, for the yield rule: a step starts only when
 * it can finish inside the page (see clock.ts). These are the host's own bounds where it has one,
 * and otherwise measured where the realm runs slowest: the handlers under an interpreter, where a
 * position's imbalances take about 1.4 s and reading a line about 1 s, and up to twice that on a
 * busy host.
 */

/** A `full` search, calibrated above. */
export const SEARCH_MS = 6_000;

/** One position's imbalances. */
export const IMBALANCES_MS = 2_000;

/** One engine line read: its moves as SAN, the position once its exchanges settle, and what that changes. */
export const LINE_READ_MS = 3_000;

/** A position searched at `full` and its lines read: what a page spends on a position it has no kept lines for. */
export const FULL_POSITION_MS = SEARCH_MS + IMBALANCES_MS + MULTI_PV * LINE_READ_MS;

/** One API call: the host's transport gives up after 10 seconds. */
export const API_CALL_MS = 10_000;

/** Lichess asks for one request at a time on a token; requests are spaced 1.1 s apart. */
export const LICHESS_SPACING_MS = 1_100;

/** One model call. The host bounds it only by the dispatch deadline, so this is the measured worst case. */
export const MODEL_CALL_MS = 6_000;

/** Output tokens asked for on each model call. Two calls fit the host's 4096 per dispatch. */
export const MODEL_OUTPUT_TOKENS = 2_048;

const DAY_MS = 24 * 60 * 60 * 1000;

/* How long kept answers stay fresh. */
export const MASTERS_TTL_MS = 30 * DAY_MS;
export const RATED_TTL_MS = 30 * DAY_MS;
export const PLAYER_TTL_MS = DAY_MS;
export const THEORY_TTL_MS = 7 * DAY_MS;
export const PLANS_TTL_MS = 7 * DAY_MS;

/*
 * Deepening in the background. A position someone looked at is queued, and a scheduled tick
 * searches it again with more nodes and a higher depth cap than a page can wait for: 50,000
 * nodes, about a ply deeper than `full`. A tick spends at most DEEPEN_TICK_MS, short of the
 * 30 s dispatch deadline. Its first round is one position, searched and its lines read; before
 * every round it checks that the round still fits, by the calibration for the first and by
 * measurement after. With the engine's batch call the later rounds are DEEPEN_WIDTH searches side
 * by side.
 */
export const DEEP_NODES = 50_000;
export const DEEP_DEPTH_CAP = 22;
export const DEEPEN_TICK_MS = 24_000;
export const DEEPEN_WIDTH = 2;
/** One deep search on the slowest host, at ENGINE_NODES_PER_SECOND. */
export const DEEP_SEARCH_MS = 10_000;
/** One position deepened: the search and its lines read. */
export const DEEP_POSITION_MS = DEEP_SEARCH_MS + IMBALANCES_MS + MULTI_PV * LINE_READ_MS;
/** The most queued positions one tick looks at. */
export const DEEPEN_PICK = 32;
/** The queue has this many slots, so it never grows past it (see db/0007-deepen-slots.sql). */
export const DEEPEN_SLOTS = 4096;
/** How far back the marking tick looks for deeper rows to record as done. */
export const MARK_WINDOW_MS = 15 * 60 * 1000;

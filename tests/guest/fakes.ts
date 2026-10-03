import { Chess } from "chess.js";
import { analysisIdOf, candidateRecords, configKey, FULL, search } from "../../wasm/lib/engine";
import { imbalancesOf } from "../../wasm/lib/imbalances";
import { keepAnalysis, type Db } from "../../wasm/lib/store";
import type { Analyse, FakeDb } from "./host";
import type { Clock } from "./producer";

/*
 * Fixtures for the engine tests: many distinct legal positions, and engines that answer in the
 * module's JSON shape without searching, each search costing whatever fake time a test says.
 */

/** Distinct positions with legal moves, reached by seeded random play from the start. */
export function positions(count: number, seed = 7): string[] {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const out = new Set<string>();
  while (out.size < count) {
    const c = new Chess();
    for (let ply = 0; ply < 40 && out.size < count; ply++) {
      const moves = c.moves();
      if (moves.length === 0) break;
      c.move(moves[Math.floor(random() * moves.length)]);
      if (ply >= 2 && c.moves().length > 0) out.add(c.fen());
    }
  }
  return [...out];
}

export const FOOLS_MATE = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
export const STALEMATE = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";

/** A random legal playout from `fen` after `first`, as UCI, for a principal variation of `plies`. */
function playout(fen: string, first: string, plies: number): string[] {
  const c = new Chess(fen);
  const pv: string[] = [];
  let m = c.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] });
  pv.push(first);
  for (let i = 1; i < plies; i++) {
    const moves = c.moves({ verbose: true });
    if (moves.length === 0) break;
    m = c.move(moves[(i * 7) % moves.length]);
    pv.push(m.lan);
  }
  return pv;
}

export interface FakeEngine {
  analyse: Analyse;
  /** Every search: the position, its arguments, and the fake time it started. */
  calls: { fen: string; nodes: number; maxDepth: number; multiPv: number; at: number }[];
}

/**
 * An engine whose lines are the first legal moves, scored best first, each costing `ms` of fake
 * time. `variant` shifts the scores, standing for a search that found different lines.
 */
export function fakeEngine(clock: Clock, o: { ms?: number; plies?: number; variant?: () => number } = {}): FakeEngine {
  const calls: FakeEngine["calls"] = [];
  const analyse: Analyse = (fen, nodes, maxDepth, multiPv) => {
    calls.push({ fen, nodes, maxDepth, multiPv, at: clock.now });
    clock.now += o.ms ?? 0;
    const c = new Chess(fen);
    const shift = o.variant?.() ?? 0;
    const lines = c.moves({ verbose: true }).slice(0, multiPv).map((m, i) => ({
      rank: i + 1, san: m.san, uci: m.lan, cp: 40 - 15 * i + shift, mate: null, pv: playout(fen, m.lan, o.plies ?? 8),
    }));
    return JSON.stringify({ depth: maxDepth, nodes, lines });
  };
  return { analyse, calls };
}

/**
 * Keeps analyses for these positions straight into the database, made by the realm's own code
 * under Node, as if earlier reads had searched them. Lets a test about the host's row and byte
 * limits read hundreds of kept positions without searching each one in the guest.
 */
export async function seedKept(db: FakeDb, fens: string[], at: number, o: { plies?: number; bare?: boolean } = {}): Promise<void> {
  const clock = { now: at };
  const engine = fakeEngine(clock, { plies: o.plies });
  const store: Db = { exec: async (sql) => db.exec(sql) };
  const key = configKey(FULL);
  for (const fen of fens) {
    const s = await search({ analyse: async (...a) => engine.analyse(...a) }, fen, FULL);
    const linesJson = JSON.stringify(s.lines);
    await keepAnalysis(store, key, {
      fen, analysisId: analysisIdOf(key, linesJson), depth: s.depth, nodes: s.nodes, linesJson,
      // A bare record carries only the rank, for a test about how many rows there are.
      recordsJson: JSON.stringify(o.bare ? s.lines.map((l) => ({ fen, rank: l.rank })) : candidateRecords(fen, s, imbalancesOf(fen), 0)),
      elapsedMs: 0, createdAt: at,
    });
  }
}

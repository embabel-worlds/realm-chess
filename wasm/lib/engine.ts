import { DEEP_DEPTH_CAP, DEEP_NODES, DEPTH_CAP, ENGINE_MODULE, FULL_NODES, MULTI_PV } from "./config.ts";
import type { Imbalances } from "./imbalances.ts";
import { readLine } from "./lines.ts";
import { sha256Hex } from "./sha256.ts";

/*
 * The engine is the stockfish registry module, mounted by the host as the `engine` dependency.
 * `analyse` takes a FEN, a node budget, a depth cap and the number of lines, and answers JSON:
 * the depth it finished, the nodes it searched and the lines, best first. Its own field names
 * (`cp`, `pv`) stay in here; what leaves is the public candidate record.
 */

export interface Engine {
  analyse: {
    (fen: string, nodes: number, maxDepth: number, multiPv: number): Promise<string>;
    /** Many searches at once, one answer per entry in order. A host without it leaves it out. */
    batch?(calls: readonly (readonly [string, number, number, number])[]): Promise<string[]>;
  };
}

export interface EngineLine {
  rank: number;
  san: string;
  uci: string;
  cp: number | null;
  mate: number | null;
  pv: string[];
}

export interface Search {
  depth: number;
  nodes: number;
  lines: EngineLine[];
}

export interface SearchConfig {
  nodes: number;
  depthCap: number;
  multiPv: number;
}

/** The one search the graph's candidate lines use. */
export const FULL: SearchConfig = { nodes: FULL_NODES, depthCap: DEPTH_CAP, multiPv: MULTI_PV };

/** The background tick's search: the same lines, with more nodes and a higher depth cap. */
export const DEEP: SearchConfig = { nodes: DEEP_NODES, depthCap: DEEP_DEPTH_CAP, multiPv: MULTI_PV };

export const ENGINE_NAME = "Stockfish 19 lite (single-threaded WebAssembly)";

/** What an analysis is looked up by: the engine module and how it was asked to search. */
export const configKey = (c: SearchConfig): string =>
  `stockfish ${ENGINE_MODULE.version} ${ENGINE_MODULE.sha256} nodes=${c.nodes} depth=${c.depthCap} multipv=${c.multiPv}`;

/**
 * What an analysis is: its configuration and the lines it found. The search is deterministic,
 * so a search repeated after its rows expire that finds the same lines has the same id, and
 * anything made from those lines still describes them.
 */
export const analysisIdOf = (key: string, linesJson: string): string => sha256Hex(`${key}\n${linesJson}`);

/** One search through the module. A refusal from the module is an error, never empty lines. */
export async function search(engine: Engine, fen: string, c: SearchConfig): Promise<Search> {
  return answerOf(fen, await engine.analyse(fen, c.nodes, c.depthCap, c.multiPv));
}

/** Whether the host offers the engine's batch call. */
export const canBatch = (engine: Engine): boolean => typeof engine.analyse.batch === "function";

/**
 * Several searches under one configuration, answered in order, each a search or the error that
 * stopped it. One batch call when the host offers it, which runs them side by side where it has
 * cores; one call after another when it does not. A refused batch call throws.
 */
export async function searchAll(engine: Engine, fens: string[], c: SearchConfig): Promise<(Search | Error)[]> {
  const settle = (fen: string, text: string) => {
    try {
      return answerOf(fen, text);
    } catch (e) {
      return e as Error;
    }
  };
  const batch = engine.analyse.batch;
  if (typeof batch === "function") {
    const texts = await batch.call(engine.analyse, fens.map((fen) => [fen, c.nodes, c.depthCap, c.multiPv] as const));
    if (!Array.isArray(texts) || texts.length !== fens.length) throw new Error("The engine's batch answered the wrong number of searches");
    return fens.map((fen, i) => settle(fen, texts[i]));
  }
  const out: (Search | Error)[] = [];
  for (const fen of fens) {
    try {
      out.push(settle(fen, await engine.analyse(fen, c.nodes, c.depthCap, c.multiPv)));
    } catch (e) {
      out.push(e as Error);
    }
  }
  return out;
}

function answerOf(fen: string, text: string): Search {
  const answer = JSON.parse(text) as Partial<Search> & { error?: string };
  if (answer.error) throw new Error(`The engine refused ${fen}: ${answer.error}`);
  if (!Array.isArray(answer.lines)) throw new Error(`The engine answered without lines for ${fen}`);
  return { depth: Number(answer.depth), nodes: Number(answer.nodes), lines: answer.lines };
}

export interface CandidateLineRecord {
  /** The position and the first move, UCI: stable across searches, unlike the rank. */
  candidateId: string;
  fen: string;
  rank: number;
  uci: string;
  san: string;
  side: string;
  /** Centipawns for the side to move. Null when the line is a forced mate. */
  scoreCp: number | null;
  /** Moves to mate, signed for the side to move. Null otherwise. */
  mate: number | null;
  /** Centipawns for White, whoever is to move: what a board display shows. */
  whiteCp: number | null;
  /** How much worse than the best line, in centipawns. 0 for the best line. */
  lossCp: number | null;
  depth: number;
  pvSan: string;
  pvUci: string;
  /** Imbalances the line creates, once its exchanges settle, one sentence each, newline-separated. */
  creates: string;
  /** Imbalances the line removes. */
  removes: string;
  engine: string;
  elapsedMs: number;
}

export function candidateRecords(fen: string, s: Search, before: Imbalances, elapsedMs: number): CandidateLineRecord[] {
  const whiteToMove = before.sideToMove === "white";
  const best = s.lines[0];
  return s.lines.map((l) => {
    const scoreCp = l.mate === null ? l.cp : null;
    const mate = l.mate;
    const r = readLine(fen, l.pv, before);
    return {
      candidateId: `${fen} ${l.pv[0]}`,
      fen,
      rank: l.rank,
      uci: l.pv[0],
      san: r.pvSan[0] ?? l.pv[0],
      side: before.sideToMove,
      scoreCp,
      mate,
      whiteCp: scoreCp === null ? null : whiteToMove ? scoreCp : -scoreCp,
      lossCp: best.mate === null && scoreCp !== null ? (best.cp as number) - scoreCp
        : best.mate !== null && mate !== null && Math.sign(best.mate) === Math.sign(mate) ? 0 : null,
      depth: s.depth,
      pvSan: r.pvSan.join(" "),
      pvUci: l.pv.join(" "),
      creates: r.gained.join("\n"),
      removes: r.lost.join("\n"),
      engine: ENGINE_NAME,
      elapsedMs,
    };
  });
}

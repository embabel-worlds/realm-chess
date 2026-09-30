import type { GenericGatewayContext } from "@embabel/runtime-types";
import { Chess } from "chess.js";
import { search } from "../lib/engine";
import { PLAN_PLIES, readLine } from "../lib/plans";

/*
 * The realm's one verb. Everything else — the views, the app, REST — reaches the engine
 * through it, directly or via the `candidateLines` producer.
 */

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
  plan: string;
  planTags: string;
  kingsidePawnMoves: string;
  centrePawnMoves: string;
  queensidePawnMoves: string;
  pawnBreaks: string;
  castles: string;
  ownKing: string;
  enemyKing: string;
  exchanges: number;
  materialDelta: number;
  queensTraded: boolean;
  pieceMoves: string;
  facts: string;
  engine: string;
  elapsedMs: number;
}

const ENGINE = "Stockfish 19 lite (single-threaded WebAssembly)";

/**
 * The engine's best lines in each position, strongest first, each read for the plan it pursues.
 * A position with no legal moves returns nothing: there is nothing to recommend in a checkmate
 * or a stalemate, and the caller can tell which from the FEN.
 */
export async function analysePosition(
  _ctx: GenericGatewayContext,
  args: { fens: string[]; multiPv?: number; depth?: number },
): Promise<CandidateLineRecord[]> {
  const multiPv = Math.min(Math.max(Math.trunc(args.multiPv ?? 5), 1), 8);
  const depth = Math.min(Math.max(Math.trunc(args.depth ?? 18), 6), 22);
  const out: CandidateLineRecord[] = [];
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    let board: Chess;
    try {
      board = new Chess(fen);
    } catch (e) {
      throw new Error(`Not a legal position: ${fen} (${(e as Error).message})`);
    }
    if (board.moves().length === 0) continue;
    const t = Date.now();
    const { lines } = await search(fen, multiPv, depth);
    const elapsedMs = Date.now() - t;
    const best = lines[0];
    const whiteToMove = board.turn() === "w";
    for (const l of lines) {
      const scoreCp = l.kind === "cp" ? l.value : null;
      const mate = l.kind === "mate" ? l.value : null;
      const s = readLine(fen, l.pv, { cp: scoreCp, mate });
      out.push({
        candidateId: `${fen} ${l.pv[0]}`,
        fen,
        rank: l.multipv,
        uci: l.pv[0],
        san: s.san,
        side: s.side,
        scoreCp,
        mate,
        whiteCp: scoreCp === null ? null : whiteToMove ? scoreCp : -scoreCp,
        lossCp: best.kind === "cp" && scoreCp !== null ? best.value - scoreCp
          : best.kind === "mate" && l.kind === "mate" && Math.sign(best.value) === Math.sign(l.value) ? 0 : null,
        depth: l.depth,
        pvSan: s.pvSan.join(" "),
        pvUci: l.pv.join(" "),
        plan: s.plan,
        planTags: s.tags.join(","),
        kingsidePawnMoves: s.pawnMoves.kingside.join(" "),
        centrePawnMoves: s.pawnMoves.centre.join(" "),
        queensidePawnMoves: s.pawnMoves.queenside.join(" "),
        pawnBreaks: s.pawnBreaks.join(" "),
        castles: s.castles ?? "",
        ownKing: s.ownKing,
        enemyKing: s.enemyKing,
        exchanges: s.exchanges,
        materialDelta: s.materialDelta,
        queensTraded: s.queensTraded,
        pieceMoves: s.pieceMoves.join(" "),
        facts: `${s.facts}; engine: ${ENGINE}, depth ${l.depth}, plan read over ${PLAN_PLIES} plies`,
        engine: ENGINE,
        elapsedMs,
      });
    }
  }
  return out;
}

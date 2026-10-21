import { Chess } from "./chess.js";
import type { Move } from "./chess.js";
import { imbalanceChanges, imbalancesOf } from "./imbalances.ts";
import type { Imbalances } from "./imbalances.ts";

/*
 * What an engine line DOES to the position — never what it is FOR. The plan a line serves is
 * the model's judgement, made with the chess-plans skill; what it is given here is checkable:
 * the moves in notation, and which imbalances the line creates or removes once its exchanges
 * are over. "After Bxc6 dxc6, Black has the bishop pair and doubled c-pawns" is a fact about the
 * Exchange Ruy Lopez; "White plays for the endgame" is a plan, and is not decided here.
 */

/* How far into a line its effect is read: five moves by the side to move, then on through any
 * exchange still in progress. Past that the line is the engine's guess about both sides. */
export const LINE_PLIES = 10;

export interface LineReading {
  pvSan: string[];
  /** The position once the line's first plies are played and its exchanges settle. */
  settledFen: string;
  settledPlies: number;
  gained: string[];
  lost: string[];
}

export function uciToMove(c: Chess, uci: string): Move | null {
  try {
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
  } catch {
    return null;
  }
}

export function readLine(fen: string, pv: string[], before: Imbalances = imbalancesOf(fen)): LineReading {
  const board = new Chess(fen);
  const moves: Move[] = [];
  const fens: string[] = [];
  for (const u of pv) {
    const m = uciToMove(board, u);
    if (!m) break;
    moves.push(m);
    fens.push(board.fen());
  }
  /*
   * A line cut off between a capture and its recapture would report a piece won or lost that is
   * neither, so the reading runs on while the next move is a capture. A line that ENDS on a
   * capture is taken at its word: the engine stopped there.
   */
  let settle = Math.min(LINE_PLIES, moves.length);
  while (settle < moves.length && moves[settle].captured) settle++;
  const settledFen = settle === 0 ? fen : fens[settle - 1];
  const { gained, lost } = imbalanceChanges(before, imbalancesOf(settledFen));
  return { pvSan: moves.map((m) => m.san), settledFen, settledPlies: settle, gained, lost };
}

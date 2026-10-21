import { Board } from "./board.ts";
import type { BoardMove } from "./board.ts";
import { charge } from "./clock.ts";
import { LINE_READ_MS } from "./config.ts";
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

export function uciToMove(c: Board, uci: string): BoardMove | null {
  try {
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
  } catch {
    return null;
  }
}

export function readLine(fen: string, pv: string[], before: Imbalances = imbalancesOf(fen)): LineReading {
  const board = new Board(fen);
  const moves: BoardMove[] = [];
  /*
   * A line cut off between a capture and its recapture would report a piece won or lost that is
   * neither, so the reading runs on while the next move is a capture. A line that ENDS on a
   * capture is taken at its word: the engine stopped there. The settled position is the first one
   * from LINE_PLIES on whose next move takes nothing, so only the positions from there are written
   * out as FEN, and only until a quiet move settles it.
   */
  let settle = -1;
  let settledFen = fen;
  for (const u of pv) {
    const m = uciToMove(board, u);
    if (!m) break;
    if (settle < 0 && moves.length >= LINE_PLIES && !m.captured) settle = moves.length;
    moves.push(m);
    if (settle < 0 && moves.length >= LINE_PLIES) settledFen = board.fen();
  }
  if (settle < 0) {
    settle = moves.length;
    settledFen = settle === 0 ? fen : board.fen();
  }
  // Piece activity is one of the facts a line's changes leave out, so the settled position's mobility is not counted.
  const { gained, lost } = imbalanceChanges(before, imbalancesOf(settledFen, { mobility: false }));
  charge(LINE_READ_MS);
  return { pvSan: moves.map((m) => m.san), settledFen, settledPlies: settle, gained, lost };
}

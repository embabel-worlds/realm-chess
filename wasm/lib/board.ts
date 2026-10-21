/*
 * The board the realm's handlers reason about: FEN in and out, legal moves, SAN both ways, and
 * which pieces attack a square. It is the part of chess.js 1.4.0 the realm uses, ported, and it
 * answers what chess.js answers, move for move and in the same order (tests/board.test.ts holds
 * it to that against chess.js itself).
 *
 * It exists because the handlers run under an interpreter, where every bytecode counts. Three
 * things chess.js does cost a dispatch seconds there and are left out: the 64-bit position hash it
 * keeps for repetition (1,553 BigInt keys built when the module loads, and updated on every move),
 * the scan of all 128 squares behind each attack test, which here walks out from the square
 * instead, and the two FENs and second move list behind every move object it hands out. With no
 * hash there is no repetition count, and nothing here offers one.
 *
 * Ported from chess.js, which carries this notice:
 *
 * Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

export type Color = "w" | "b";
export type PieceSymbol = "p" | "n" | "b" | "r" | "q" | "k";
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export interface Piece {
  type: PieceSymbol;
  color: Color;
}

/** A move as chess.js's verbose move list and move() describe it, without the two FENs. */
export interface BoardMove {
  color: Color;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  /** chess.js's flag letters, in its order: n, c, b, e, p, k, q. */
  flags: string;
  san: string;
  lan: string;
}

/* A move inside the board: squares are 0x88 indices, a8 = 0 and h1 = 119. */
interface Internal {
  color: Color;
  from: number;
  to: number;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: number;
}

interface Undo {
  move: Internal;
  whiteKing: number;
  blackKing: number;
  turn: Color;
  whiteCastling: number;
  blackCastling: number;
  epSquare: number;
  halfMoves: number;
  moveNumber: number;
}

const BOARD_START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BOARD_NONE = -1;
const BOARD_NULL_SAN = "--";

const MV_NORMAL = 1;
const MV_CAPTURE = 2;
const MV_BIG_PAWN = 4;
const MV_EP = 8;
const MV_PROMOTION = 16;
const MV_KSIDE = 32;
const MV_QSIDE = 64;
const MV_NULL = 128;
/* The flag letters, in the order chess.js writes them. */
const MV_LETTERS: [number, string][] = [
  [MV_NORMAL, "n"], [MV_CAPTURE, "c"], [MV_BIG_PAWN, "b"], [MV_EP, "e"], [MV_PROMOTION, "p"], [MV_KSIDE, "k"], [MV_QSIDE, "q"], [MV_NULL, "-"],
];

const PAWN_STEPS: Record<Color, number[]> = { b: [16, 32, 17, 15], w: [-16, -32, -17, -15] };
const PIECE_STEPS: Record<Exclude<PieceSymbol, "p">, number[]> = {
  n: [-18, -33, -31, -14, 18, 33, 31, 14],
  b: [-17, -15, 17, 15],
  r: [-16, 1, 16, -1],
  q: [-17, -16, -15, 1, 17, 16, 15, -1],
  k: [-17, -16, -15, 1, 17, 16, 15, -1],
};
const KNIGHT_STEPS = PIECE_STEPS.n;
const KING_STEPS = PIECE_STEPS.k;
const ALL_RAYS = [-16, 1, 16, -1, -17, -15, 17, 15];
const FEN_PIECES = "prnbqkPRNBQK";
const PROMOTION_ORDER: PieceSymbol[] = ["n", "b", "r", "q"];
const SECOND_RANK_OF: Record<Color, number> = { b: 1, w: 6 };
const ROOK_CORNERS: Record<Color, { square: number; flag: number }[]> = {
  w: [{ square: 112, flag: MV_QSIDE }, { square: 119, flag: MV_KSIDE }],
  b: [{ square: 0, flag: MV_QSIDE }, { square: 7, flag: MV_KSIDE }],
};

const squareName = (i: number): Square => `${"abcdefgh"[i & 15]}${8 - (i >> 4)}` as Square;
const squareIndex = (name: string): number => {
  if (name.length !== 2) return BOARD_NONE;
  const f = name.charCodeAt(0) - 97, r = name.charCodeAt(1) - 49;
  return f >= 0 && f < 8 && r >= 0 && r < 8 ? (7 - r) * 16 + f : BOARD_NONE;
};
const opponent = (c: Color): Color => (c === "w" ? "b" : "w");
const isDigitChar = (c: string) => c >= "0" && c <= "9";

/** chess.js's FEN check, with its messages. */
export function fenProblem(fen: string): string | null {
  const tokens = fen.split(/\s+/);
  if (tokens.length !== 6) return "Invalid FEN: must contain six space-delimited fields";
  const moveNumber = parseInt(tokens[5], 10);
  if (isNaN(moveNumber) || moveNumber <= 0) return "Invalid FEN: move number must be a positive integer";
  const halfMoves = parseInt(tokens[4], 10);
  if (isNaN(halfMoves) || halfMoves < 0) return "Invalid FEN: half move counter number must be a non-negative integer";
  if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) return "Invalid FEN: en-passant square is invalid";
  if (/[^kKqQ-]/.test(tokens[2])) return "Invalid FEN: castling availability is invalid";
  if (!/^(w|b)$/.test(tokens[1])) return "Invalid FEN: side-to-move is invalid";
  const rows = tokens[0].split("/");
  if (rows.length !== 8) return "Invalid FEN: piece data does not contain 8 '/'-delimited rows";
  for (const row of rows) {
    let sum = 0;
    let previousWasNumber = false;
    for (let k = 0; k < row.length; k++) {
      if (isDigitChar(row[k])) {
        if (previousWasNumber) return "Invalid FEN: piece data is invalid (consecutive number)";
        sum += parseInt(row[k], 10);
        previousWasNumber = true;
      } else {
        if (FEN_PIECES.indexOf(row[k]) < 0) return "Invalid FEN: piece data is invalid (invalid piece)";
        sum += 1;
        previousWasNumber = false;
      }
    }
    if (sum !== 8) return "Invalid FEN: piece data is invalid (too many squares in rank)";
  }
  if ((tokens[3][1] === "3" && tokens[1] === "w") || (tokens[3][1] === "6" && tokens[1] === "b")) return "Invalid FEN: illegal en-passant square";
  for (const [colour, letter] of [["white", "K"], ["black", "k"]] as const) {
    const count = tokens[0].split(letter).length - 1;
    if (count === 0) return `Invalid FEN: missing ${colour} king`;
    if (count > 1) return `Invalid FEN: too many ${colour} kings`;
  }
  if (Array.from(rows[0] + rows[7]).some((ch) => ch.toUpperCase() === "P")) return "Invalid FEN: some pawns are on the edge rows";
  return null;
}

function disambiguatorOf(move: Internal, moves: Internal[]): string {
  let ambiguities = 0, sameRank = 0, sameFile = 0;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (move.piece === m.piece && move.from !== m.from && move.to === m.to) {
      ambiguities++;
      if (move.from >> 4 === m.from >> 4) sameRank++;
      if ((move.from & 15) === (m.from & 15)) sameFile++;
    }
  }
  if (ambiguities === 0) return "";
  const name = squareName(move.from);
  return sameRank > 0 && sameFile > 0 ? name : sameFile > 0 ? name[1] : name[0];
}

function pushMove(moves: Internal[], color: Color, from: number, to: number, piece: PieceSymbol, captured?: PieceSymbol, flags = MV_NORMAL) {
  const r = to >> 4;
  if (piece === "p" && (r === 7 || r === 0)) {
    for (const promotion of PROMOTION_ORDER) moves.push({ color, from, to, piece, captured, promotion, flags: flags | MV_PROMOTION });
  } else {
    moves.push({ color, from, to, piece, captured, flags });
  }
}

function pieceTypeOfSan(san: string): PieceSymbol | undefined {
  let t = san.charAt(0);
  if (t >= "a" && t <= "h") return /[a-h]\d.*[a-h]\d/.test(san) ? undefined : "p";
  t = t.toLowerCase();
  return (t === "o" ? "k" : t) as PieceSymbol;
}

const stripSan = (move: string) => move.replace(/=/, "").replace(/[+#]?[?!]*$/, "");

export class Board {
  private squares: (Piece | undefined)[] = new Array(128);
  private side: Color = "w";
  private kings = { w: BOARD_NONE, b: BOARD_NONE };
  private epSquare = BOARD_NONE;
  private halfMoves = 0;
  private fullMove = 1;
  private castling = { w: 0, b: 0 };
  private history: Undo[] = [];

  constructor(fen: string = BOARD_START) {
    this.load(fen);
  }

  /** Loads a FEN, refused with chess.js's message when it is not one; two to five fields are filled out as chess.js does. */
  load(fen: string): void {
    let tokens = fen.split(/\s+/);
    if (tokens.length >= 2 && tokens.length < 6) {
      fen = tokens.concat(["-", "-", "0", "1"].slice(-(6 - tokens.length))).join(" ");
    }
    tokens = fen.split(/\s+/);
    const problem = fenProblem(fen);
    if (problem) throw new Error(problem);
    this.squares = new Array(128);
    this.kings = { w: BOARD_NONE, b: BOARD_NONE };
    this.castling = { w: 0, b: 0 };
    this.history = [];
    let square = 0;
    const placement = tokens[0];
    for (let i = 0; i < placement.length; i++) {
      const ch = placement.charAt(i);
      if (ch === "/") square += 8;
      else if (isDigitChar(ch)) square += parseInt(ch, 10);
      else {
        const color: Color = ch < "a" ? "w" : "b";
        const type = ch.toLowerCase() as PieceSymbol;
        this.squares[square] = { type, color };
        if (type === "k") this.kings[color] = square;
        square++;
      }
    }
    this.side = tokens[1] as Color;
    if (tokens[2].indexOf("K") > -1) this.castling.w |= MV_KSIDE;
    if (tokens[2].indexOf("Q") > -1) this.castling.w |= MV_QSIDE;
    if (tokens[2].indexOf("k") > -1) this.castling.b |= MV_KSIDE;
    if (tokens[2].indexOf("q") > -1) this.castling.b |= MV_QSIDE;
    this.epSquare = tokens[3] === "-" ? BOARD_NONE : squareIndex(tokens[3]);
    this.halfMoves = parseInt(tokens[4], 10);
    this.fullMove = parseInt(tokens[5], 10);
  }

  turn(): Color {
    return this.side;
  }

  moveNumber(): number {
    return this.fullMove;
  }

  get(square: Square): Piece | undefined {
    const i = squareIndex(square);
    return i === BOARD_NONE ? undefined : this.squares[i];
  }

  getCastlingRights(color: Color): { k: boolean; q: boolean } {
    return { k: (this.castling[color] & MV_KSIDE) !== 0, q: (this.castling[color] & MV_QSIDE) !== 0 };
  }

  /** The board from a8 to h1, a row per rank, as chess.js's board() gives it. */
  board(): ({ square: Square; type: PieceSymbol; color: Color } | null)[][] {
    const out: ({ square: Square; type: PieceSymbol; color: Color } | null)[][] = [];
    for (let r = 0; r < 8; r++) {
      const row: ({ square: Square; type: PieceSymbol; color: Color } | null)[] = [];
      for (let f = 0; f < 8; f++) {
        const i = r * 16 + f;
        const p = this.squares[i];
        row.push(p ? { square: squareName(i), type: p.type, color: p.color } : null);
      }
      out.push(row);
    }
    return out;
  }

  /** The FEN, with the en passant square only when an en passant capture is legal, as chess.js writes it. */
  fen(): string {
    let placement = "";
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.squares[r * 16 + f];
        if (!p) {
          empty++;
          continue;
        }
        if (empty > 0) {
          placement += empty;
          empty = 0;
        }
        placement += p.color === "w" ? p.type.toUpperCase() : p.type;
      }
      if (empty > 0) placement += empty;
      if (r < 7) placement += "/";
    }
    let castling = "";
    if (this.castling.w & MV_KSIDE) castling += "K";
    if (this.castling.w & MV_QSIDE) castling += "Q";
    if (this.castling.b & MV_KSIDE) castling += "k";
    if (this.castling.b & MV_QSIDE) castling += "q";
    return [placement, this.side, castling || "-", this.epText(), this.halfMoves, this.fullMove].join(" ");
  }

  private epText(): string {
    if (this.epSquare === BOARD_NONE) return "-";
    const color = this.side;
    const bigPawn = this.epSquare + (color === "w" ? 16 : -16);
    for (const sq of [bigPawn + 1, bigPawn - 1]) {
      if (sq & 0x88) continue;
      const p = this.squares[sq];
      if (p?.color !== color || p.type !== "p") continue;
      this.make({ color, from: sq, to: this.epSquare, piece: "p", captured: "p", flags: MV_EP });
      const legal = !this.kingAttacked(color);
      this.unmake();
      if (legal) return squareName(this.epSquare);
    }
    return "-";
  }

  /** Whether a piece of `color` attacks the square: walked out from the square, never a scan of the board. */
  private attacked(color: Color, sq: number): boolean {
    const b = this.squares;
    let at: number;
    let p: Piece | undefined;
    // A white pawn attacks from 15 or 17 squares further down the board, a black one from as far up.
    const pawnAt = color === "w" ? sq + 15 : sq - 17;
    for (let j = 0; j < 4; j += 2) {
      at = pawnAt + j;
      if (at & 0x88) continue;
      p = b[at];
      if (p !== undefined && p.type === "p" && p.color === color) return true;
    }
    for (let j = 0; j < 8; j++) {
      at = sq + KNIGHT_STEPS[j];
      if (at & 0x88) continue;
      p = b[at];
      if (p !== undefined && p.type === "n" && p.color === color) return true;
    }
    for (let j = 0; j < 8; j++) {
      at = sq + KING_STEPS[j];
      if (at & 0x88) continue;
      p = b[at];
      if (p !== undefined && p.type === "k" && p.color === color) return true;
    }
    for (let j = 0; j < 8; j++) {
      const step = ALL_RAYS[j];
      const straight = j < 4;
      for (at = sq + step; !(at & 0x88); at += step) {
        p = b[at];
        if (p === undefined) continue;
        if (p.color === color && (p.type === "q" || (straight ? p.type === "r" : p.type === "b"))) return true;
        break;
      }
    }
    return false;
  }

  /** Every piece of `color` that attacks the square, from a8 to h1, as chess.js lists them. */
  private attackerIndices(color: Color, sq: number): number[] {
    const b = this.squares;
    const out: number[] = [];
    let at: number;
    let p: Piece | undefined;
    const pawnAt = color === "w" ? sq + 15 : sq - 17;
    for (let j = 0; j < 4; j += 2) {
      at = pawnAt + j;
      if (at & 0x88) continue;
      p = b[at];
      if (p !== undefined && p.type === "p" && p.color === color) out.push(at);
    }
    for (let j = 0; j < 8; j++) {
      at = sq + KNIGHT_STEPS[j];
      if (at & 0x88) continue;
      p = b[at];
      if (p !== undefined && p.type === "n" && p.color === color) out.push(at);
    }
    for (let j = 0; j < 8; j++) {
      at = sq + KING_STEPS[j];
      if (at & 0x88) continue;
      p = b[at];
      if (p !== undefined && p.type === "k" && p.color === color) out.push(at);
    }
    for (let j = 0; j < 8; j++) {
      const step = ALL_RAYS[j];
      const straight = j < 4;
      for (at = sq + step; !(at & 0x88); at += step) {
        p = b[at];
        if (p === undefined) continue;
        if (p.color === color && (p.type === "q" || (straight ? p.type === "r" : p.type === "b"))) out.push(at);
        break;
      }
    }
    return out.sort((x, y) => x - y);
  }

  attackers(square: Square, attackedBy: Color = this.side): Square[] {
    const i = squareIndex(square);
    return i === BOARD_NONE ? [] : this.attackerIndices(attackedBy, i).map(squareName);
  }

  isAttacked(square: Square, attackedBy: Color): boolean {
    const i = squareIndex(square);
    return i !== BOARD_NONE && this.attacked(attackedBy, i);
  }

  private kingAttacked(color: Color): boolean {
    const k = this.kings[color];
    return k !== BOARD_NONE && this.attacked(opponent(color), k);
  }

  inCheck(): boolean {
    return this.kingAttacked(this.side);
  }

  isCheck(): boolean {
    return this.inCheck();
  }

  isCheckmate(): boolean {
    return this.inCheck() && !this.hasLegalMove();
  }

  isStalemate(): boolean {
    return !this.inCheck() && !this.hasLegalMove();
  }

  /** chess.js's move generator: the same moves in the same order, legal ones unless asked otherwise. */
  private generate(legal = true, piece?: PieceSymbol, square?: string): Internal[] {
    const us = this.side, them = opponent(us);
    const b = this.squares;
    const moves: Internal[] = [];
    let first = 0, last = 119, single = false;
    if (square !== undefined) {
      const i = squareIndex(square.toLowerCase());
      if (i === BOARD_NONE) return [];
      first = last = i;
      single = true;
    }
    for (let from = first; from <= last; from++) {
      if (from & 0x88) {
        from += 7;
        continue;
      }
      const here = b[from];
      if (!here || here.color === them) continue;
      const type = here.type;
      if (piece && piece !== type) continue;
      if (type === "p") {
        let to = from + PAWN_STEPS[us][0];
        if (!b[to]) {
          pushMove(moves, us, from, to, "p");
          to = from + PAWN_STEPS[us][1];
          if (SECOND_RANK_OF[us] === from >> 4 && !b[to]) pushMove(moves, us, from, to, "p", undefined, MV_BIG_PAWN);
        }
        for (let j = 2; j < 4; j++) {
          to = from + PAWN_STEPS[us][j];
          if (to & 0x88) continue;
          if (b[to]?.color === them) pushMove(moves, us, from, to, "p", b[to]!.type, MV_CAPTURE);
          else if (to === this.epSquare) pushMove(moves, us, from, to, "p", "p", MV_EP);
        }
      } else {
        const steps = PIECE_STEPS[type];
        for (let j = 0; j < steps.length; j++) {
          const step = steps[j];
          let to = from;
          while (true) {
            to += step;
            if (to & 0x88) break;
            const there = b[to];
            if (!there) pushMove(moves, us, from, to, type);
            else {
              if (there.color === us) break;
              pushMove(moves, us, from, to, type, there.type, MV_CAPTURE);
              break;
            }
            if (type === "n" || type === "k") break;
          }
        }
      }
    }
    if (piece === undefined || piece === "k") {
      const king = this.kings[us];
      if (!single || last === king) {
        if (this.castling[us] & MV_KSIDE) {
          const to = king + 2;
          if (!b[king + 1] && !b[to] && !this.attacked(them, king) && !this.attacked(them, king + 1) && !this.attacked(them, to)) {
            pushMove(moves, us, king, to, "k", undefined, MV_KSIDE);
          }
        }
        if (this.castling[us] & MV_QSIDE) {
          const to = king - 2;
          if (!b[king - 1] && !b[king - 2] && !b[king - 3] && !this.attacked(them, king) && !this.attacked(them, king - 1) && !this.attacked(them, to)) {
            pushMove(moves, us, king, to, "k", undefined, MV_QSIDE);
          }
        }
      }
    }
    if (!legal || this.kings[us] === BOARD_NONE) return moves;
    return this.legalOnly(moves, false);
  }

  /*
   * The legal moves among pseudo-legal ones, in their order; with `firstOnly`, at most the first.
   * Out of check, a move needs trying only when it moves the king, takes en passant, or moves a
   * piece pinned to the king: any other move cannot expose the king, so it is kept untried. A king
   * that is not in check stands on no enemy line, so its square hides no attack on the square it
   * goes to. In check, every move is tried.
   */
  private legalOnly(moves: Internal[], firstOnly: boolean): Internal[] {
    const us = this.side, them = opponent(us);
    const king = this.kings[us];
    const out: Internal[] = [];
    const check = this.attacked(them, king);
    const pinned = check ? [] : this.pinnedTo(king, us);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      let ok: boolean;
      if (!check && m.piece !== "k" && !(m.flags & MV_EP) && pinned.indexOf(m.from) < 0) ok = true;
      else if (!check && m.piece === "k" && m.flags & (MV_KSIDE | MV_QSIDE)) ok = true;
      else if (!check && m.piece === "k") ok = !this.attacked(them, m.to);
      else {
        this.make(m);
        ok = !this.kingAttacked(us);
        this.unmake();
      }
      if (ok) {
        out.push(m);
        if (firstOnly) return out;
      }
    }
    return out;
  }

  /* The squares of `us`'s pieces that stand alone between its king and an enemy rook, bishop or queen on the same line. */
  private pinnedTo(king: number, us: Color): number[] {
    const b = this.squares;
    const out: number[] = [];
    for (let j = 0; j < 8; j++) {
      const step = ALL_RAYS[j];
      const straight = j < 4;
      let own = BOARD_NONE;
      for (let at = king + step; !(at & 0x88); at += step) {
        const p = b[at];
        if (p === undefined) continue;
        if (p.color === us) {
          if (own !== BOARD_NONE) break;
          own = at;
          continue;
        }
        if (own !== BOARD_NONE && (p.type === "q" || (straight ? p.type === "r" : p.type === "b"))) out.push(own);
        break;
      }
    }
    return out;
  }

  /** Whether the side to move has any legal move, stopping at the first. */
  private hasLegalMove(): boolean {
    const moves = this.generate(false);
    if (this.kings[this.side] === BOARD_NONE) return moves.length > 0;
    return this.legalOnly(moves, true).length > 0;
  }

  private make(move: Internal): void {
    const us = this.side, them = opponent(us);
    const b = this.squares;
    this.history.push({
      move, whiteKing: this.kings.w, blackKing: this.kings.b, turn: us, whiteCastling: this.castling.w, blackCastling: this.castling.b,
      epSquare: this.epSquare, halfMoves: this.halfMoves, moveNumber: this.fullMove,
    });
    if (move.flags & MV_NULL) {
      if (us === "b") this.fullMove++;
      this.halfMoves++;
      this.side = them;
      this.epSquare = BOARD_NONE;
      return;
    }
    b[move.to] = b[move.from];
    b[move.from] = undefined;
    if (move.flags & MV_EP) b[us === "b" ? move.to - 16 : move.to + 16] = undefined;
    if (move.promotion) b[move.to] = { type: move.promotion, color: us };
    if (b[move.to]!.type === "k") {
      this.kings[us] = move.to;
      if (move.flags & MV_KSIDE) {
        b[move.to - 1] = b[move.to + 1];
        b[move.to + 1] = undefined;
      } else if (move.flags & MV_QSIDE) {
        b[move.to + 1] = b[move.to - 2];
        b[move.to - 2] = undefined;
      }
      this.castling[us] = 0;
    }
    if (this.castling[us]) {
      for (const corner of ROOK_CORNERS[us]) {
        if (move.from === corner.square && this.castling[us] & corner.flag) {
          this.castling[us] ^= corner.flag;
          break;
        }
      }
    }
    if (this.castling[them]) {
      for (const corner of ROOK_CORNERS[them]) {
        if (move.to === corner.square && this.castling[them] & corner.flag) {
          this.castling[them] ^= corner.flag;
          break;
        }
      }
    }
    if (move.flags & MV_BIG_PAWN) {
      const left = b[move.to - 1], right = b[move.to + 1];
      const beside = (!((move.to - 1) & 0x88) && left?.type === "p" && left.color === them) ||
        (!((move.to + 1) & 0x88) && right?.type === "p" && right.color === them);
      this.epSquare = beside ? (us === "b" ? move.to - 16 : move.to + 16) : BOARD_NONE;
    } else {
      this.epSquare = BOARD_NONE;
    }
    if (move.piece === "p" || move.flags & (MV_CAPTURE | MV_EP)) this.halfMoves = 0;
    else this.halfMoves++;
    if (us === "b") this.fullMove++;
    this.side = them;
  }

  private unmake(): Internal | null {
    const old = this.history.pop();
    if (old === undefined) return null;
    const move = old.move;
    const b = this.squares;
    this.kings.w = old.whiteKing;
    this.kings.b = old.blackKing;
    this.side = old.turn;
    this.castling.w = old.whiteCastling;
    this.castling.b = old.blackCastling;
    this.epSquare = old.epSquare;
    this.halfMoves = old.halfMoves;
    this.fullMove = old.moveNumber;
    const us = this.side, them = opponent(us);
    if (move.flags & MV_NULL) return move;
    b[move.from] = { type: move.piece, color: us };
    b[move.to] = undefined;
    if (move.captured) {
      if (move.flags & MV_EP) b[us === "b" ? move.to - 16 : move.to + 16] = { type: "p", color: them };
      else b[move.to] = { type: move.captured, color: them };
    }
    if (move.flags & MV_KSIDE) {
      b[move.to + 1] = b[move.to - 1];
      b[move.to - 1] = undefined;
    } else if (move.flags & MV_QSIDE) {
      b[move.to - 2] = b[move.to + 1];
      b[move.to + 1] = undefined;
    }
    return move;
  }

  /** The SAN of a move from this position; `moves` need only hold the moves of the same piece type. */
  private sanOf(move: Internal, moves: Internal[]): string {
    let out = "";
    if (move.flags & MV_KSIDE) out = "O-O";
    else if (move.flags & MV_QSIDE) out = "O-O-O";
    else if (move.flags & MV_NULL) return BOARD_NULL_SAN;
    else {
      if (move.piece !== "p") out += move.piece.toUpperCase() + disambiguatorOf(move, moves);
      if (move.flags & (MV_CAPTURE | MV_EP)) {
        if (move.piece === "p") out += squareName(move.from)[0];
        out += "x";
      }
      out += squareName(move.to);
      if (move.promotion) out += `=${move.promotion.toUpperCase()}`;
    }
    this.make(move);
    if (this.inCheck()) out += this.hasLegalMove() ? "+" : "#";
    this.unmake();
    return out;
  }

  /* The moves that can share a disambiguator with this one: the same piece type's, or none for a pawn or the king. */
  private peersOf(move: Internal): Internal[] {
    return move.piece === "p" || move.piece === "k" ? [] : this.generate(true, move.piece);
  }

  private pretty(move: Internal, san: string): BoardMove {
    let flags = "";
    for (const [bit, letter] of MV_LETTERS) if (bit & move.flags) flags += letter;
    const from = squareName(move.from), to = squareName(move.to);
    const out: BoardMove = { color: move.color, from, to, piece: move.piece, flags, san, lan: from + to };
    if (move.captured) out.captured = move.captured;
    if (move.promotion) {
      out.promotion = move.promotion;
      out.lan += move.promotion;
    }
    return out;
  }

  moves(): string[];
  moves(options: { verbose: true; piece?: PieceSymbol; square?: Square }): BoardMove[];
  moves(options: { verbose?: false; piece?: PieceSymbol; square?: Square }): string[];
  moves(options: { verbose?: boolean; piece?: PieceSymbol; square?: Square } = {}): string[] | BoardMove[] {
    const moves = this.generate(true, options.piece?.toLowerCase() as PieceSymbol | undefined, options.square);
    return options.verbose ? moves.map((m) => this.pretty(m, this.sanOf(m, moves))) : moves.map((m) => this.sanOf(m, moves));
  }

  /** How many legal moves the side to move has: moves().length, without writing any SAN. */
  moveCount(): number {
    return this.generate().length;
  }

  /** The moves that mate at once, as SAN, in move order: what moves() holds that ends in "#". */
  mates(): string[] {
    const moves = this.generate();
    const out: string[] = [];
    for (const m of moves) {
      this.make(m);
      const mate = this.inCheck() && !this.hasLegalMove();
      this.unmake();
      if (mate) out.push(this.sanOf(m, moves));
    }
    return out;
  }

  /** Whether an en passant capture is among the legal moves. */
  hasEnPassant(): boolean {
    return this.epSquare !== BOARD_NONE && this.generate(true, "p").some((m) => (m.flags & MV_EP) !== 0);
  }

  /**
   * Plays a move given as SAN, read as permissively as chess.js reads it (e2e4, e2-e4, Pe2-e4,
   * Nge7, 0-0), or as `{ from, to, promotion }`; refused with chess.js's message when it is not
   * legal here.
   */
  move(move: string | { from: string; to: string; promotion?: string } | null, { strict = false }: { strict?: boolean } = {}): BoardMove {
    let found: Internal | null = null;
    if (typeof move === "string" || move === null) {
      found = this.fromSan(move ?? BOARD_NULL_SAN, strict);
    } else if (typeof move === "object") {
      // Only the moves from the named square can match, and chess.js names squares in lower case only.
      const from = squareIndex(String(move.from)) === BOARD_NONE ? [] : this.generate(true, undefined, move.from);
      for (const m of from) {
        if (move.to === squareName(m.to) && (m.promotion === undefined || move.promotion === m.promotion)) {
          found = m;
          break;
        }
      }
    }
    if (!found) throw new Error(`Invalid move: ${typeof move === "string" ? move : JSON.stringify(move)}`);
    if (this.inCheck() && found.flags & MV_NULL) throw new Error("Null move not allowed when in check");
    const pretty = this.pretty(found, this.sanOf(found, this.peersOf(found)));
    this.make(found);
    return pretty;
  }

  /** Takes back the last move and describes it, or answers null when there is none. */
  undo(): BoardMove | null {
    const move = this.unmake();
    return move ? this.pretty(move, this.sanOf(move, this.peersOf(move))) : null;
  }

  /* chess.js's SAN reader: the strict reading first, then the permissive one. */
  private fromSan(move: string, strict: boolean): Internal | null {
    let clean = stripSan(move);
    if (!strict) {
      if (clean === "0-0") clean = "O-O";
      else if (clean === "0-0-0") clean = "O-O-O";
    }
    if (clean === BOARD_NULL_SAN) return { color: this.side, from: 0, to: 0, piece: "k", flags: MV_NULL };
    let pieceType = pieceTypeOfSan(clean);
    let moves = this.generate(true, pieceType);
    for (const m of moves) if (clean === stripSan(this.sanOf(m, moves))) return m;
    if (strict) return null;
    let piece: string | undefined, from: string | undefined, to: string | undefined, promotion: string | undefined;
    let overlyDisambiguated = false;
    let matches = clean.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);
    if (!matches) matches = clean.match(/([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/);
    if (matches) {
      [, piece, from, to, promotion] = matches;
      if (from.length === 1) overlyDisambiguated = true;
    }
    pieceType = pieceTypeOfSan(clean);
    moves = this.generate(true, (piece ? piece.toLowerCase() : pieceType) as PieceSymbol | undefined);
    if (!to) return null;
    for (const m of moves) {
      if (!from) {
        if (clean === stripSan(this.sanOf(m, moves)).replace("x", "")) return m;
      } else if ((!piece || piece.toLowerCase() === m.piece) && squareIndex(from) === m.from && squareIndex(to) === m.to &&
        (!promotion || promotion.toLowerCase() === m.promotion)) {
        return m;
      } else if (overlyDisambiguated) {
        const name = squareName(m.from);
        if ((!piece || piece.toLowerCase() === m.piece) && squareIndex(to) === m.to && (from === name[0] || from === name[1]) &&
          (!promotion || promotion.toLowerCase() === m.promotion)) {
          return m;
        }
      }
    }
    return null;
  }
}

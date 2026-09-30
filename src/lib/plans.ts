import { Chess, type Move, type Square } from "chess.js";

/*
 * What a line of engine moves is trying to DO, read off the moves themselves.
 *
 * A model asked to explain "g2g4 c8e6 d4e6 f7e6 e1c1 ..." cold will misread it — it cannot see
 * the board. So the checkable half of a plan is decided here, deterministically, from the moves:
 * which pawns advance on which wing, where each king stands, what is exchanged, what material
 * changes hands. The explanation is then written FROM these facts, and a reader can check every
 * one of them against the line.
 *
 * The tag names and the rule behind each are the realm's plan vocabulary, and they are written
 * down a second time, in prose, in skills/chess-plans/SKILL.md. The two must say the same thing:
 * a change to a rule here is a change to that table in the same edit.
 */

/* How far into a line a plan is read: five moves by the side to move. Past that the engine's
 * line is a guess about the opponent as much as a plan of ours. */
export const PLAN_PLIES = 10;

export type Wing = "queenside" | "centre" | "kingside";

export const PLAN_ORDER = [
  "mating-attack",
  "wins-material",
  "passed-pawn",
  "kingside-pawn-storm",
  "queenside-pawn-storm",
  "minority-attack",
  "sacrifice-for-initiative",
  "central-break",
  "central-control",
  "simplification",
  "kingside-expansion",
  "queenside-expansion",
  "king-activity",
  "king-safety",
  "prophylaxis",
  "development",
  "piece-improvement",
  "manoeuvring",
] as const;

export type Plan = (typeof PLAN_ORDER)[number];

export interface PlanSignals {
  side: "white" | "black";
  san: string;
  pvSan: string[];
  plan: Plan;
  tags: Plan[];
  pawnMoves: Record<Wing, string[]>;
  castles: "kingside" | "queenside" | null;
  ownKing: Wing;
  enemyKing: Wing;
  ownCaptures: number;
  ownChecks: number;
  exchanges: number;
  materialDelta: number;
  queensTraded: boolean;
  pawnBreaks: string[];
  pieceMoves: string[];
  facts: string;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function wingOf(square: string): Wing {
  const f = square[0];
  return f <= "c" ? "queenside" : f <= "e" ? "centre" : "kingside";
}

function material(c: Chess, colour: "w" | "b"): number {
  let total = 0;
  for (const row of c.board()) for (const p of row) if (p && p.color === colour) total += VALUE[p.type];
  return total;
}

function kingSquare(c: Chess, colour: "w" | "b"): string {
  for (const row of c.board()) for (const p of row) if (p && p.type === "k" && p.color === colour) return p.square;
  return "e1";
}

function pawnsOnWing(c: Chess, colour: "w" | "b", wing: Wing): number {
  let n = 0;
  for (const row of c.board()) for (const p of row) if (p && p.type === "p" && p.color === colour && wingOf(p.square) === wing) n++;
  return n;
}

function hasQueen(c: Chess, colour: "w" | "b"): boolean {
  return c.board().some((row) => row.some((p) => p?.type === "q" && p.color === colour));
}

/* A pawn move is a BREAK when it captures a pawn, or lands where it attacks one: it is the move
 * that opens the position rather than merely gaining space. */
function isPawnBreak(after: Chess, m: Move): boolean {
  if (m.piece !== "p") return false;
  if (m.captured === "p") return true;
  const file = m.to.charCodeAt(0);
  const rank = Number(m.to[1]) + (m.color === "w" ? 1 : -1);
  if (rank < 1 || rank > 8) return false;
  return [file - 1, file + 1].some((f) => {
    if (f < 97 || f > 104) return false;
    const p = after.get(`${String.fromCharCode(f)}${rank}` as Square);
    return !!p && p.type === "p" && p.color !== m.color;
  });
}

/*
 * A pawn move that covers the square in front of one of our own central pawns: f3 behind e3
 * so that e4 can follow, c4 beside d4 so that d5 is contested. It prepares a break rather
 * than making one.
 */
function coversAdvanceSquare(after: Chess, m: Move): boolean {
  if (m.piece !== "p") return false;
  const dir = m.color === "w" ? 1 : -1;
  const file = m.to.charCodeAt(0);
  const rank = Number(m.to[1]) + dir;
  if (rank < 1 || rank > 8) return false;
  return [file - 1, file + 1].some((f) => {
    if (f < 99 || f > 102) return false; // the square covered must be on c-f
    const covered = `${String.fromCharCode(f)}${rank}` as Square;
    const behind = after.get(`${String.fromCharCode(f)}${rank - dir}` as Square);
    return !after.get(covered) && !!behind && behind.type === "p" && behind.color === m.color;
  });
}

export function uciToMove(c: Chess, uci: string): Move | null {
  try {
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
  } catch {
    return null;
  }
}

function nonPawnMaterial(c: Chess, colour: "w" | "b"): number {
  let total = 0;
  for (const row of c.board()) for (const p of row) if (p && p.color === colour && p.type !== "p") total += VALUE[p.type];
  return total;
}

/* A passed pawn has no enemy pawn ahead of it on its own file or either neighbour. */
function isPassed(c: Chess, square: string, colour: "w" | "b"): boolean {
  const file = square.charCodeAt(0);
  const rank = Number(square[1]);
  for (const row of c.board()) for (const p of row) {
    if (!p || p.type !== "p" || p.color === colour) continue;
    const pf = p.square.charCodeAt(0);
    const pr = Number(p.square[1]);
    if (Math.abs(pf - file) <= 1 && (colour === "w" ? pr > rank : pr < rank)) return false;
  }
  return true;
}

interface Ply {
  move: Move;
  /** Material for the side to move minus the opponent's, after this ply. */
  balance: number;
  /** A copy of the board after this ply, for the checks that need it. */
  after: Chess;
}

/**
 * Reads one engine line. `score` is from the side to move's point of view, as the engine
 * reports it.
 */
export function readLine(fen: string, pv: string[], score: { cp: number | null; mate: number | null }): PlanSignals {
  const start = new Chess(fen);
  const me = start.turn();
  const them = me === "w" ? "b" : "w";
  const startBalance = material(start, me) - material(start, them);
  const queensAtStart = hasQueen(start, "w") && hasQueen(start, "b");
  // A pawn storm needs something to attack WITH. In an endgame the same pawn moves are a
  // majority rolling forward or a passed pawn running, and they are read as that instead.
  const middlegame = hasQueen(start, me) || nonPawnMaterial(start, me) >= 13;

  const board = new Chess(fen);
  const plies: Ply[] = [];
  for (const u of pv) {
    const m = uciToMove(board, u);
    if (!m) break;
    plies.push({ move: m, balance: material(board, me) - material(board, them), after: new Chess(board.fen()) });
  }
  const pvSan = plies.map((p) => p.move.san);

  /*
   * Material is counted once the exchanges settle, not at an arbitrary ply: a line cut off
   * between a capture and its recapture reads as a piece won or lost when it is neither. So the
   * horizon runs on while the next move is a capture. A line that ENDS on a capture is taken at
   * its word — the engine stopped there, and setting its last captures aside would erase a
   * piece really lost.
   */
  let settle = Math.min(PLAN_PLIES, plies.length);
  while (settle < plies.length && plies[settle].move.captured) settle++;
  const materialDelta = (settle === 0 ? startBalance : plies[settle - 1].balance) - startBalance;

  const horizon = plies.slice(0, PLAN_PLIES);
  const endBoard = horizon.length ? horizon[horizon.length - 1].after : start;
  const ownKing = wingOf(kingSquare(endBoard, me));
  const enemyKing = wingOf(kingSquare(endBoard, them));

  const pawnMoves: Record<Wing, string[]> = { queenside: [], centre: [], kingside: [] };
  const pawnBreaks: string[] = [];
  const pieceMoves: string[] = [];
  const kingMoves: string[] = [];
  const passedPushes: string[] = [];
  const developing: string[] = [];
  const supporting: string[] = [];
  let castlesAtOwnMove = 0;
  let castles: PlanSignals["castles"] = null;
  let ownCaptures = 0, ownChecks = 0, exchanges = 0;
  let queensTraded = false;
  const own = horizon.filter((p) => p.move.color === me);
  const firstMove = own[0]?.move ?? null;

  horizon.forEach((p, i) => {
    const m = p.move;
    if (m.captured) exchanges++;
    if (queensAtStart && !(hasQueen(p.after, "w") && hasQueen(p.after, "b"))) queensTraded = true;
    if (m.color !== me) return;
    if (m.captured) ownCaptures++;
    if (m.san.includes("+") || m.san.includes("#")) ownChecks++;
    const ownIndex = own.indexOf(p) + 1;
    if (m.flags.includes("k") || m.flags.includes("q")) {
      castles ??= m.flags.includes("k") ? "kingside" : "queenside";
      castlesAtOwnMove ||= ownIndex;
    }
    else if (m.piece === "k") kingMoves.push(m.san);
    else if (m.piece === "p") {
      pawnMoves[wingOf(m.to)].push(m.san);
      if (isPassed(p.after, m.to, me)) passedPushes.push(m.san);
      // A break opens the position on OUR initiative. Taking a pawn that arrived on the
      // previous ply is answering the opponent's break, not making one.
      const previous = i > 0 ? horizon[i - 1].move : null;
      const answering = !!previous && previous.to === m.to;
      if (!answering && isPawnBreak(p.after, m)) pawnBreaks.push(m.san);
      else if (!m.captured && coversAdvanceSquare(p.after, m)) supporting.push(m.san);
    } else if (!m.captured) {
      pieceMoves.push(m.san);
      if ((m.piece === "n" || m.piece === "b") && m.from[1] === (me === "w" ? "1" : "8")) developing.push(m.san);
    }
  });

  const oppositeWings = ownKing !== enemyKing && ownKing !== "centre" && enemyKing !== "centre";
  const storm = (wing: Wing) => middlegame && enemyKing === wing &&
    (pawnMoves[wing].length >= 2 || (pawnMoves[wing].length >= 1 && oppositeWings));

  const tags: Plan[] = [];
  if (score.mate !== null && score.mate > 0) tags.push("mating-attack");
  if (materialDelta >= 2) tags.push("wins-material");
  if (passedPushes.length > 0) tags.push("passed-pawn");
  if (storm("kingside")) tags.push("kingside-pawn-storm");
  if (storm("queenside")) tags.push("queenside-pawn-storm");
  const minority = middlegame && pawnMoves.queenside.length >= 1 && enemyKing !== "queenside" &&
    pawnsOnWing(start, me, "queenside") < pawnsOnWing(start, them, "queenside") &&
    pawnMoves.queenside.some((s) => /^b/.test(s));
  if (minority) tags.push("minority-attack");
  if (materialDelta <= -2 && score.mate === null) tags.push("sacrifice-for-initiative");
  if (pawnBreaks.some((s) => /^[c-f]/.test(s))) tags.push("central-break");
  if (supporting.length > 0) tags.push("central-control");
  if (queensTraded || exchanges >= 4) tags.push("simplification");
  if (middlegame && pawnMoves.kingside.length >= 2 && !tags.includes("kingside-pawn-storm")) tags.push("kingside-expansion");
  if (middlegame && pawnMoves.queenside.length >= 2 && !tags.includes("queenside-pawn-storm") && !minority) {
    tags.push("queenside-expansion");
  }
  if (!queensAtStart && kingMoves.length >= 2) tags.push("king-activity");
  // Castling counts as the plan only when it comes soon. Every quiet line castles eventually,
  // and tagging all of them with it would put every candidate into one uninformative group.
  if (castles && castlesAtOwnMove <= 2) tags.push("king-safety");
  if (firstMove && queensAtStart && !firstMove.captured && !firstMove.san.includes("+") &&
      ((firstMove.piece === "k" && !firstMove.flags.includes("k") && !firstMove.flags.includes("q")) ||
       (firstMove.piece === "p" && /^[ah]/.test(firstMove.from) &&
        Math.abs(Number(firstMove.to[1]) - Number(firstMove.from[1])) === 1 &&
        !tags.includes("kingside-pawn-storm") && !tags.includes("queenside-pawn-storm")))) {
    tags.push("prophylaxis");
  }
  if (developing.length >= 2 || (firstMove && developing[0] === firstMove.san)) tags.push("development");
  if (pieceMoves.length >= 2) tags.push("piece-improvement");
  if (tags.length === 0) tags.push("manoeuvring");

  const ordered = PLAN_ORDER.filter((p) => tags.includes(p));
  let plan: Plan = ordered[0];
  // Castling as the move itself is the point of the move, even when exchanges follow it —
  // unless the line does something sharper than that (an attack, material, a break).
  const castlesNow = !!firstMove && (firstMove.flags.includes("k") || firstMove.flags.includes("q"));
  if (castlesNow && ["simplification", "kingside-expansion", "queenside-expansion", "piece-improvement", "development"].includes(plan)) {
    plan = "king-safety";
  }

  const side = me === "w" ? "white" : "black";
  const san = pvSan[0] ?? pv[0];
  const evalText = score.mate !== null ? `mate in ${Math.abs(score.mate)}${score.mate < 0 ? " against" : ""}`
    : `${score.cp! >= 0 ? "+" : ""}${(score.cp! / 100).toFixed(2)}`;
  const list = (xs: string[]) => (xs.length ? xs.join(" ") : "none");
  const ordinal = (n: number) => (["first", "second", "third", "fourth", "fifth"][n - 1] ?? `${n}th`);
  const facts = [
    `${side} plays ${san} now (${evalText} for ${side}); every other move below comes later in the line`,
    `plan: ${plan}${ordered.length > 1 ? ` (also ${ordered.filter((t) => t !== plan).join(", ")})` : ""}`,
    `line: ${pvSan.slice(0, PLAN_PLIES).join(" ")}`,
    `${side} pawn moves - queenside: ${list(pawnMoves.queenside)}; centre: ${list(pawnMoves.centre)}; kingside: ${list(pawnMoves.kingside)}`,
    `pawn breaks: ${list(pawnBreaks)}`,
    `castles: ${castles ? `${castles}, as its ${ordinal(castlesAtOwnMove)} move` : "no"}; ${side} king ends on the ${ownKing}, the opponent's on the ${enemyKing}`,
    `captures in the first ${PLAN_PLIES} plies: ${exchanges}${queensTraded ? ", queens traded" : ""}`,
    `material once exchanges settle: ${materialDelta > 0 ? "+" : ""}${materialDelta} for ${side}`,
    `piece moves: ${list(pieceMoves)}`,
  ].join("; ");

  return {
    side, san, pvSan, plan, tags: ordered, pawnMoves, castles, ownKing, enemyKing, ownCaptures, ownChecks,
    exchanges, materialDelta, queensTraded, pawnBreaks, pieceMoves, facts,
  };
}

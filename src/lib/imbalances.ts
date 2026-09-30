import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

/*
 * The imbalances of a position, in Jeremy Silman's sense: the differences between the two
 * sides that a plan exploits or repairs. Material, the minor pieces, pawn structure, space,
 * files, key squares, development and king safety.
 *
 * These are FACTS about the board, computed and checkable — "Black's c-pawns are doubled",
 * "White has an outpost on d5". They are not plans. Deciding which imbalances matter and what
 * to do about them is the model's job, with the chess-plans skill; its judgement is only as
 * good as what it is told, so everything here is stated plainly and nothing is inferred that
 * a player could not verify by looking.
 */

type Side = "white" | "black";
const SIDES: Side[] = ["white", "black"];
const colourOf = (s: Side): Color => (s === "white" ? "w" : "b");
const other = (s: Side): Side => (s === "white" ? "black" : "white");
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const FILES = "abcdefgh";
const PIECE_NAME: Record<PieceSymbol, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

interface Placed { type: PieceSymbol; color: Color; square: Square }

const file = (sq: string) => FILES.indexOf(sq[0]);
const rank = (sq: string) => Number(sq[1]);
const sq = (f: number, r: number) => `${FILES[f]}${r}` as Square;
const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 1 && r <= 8;
/* Ranks counted from each side's own back rank: a white pawn on e4 and a black pawn on e5 are both on their 4th. */
const relRank = (s: Side, r: number) => (s === "white" ? r : 9 - r);
const forward = (s: Side) => (s === "white" ? 1 : -1);
/* a1 is dark: with a 0-based file and a 1-based rank, a light square's sum is even. */
const isLight = (square: string) => (file(square) + rank(square)) % 2 === 0;

export interface SideImbalances {
  material: { pawns: number; knights: number; bishops: number; rooks: number; queens: number; points: number };
  bishopPair: boolean;
  bishops: { square: string; colour: "light" | "dark"; ownPawnsOnColour: number; verdict: "good" | "bad" | "bad but active" | "neither" }[];
  pawns: {
    islands: number;
    doubled: string[];
    isolated: string[];
    backward: string[];
    passed: string[];
    protectedPassed: string[];
    hanging: string[];
    isolatedQueenPawn: boolean;
  };
  majority: { queenside: number; kingside: number };
  space: number;
  outposts: { square: string; occupiedBy: string | null }[];
  halfOpenFiles: string[];
  rooksOnOpenFiles: string[];
  development: { undeveloped: string[]; castled: "kingside" | "queenside" | null; kingInCentre: boolean };
  king: { square: string; wing: "queenside" | "centre" | "kingside"; shield: number; openFilesNear: string[]; attackersNear: number };
  mobility: number | null;
}

export interface Imbalances {
  fen: string;
  sideToMove: Side;
  phase: "opening" | "middlegame" | "endgame";
  white: SideImbalances;
  black: SideImbalances;
  openFiles: string[];
  chains: { side: Side; pawns: string[]; pointsTo: "queenside" | "kingside" }[];
  oppositeSideCastling: boolean;
  oppositeColouredBishops: boolean;
  /** One plain sentence per imbalance, White's then Black's then shared. The model reads these. */
  facts: string[];
}

function pieces(c: Chess): Placed[] {
  const out: Placed[] = [];
  for (const row of c.board()) for (const p of row) if (p) out.push({ type: p.type, color: p.color, square: p.square });
  return out;
}

function pawnsOf(all: Placed[], s: Side): string[] {
  return all.filter((p) => p.type === "p" && p.color === colourOf(s)).map((p) => p.square);
}

/* The squares a pawn of side `s` on `square` attacks. */
function pawnAttacks(s: Side, square: string): string[] {
  const f = file(square), r = rank(square) + forward(s);
  return [f - 1, f + 1].filter((x) => onBoard(x, r)).map((x) => sq(x, r));
}

/* Whether an enemy pawn could EVER attack `square`: one on an adjacent file, still behind it from its own side. */
function enemyPawnCanReach(enemyPawns: string[], enemy: Side, square: string): boolean {
  const f = file(square), r = rank(square);
  return enemyPawns.some((p) => {
    if (Math.abs(file(p) - f) !== 1) return false;
    // A black pawn attacks downward: it can reach a square below it. A white pawn, above it.
    return enemy === "black" ? rank(p) > r : rank(p) < r;
  });
}

function sideImbalances(c: Chess, all: Placed[], s: Side, openFiles: string[]): SideImbalances {
  const me = colourOf(s), them = other(s);
  const mine = all.filter((p) => p.color === me);
  const myPawns = pawnsOf(all, s);
  const theirPawns = pawnsOf(all, them);
  const count = (t: PieceSymbol) => mine.filter((p) => p.type === t).length;
  const material = {
    pawns: count("p"), knights: count("n"), bishops: count("b"), rooks: count("r"), queens: count("q"),
    points: mine.reduce((a, p) => a + VALUE[p.type], 0),
  };

  // A bishop is bad when most of its own pawns stand on its colour, so it bites on its own chain.
  const bishops = mine.filter((p) => p.type === "b").map((b) => {
    const light = isLight(b.square);
    const onColour = myPawns.filter((p) => isLight(p) === light).length;
    // Silman's distinction: a bad bishop that has got out in front of its pawns (Bg5 in the
    // Carlsbad) is "bad but active" — a fine piece today, a poor one in the endgame.
    const bad = onColour / myPawns.length >= 0.6;
    const outside = relRank(s, rank(b.square)) >= 4;
    const verdict: "good" | "bad" | "bad but active" | "neither" = myPawns.length < 3 ? "neither"
      : bad ? (outside ? "bad but active" : "bad") : onColour / myPawns.length <= 0.35 ? "good" : "neither";
    return { square: b.square, colour: light ? ("light" as const) : ("dark" as const), ownPawnsOnColour: onColour, verdict };
  });

  const filesWith = (f: number, pawns: string[]) => pawns.filter((p) => file(p) === f);
  const doubled = [...new Set(myPawns.map(file))].filter((f) => filesWith(f, myPawns).length > 1).map((f) => FILES[f]);
  const isolated = myPawns.filter((p) => filesWith(file(p) - 1, myPawns).length === 0 && filesWith(file(p) + 1, myPawns).length === 0);
  const passed = myPawns.filter((p) => !theirPawns.some((t) =>
    Math.abs(file(t) - file(p)) <= 1 && (s === "white" ? rank(t) > rank(p) : rank(t) < rank(p))));
  const protectedPassed = passed.filter((p) => myPawns.some((q) => pawnAttacks(s, q).includes(p)));
  // Backward: no own pawn beside or behind it on a neighbouring file can ever defend it, and the
  // square in front is covered by an enemy pawn, so it cannot advance to join the others.
  const backward = myPawns.filter((p) => {
    if (isolated.includes(p) || passed.includes(p)) return false;
    const behindOrLevel = myPawns.some((q) => Math.abs(file(q) - file(p)) === 1 && relRank(s, rank(q)) <= relRank(s, rank(p)));
    if (behindOrLevel) return false;
    const stop = rank(p) + forward(s);
    if (!onBoard(file(p), stop)) return false;
    return theirPawns.some((t) => pawnAttacks(them, t).includes(sq(file(p), stop)));
  });
  // Hanging pawns: a central pair abreast (c+d or d+e), advanced off their starting squares, with
  // no pawns of their own on the files either side — strong while they stand, a target once one
  // must advance. Two untouched flank pawns beside an empty file are not hanging pawns.
  const hanging: string[] = [];
  for (const p of myPawns) for (const q of myPawns) {
    if (file(q) !== file(p) + 1 || rank(q) !== rank(p)) continue;
    if (file(p) < 2 || file(q) > 4 || relRank(s, rank(p)) < 3) continue;
    const left = filesWith(file(p) - 1, myPawns).length, right = filesWith(file(q) + 1, myPawns).length;
    if (left === 0 && right === 0 && filesWith(file(p), myPawns).length === 1 && filesWith(file(q), myPawns).length === 1) hanging.push(p, q);
  }
  const occupiedFiles = [...new Set(myPawns.map(file))].sort((a, b) => a - b);
  let islands = 0;
  occupiedFiles.forEach((f, i) => { if (i === 0 || f !== occupiedFiles[i - 1] + 1) islands++; });
  const isolatedQueenPawn = isolated.some((p) => p[0] === "d");

  const majority = {
    queenside: myPawns.filter((p) => file(p) <= 3).length,
    kingside: myPawns.filter((p) => file(p) >= 4).length,
  };

  // Space: squares in the opponent's half that our pawns control, plus how far our pawns have
  // advanced into it. A cramped side has few of either.
  const controlled = new Set<string>();
  for (const p of myPawns) for (const a of pawnAttacks(s, p)) if (relRank(s, rank(a)) >= 5) controlled.add(a);
  const space = controlled.size + myPawns.filter((p) => relRank(s, rank(p)) >= 5).length;

  // Outposts: squares on our 4th-6th ranks, guarded by our own pawn, that no enemy pawn can
  // ever attack — where a knight, once there, cannot be driven off by a pawn.
  const outposts: { square: string; occupiedBy: string | null }[] = [];
  for (let f = 1; f <= 6; f++) for (let rr = 4; rr <= 6; rr++) {
    const r = s === "white" ? rr : 9 - rr;
    const square = sq(f, r);
    const occupant = c.get(square);
    if (occupant?.type === "p") continue;
    const guarded = myPawns.some((p) => pawnAttacks(s, p).includes(square));
    if (!guarded || enemyPawnCanReach(theirPawns, them, square)) continue;
    outposts.push({ square, occupiedBy: occupant && occupant.color === me ? `${PIECE_NAME[occupant.type]}` : null });
  }
  outposts.sort((a, b) => Math.abs(3.5 - file(a.square)) - Math.abs(3.5 - file(b.square)));

  const halfOpenFiles = [...FILES].filter((f, i) => filesWith(i, myPawns).length === 0 && filesWith(i, theirPawns).length > 0);
  const rooksOnOpenFiles = mine.filter((p) => (p.type === "r" || p.type === "q") && openFiles.includes(p.square[0]))
    .map((p) => `${PIECE_NAME[p.type]} ${p.square}`);

  const home = s === "white" ? { n: ["b1", "g1"], b: ["c1", "f1"] } : { n: ["b8", "g8"], b: ["c8", "f8"] };
  const undeveloped = [
    ...home.n.filter((h) => c.get(h as Square)?.type === "n" && c.get(h as Square)?.color === me).map((h) => `N${h}`),
    ...home.b.filter((h) => c.get(h as Square)?.type === "b" && c.get(h as Square)?.color === me).map((h) => `B${h}`),
  ];
  const kingSq = mine.find((p) => p.type === "k")!.square;
  const backRank = s === "white" ? 1 : 8;
  const rights = c.getCastlingRights(me);
  const castled = rank(kingSq) === backRank && !rights.k && !rights.q
    ? (file(kingSq) >= 6 ? "kingside" : file(kingSq) <= 2 ? "queenside" : null) : null;
  const kingInCentre = file(kingSq) >= 3 && file(kingSq) <= 4;
  const kingWing = file(kingSq) <= 2 ? "queenside" : file(kingSq) >= 5 ? "kingside" : "centre";
  const shield = myPawns.filter((p) => Math.abs(file(p) - file(kingSq)) <= 1 &&
    relRank(s, rank(p)) > relRank(s, rank(kingSq)) && relRank(s, rank(p)) <= relRank(s, rank(kingSq)) + 2).length;
  const openFilesNear = [file(kingSq) - 1, file(kingSq), file(kingSq) + 1].filter((f) => f >= 0 && f < 8)
    .map((f) => FILES[f]).filter((f) => openFiles.includes(f) || !myPawns.some((p) => p[0] === f));
  const zone = new Set<string>();
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    const f = file(kingSq) + df, r = rank(kingSq) + dr;
    if (onBoard(f, r)) zone.add(sq(f, r));
  }
  const attackers = new Set<string>();
  for (const z of zone) for (const a of c.attackers(z as Square, colourOf(them))) {
    if (c.get(a)?.type !== "p") attackers.add(a);
  }

  return {
    material, bishopPair: material.bishops >= 2 && new Set(bishops.map((b) => b.colour)).size === 2,
    bishops,
    pawns: { islands, doubled, isolated, backward, passed, protectedPassed, hanging: [...new Set(hanging)], isolatedQueenPawn },
    majority, space, outposts: outposts.slice(0, 4), halfOpenFiles, rooksOnOpenFiles,
    development: { undeveloped, castled, kingInCentre },
    king: { square: kingSq, wing: kingWing, shield, openFilesNear, attackersNear: attackers.size },
    mobility: mobilityOf(c, me),
  };
}

/* Legal moves for a side. For the side not to move, count them with the turn handed over — not
 * possible when that would leave the side to move in check, and then the count is omitted. */
function mobilityOf(c: Chess, colour: Color): number | null {
  if (c.turn() === colour) return c.moves().length;
  const parts = c.fen().split(" ");
  parts[1] = colour;
  parts[3] = "-";
  try {
    const flipped = new Chess(parts.join(" "));
    return flipped.moves().length;
  } catch {
    return null;
  }
}

/*
 * Pawn chains locked in the centre, and the wing each points to. A chain points the way its
 * head faces: White d5/e4 has its head on d5, so it points to the queenside, and that is
 * where White's pawn play belongs (c4-c5); Black's d6/e5 points to the kingside (...f5).
 */
function chainsOf(all: Placed[]): Imbalances["chains"] {
  const out: Imbalances["chains"] = [];
  for (const s of SIDES) {
    const mine = pawnsOf(all, s), theirs = pawnsOf(all, other(s));
    const locked = (p: string) => theirs.includes(sq(file(p), rank(p) + forward(s)));
    for (const head of mine) {
      if (!locked(head) || file(head) < 2 || file(head) > 5) continue;
      for (const base of mine) {
        // Both links blocked: c4 beside d5 in the King's Indian supports the chain but is not
        // locked, and reading it as a chain of its own points the wrong way.
        if (!locked(base)) continue;
        if (Math.abs(file(base) - file(head)) !== 1 || relRank(s, rank(base)) !== relRank(s, rank(head)) - 1) continue;
        if (file(base) < 2 || file(base) > 5) continue;
        if (!(file(head) === 3 || file(head) === 4 || file(base) === 3 || file(base) === 4)) continue;
        out.push({ side: s, pawns: [head, base], pointsTo: file(head) < file(base) ? "queenside" : "kingside" });
      }
    }
  }
  return out;
}


/*
 * Material as a player counts it: straight after 4.Bxc6 nobody calls White three points up,
 * because ...dxc6 is coming. So when the side to move is behind, the exchange on ONE square is
 * played out — least valuable attacker first, each side free to stop — and the balance is read
 * after it. Deliberately no wider search: a capture-only search over the whole board "wins" the
 * e5 pawn after 4...dxc6 with Nxe5, which ...Qd4 refutes; it cannot see a fork, so it must not
 * be asked what a side can win. That is the engine's question.
 */
function exchangeOn(c: Chess, square: string): number {
  const caps = c.moves({ verbose: true }).filter((m) => m.to === square && m.captured)
    .sort((a, b) => VALUE[a.piece] - VALUE[b.piece]);
  if (caps.length === 0) return 0;
  const m = caps[0];
  c.move(m);
  // Taking is optional for each side: never worse than not taking.
  const value = Math.max(0, VALUE[m.captured!] - exchangeOn(c, square));
  c.undo();
  return value;
}

/* The best single-square exchange for the side to move, and where. */
export function recapture(fen: string): { gain: number; square: string | null; san: string | null } {
  const c = new Chess(fen);
  let best = { gain: 0, square: null as string | null, san: null as string | null };
  for (const m of c.moves({ verbose: true }).filter((x) => x.captured)) {
    c.move(m);
    const gain = VALUE[m.captured!] - exchangeOn(c, m.to);
    c.undo();
    if (gain > best.gain) best = { gain, square: m.to, san: m.san };
  }
  return best;
}

/* Mates in one: exact, cheap, and the first thing a beginner must see. `threat` asks it of the side
 * NOT to move, with the move handed over — not asked when the side to move is in check. */
function mateInOne(fen: string, threat: boolean): string[] {
  let c = new Chess(fen);
  if (threat) {
    if (c.inCheck()) return [];
    const parts = fen.split(" ");
    parts[1] = parts[1] === "w" ? "b" : "w";
    parts[3] = "-";
    try { c = new Chess(parts.join(" ")); } catch { return []; }
  }
  return c.moves({ verbose: true }).filter((m) => m.san.endsWith("#")).map((m) => m.san);
}

/* A piece attacked and not defended, or attacked by something cheaper: facts a beginner must see
 * first. Whether taking it actually works is left to the engine. Kings are excluded — check is
 * reported on its own. */
function exposedPieces(c: Chess, colour: Color): string[] {
  const out: string[] = [];
  const enemy: Color = colour === "w" ? "b" : "w";
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== colour || p.type === "k") continue;
    const attackers = c.attackers(p.square, enemy);
    if (attackers.length === 0) continue;
    const defenders = c.attackers(p.square, colour);
    const cheapest = Math.min(...attackers.map((a) => VALUE[c.get(a)!.type] || 100));
    if (defenders.length === 0) out.push(`${PIECE_NAME[p.type]} on ${p.square} is attacked and not defended`);
    else if (p.type !== "p" && cheapest < VALUE[p.type]) {
      const by = attackers.map((a) => c.get(a)!).sort((x, y) => VALUE[x.type] - VALUE[y.type])[0];
      out.push(`${PIECE_NAME[p.type]} on ${p.square} is attacked by a ${PIECE_NAME[by.type]}`);
    }
  }
  return out;
}

export function imbalancesOf(fen: string): Imbalances {
  const c = new Chess(fen);
  const all = pieces(c);
  const openFiles = [...FILES].filter((f) => !all.some((p) => p.type === "p" && p.square[0] === f));
  const white = sideImbalances(c, all, "white", openFiles);
  const black = sideImbalances(c, all, "black", openFiles);
  const chains = chainsOf(all);
  const nonPawn = (s: SideImbalances) => s.material.points - s.material.pawns;
  const fullmove = Number(fen.split(" ")[5] ?? "1");
  const phase = (white.material.queens + black.material.queens === 0 && nonPawn(white) <= 13 && nonPawn(black) <= 13) ||
      nonPawn(white) + nonPawn(black) <= 20 ? "endgame"
    : fullmove <= 12 && white.development.undeveloped.length + black.development.undeveloped.length >= 2 ? "opening"
    : "middlegame";
  const oppositeSideCastling = white.king.wing !== "centre" && black.king.wing !== "centre" && white.king.wing !== black.king.wing;
  const wb = white.bishops, bb = black.bishops;
  const oppositeColouredBishops = wb.length === 1 && bb.length === 1 && wb[0].colour !== bb[0].colour &&
    white.material.knights + black.material.knights === 0;
  const result: Imbalances = {
    fen, sideToMove: c.turn() === "w" ? "white" : "black", phase, white, black, openFiles, chains,
    oppositeSideCastling, oppositeColouredBishops, facts: [],
  };
  result.facts = factsOf(result);
  return result;
}

const Cap = (s: Side) => (s === "white" ? "White" : "Black");

/* Silman's imbalances, by the names a player uses for them — plus where the kings stand in an
 * endgame, which is not an imbalance but is what an endgame is about. */
export const CATEGORIES = [
  "Tactics", "Material", "Minor pieces", "Pawn structure", "Space", "Files", "Key squares",
  "Development", "King safety", "King position", "Piece activity",
] as const;
export type Category = (typeof CATEGORIES)[number];
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function materialFact(w: SideImbalances, b: SideImbalances): string {
  const diff = w.material.points - b.material.points;
  const minors = (s: SideImbalances) => s.material.knights + s.material.bishops;
  const dR = w.material.rooks - b.material.rooks, dM = minors(w) - minors(b), dQ = w.material.queens - b.material.queens;
  const dP = w.material.pawns - b.material.pawns;
  const parts: string[] = [];
  if (dQ !== 0 && dR !== 0 && Math.sign(dQ) !== Math.sign(dR)) parts.push(`${dQ > 0 ? "White" : "Black"} has a queen against ${Math.abs(dR) === 2 ? "two rooks" : "a rook and more"}`);
  else if (dR !== 0 && dM !== 0 && Math.sign(dR) !== Math.sign(dM)) {
    const up = dR > 0 ? "White" : "Black";
    parts.push(Math.abs(dR) === 1 && Math.abs(dM) === 1 ? `${up} is up the exchange (a rook for a minor piece)` : `${up} has rooks against minor pieces`);
  } else if (dM !== 0 && dP !== 0 && Math.sign(dM) !== Math.sign(dP)) {
    parts.push(`${dM > 0 ? "White" : "Black"} has a minor piece for ${Math.abs(dP)} pawn${Math.abs(dP) > 1 ? "s" : ""}`);
  }
  if (parts.length === 0) {
    if (diff === 0) return "the sides are level.";
    return `${diff > 0 ? "White" : "Black"} is ${Math.abs(diff) === 1 ? "a pawn" : `${Math.abs(diff)} points`} up${Math.abs(diff) === 1 ? "" : " (pawn 1, minor piece 3, rook 5, queen 9)"}.`;
  }
  return `${parts.join("; ")} — ${diff === 0 ? "level by points" : `${diff > 0 ? "White" : "Black"} ${Math.abs(diff)} up by points`}.`;
}

function factsOf(x: Imbalances): string[] {
  const out: string[] = [`Phase: ${x.phase}. ${Cap(x.sideToMove)} to move.`];
  // Every imbalance is filed under Silman's name for it, so a reader sees WHICH imbalance a
  // sentence is about — king safety, pawn structure — before what it says.
  const add = (category: Category, sentence: string) => out.push(`${category}: ${sentence}`);
  const mover = x.sideToMove, other_ = mover === "white" ? "black" : "white";
  const c = new Chess(x.fen);
  if (c.inCheck()) add("Tactics", `${Cap(mover)} is in check.`);
  const mates = mateInOne(x.fen, false);
  if (mates.length) add("Tactics", `${Cap(mover)} can mate at once with ${list(mates.slice(0, 3))}.`);
  const threats = mateInOne(x.fen, true);
  if (threats.length) add("Tactics", `${Cap(other_)} threatens mate with ${list(threats.slice(0, 3))}.`);
  for (const s of SIDES) {
    for (const e of exposedPieces(c, colourOf(s))) add("Tactics", `${Cap(s)}'s ${e}.`);
  }
  const moverStatic = x[mover].material.points - x[other_].material.points;
  const r = moverStatic < 0 ? recapture(x.fen) : { gain: 0, square: null, san: null };
  if (r.gain > 0) {
    // An exchange under way: the side to move is behind only until it takes back.
    const after = moverStatic + r.gain;
    const who = after === 0 ? "the sides are level" : after < 0 ? `${Cap(other_)} is ${after === -1 ? "a pawn" : `${-after} points`} up`
      : `${Cap(mover)} is ${after === 1 ? "a pawn" : `${after} points`} up`;
    add("Material", `${who} once ${Cap(mover)} recaptures on ${r.square} — an exchange is under way.`);
  } else {
    add("Material", materialFact(x.white, x.black));
  }
  const w = x.white, b = x.black;
  if (w.bishopPair !== b.bishopPair) add("Minor pieces", `${w.bishopPair ? "White" : "Black"} has the bishop pair.`);
  if (x.oppositeColouredBishops) add("Minor pieces", "Bishops of opposite colours: drawish in an endgame, but the attacker is effectively a piece up in a middlegame.");
  const minorLine = (s: SideImbalances) => `${s.material.bishops} bishop${s.material.bishops === 1 ? "" : "s"} and ${s.material.knights} knight${s.material.knights === 1 ? "" : "s"}`;
  if (w.material.bishops !== b.material.bishops) add("Minor pieces", `White has ${minorLine(w)}, Black ${minorLine(b)}.`);
  for (const s of SIDES) {
    const me = x[s];
    for (const bi of me.bishops) if (bi.verdict !== "neither") {
      add("Minor pieces", `${Cap(s)}'s ${bi.colour}-squared bishop on ${bi.square} is ${bi.verdict}: ${bi.ownPawnsOnColour} of ${me.material.pawns} ${s} pawns stand on its colour.`);
    }
    // With one pawn or none, "isolated" and "islands" describe nothing a plan could use.
    if (me.material.pawns <= 1) {
      if (me.pawns.passed.length) add("Pawn structure", `${Cap(s)} has a passed pawn on ${list(me.pawns.passed)}.`);
      continue;
    }
    if (me.pawns.isolatedQueenPawn) add("Pawn structure", `${Cap(s)} has an isolated queen's pawn (${me.pawns.isolated.find((p) => p[0] === "d")}).`);
    const otherIsolated = me.pawns.isolated.filter((p) => p[0] !== "d");
    if (otherIsolated.length) add("Pawn structure", `${Cap(s)} has isolated pawn${otherIsolated.length > 1 ? "s" : ""} on ${list(otherIsolated)}.`);
    if (me.pawns.doubled.length) add("Pawn structure", `${Cap(s)} has doubled pawns on the ${list(me.pawns.doubled)}-file${me.pawns.doubled.length > 1 ? "s" : ""}.`);
    if (me.pawns.backward.length) add("Pawn structure", `${Cap(s)} has a backward pawn on ${list(me.pawns.backward)}.`);
    if (me.pawns.hanging.length) add("Pawn structure", `${Cap(s)} has hanging pawns on ${list(me.pawns.hanging)}.`);
    if (me.pawns.passed.length) {
      const prot = me.pawns.protectedPassed;
      add("Pawn structure", `${Cap(s)} has a passed pawn on ${list(me.pawns.passed)}${prot.length ? ` (${list(prot)} protected)` : ""}.`);
    }
  }
  if (w.pawns.islands !== b.pawns.islands && w.material.pawns > 1 && b.material.pawns > 1) add("Pawn structure", `pawn islands, White ${w.pawns.islands}, Black ${b.pawns.islands}.`);
  for (const wing of ["queenside", "kingside"] as const) {
    const wc = w.majority[wing], bc = b.majority[wing];
    if (wc !== bc && wc + bc > 0) add("Pawn structure", `${wc > bc ? "White" : "Black"} has a ${wing} pawn majority (${Math.max(wc, bc)} against ${Math.min(wc, bc)}, counting the ${wing === "queenside" ? "a-d" : "e-h"} files).`);
  }
  for (const ch of x.chains) add("Pawn structure", `${Cap(ch.side)}'s pawn chain ${ch.pawns.join("/")} is locked and points to the ${ch.pointsTo}.`);
  if (Math.abs(w.space - b.space) >= 3) add("Space", `${w.space > b.space ? "White" : "Black"} has more space (${Math.max(w.space, b.space)} against ${Math.min(w.space, b.space)} by pawn control of the opponent's half).`);
  if (x.openFiles.length) add("Files", `the ${list(x.openFiles)}-file${x.openFiles.length > 1 ? "s are" : " is"} open.`);
  for (const s of SIDES) {
    const me = x[s];
    if (me.halfOpenFiles.length) add("Files", `the ${list(me.halfOpenFiles)}-file${me.halfOpenFiles.length > 1 ? "s are" : " is"} half-open for ${Cap(s)}.`);
    if (me.rooksOnOpenFiles.length) add("Files", `${Cap(s)} holds an open file with the ${list(me.rooksOnOpenFiles)}.`);
    const occ = me.outposts.filter((o) => o.occupiedBy);
    const free = me.outposts.filter((o) => !o.occupiedBy).map((o) => o.square);
    if (occ.length) add("Key squares", `${Cap(s)}'s ${list(occ.map((o) => `${o.occupiedBy} on ${o.square}`))} stands on an outpost no pawn can challenge.`);
    if (free.length) add("Key squares", `${Cap(s)} has outpost square${free.length > 1 ? "s" : ""} on ${list(free)} (guarded by a pawn, beyond the reach of enemy pawns).`);
  }
  if (x.phase !== "endgame") {
    for (const s of SIDES) {
      const d = x[s].development;
      if (x.phase === "opening" && d.undeveloped.length) add("Development", `${Cap(s)} still has ${list(d.undeveloped)} undeveloped.`);
      if (!d.castled && d.kingInCentre) add("King safety", `${Cap(s)}'s king is still in the centre, on ${x[s].king.square}.`);
    }
    if (x.oppositeSideCastling) add("King safety", `The kings are on opposite wings (White ${w.king.wing}, Black ${b.king.wing}): pawn storms cost the attacker nothing in king safety.`);
    for (const s of SIDES) {
      const k = x[s].king;
      if (k.wing !== "centre" && (k.shield <= 1 || k.openFilesNear.length >= 2 || k.attackersNear >= 3)) {
        add("King safety", `${Cap(s)}'s king on ${k.square} is exposed: ${k.shield} shield pawn${k.shield === 1 ? "" : "s"}, ${k.openFilesNear.length ? `open or half-open ${list(k.openFilesNear)}-file nearby, ` : ""}${k.attackersNear} enemy piece${k.attackersNear === 1 ? "" : "s"} bearing on it.`);
      }
    }
  } else {
    for (const s of SIDES) add("King position", `${Cap(s)}'s king is on ${x[s].king.square}.`);
  }
  if (w.mobility !== null && b.mobility !== null && Math.abs(w.mobility - b.mobility) >= 8) {
    add("Piece activity", `${w.mobility > b.mobility ? "White" : "Black"} has the freer pieces: ${Math.max(w.mobility, b.mobility)} legal moves against ${Math.min(w.mobility, b.mobility)}.`);
  }
  return out;
}

/*
 * Facts that change with nearly every move, and so say nothing about what a line is FOR: whose
 * pieces are freer, what is still undeveloped, where an endgame king happens to stand, and the
 * move count.
 */
const VOLATILE = [/^Phase:/, /^Piece activity:/, /^Development:/, /^King position:/];

/*
 * The identity of a fact, stripped of the detail that moves with the pieces: which square a
 * bishop stands on, which rook holds a file, and the counts in brackets. "Black's light-squared
 * bishop on e6 is good" and "... on d7 is good" are one fact; its turning bad is a change.
 */
function factKey(fact: string): string {
  return fact
    .replace(/(bishop) on [a-h][1-8]/, "$1")
    .replace(/(open file with the) (rook|queen) ([a-h])[1-8]/g, "$1 $3-file")
    .replace(/ \([^)]*\)/g, "")
    .replace(/: \d+ of \d+ .*$/, "")
    .replace(/(king on [a-h][1-8] is exposed).*$/, "$1");
}

/**
 * What a line changes about the imbalances: the facts true after it and not before, and those
 * that stop being true. "Black has the bishop pair" appearing after Bxc6 is the whole point of
 * the Exchange Ruy Lopez, and that is the kind of thing this makes visible. A fact that only
 * moved with its piece — a good bishop that is still a good bishop on another square — is not
 * a change.
 */
export function imbalanceChanges(before: Imbalances, after: Imbalances): { gained: string[]; lost: string[] } {
  const keyed = (xs: string[]) => new Map(xs.filter((f) => !VOLATILE.some((v) => v.test(f))).map((f) => [factKey(f), f]));
  const b = keyed(before.facts), a = keyed(after.facts);
  return {
    gained: [...a].filter(([k]) => !b.has(k)).map(([, f]) => f),
    lost: [...b].filter(([k]) => !a.has(k)).map(([, f]) => f),
  };
}

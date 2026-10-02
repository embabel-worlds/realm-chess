import type { GenericGatewayContext } from "@embabel/runtime-types";
import { Chess } from "chess.js";
import { search, type RawLine } from "../lib/engine";
import { imbalancesOf, type Imbalances } from "../lib/imbalances";
import { readLine } from "../lib/lines";
import { openingOf, openingOfLine, positionAfter, splitLine, structureOf, structureSentence } from "../lib/openings";
import { pageUrl, theoryText, theoryTitles } from "../lib/theory";

/*
 * The realm's verbs. Three compute facts — the engine's lines, the position's imbalances, its
 * name in the opening book — and one asks a model, with the chess-plans skill attached, what
 * plans those facts call for. Every one is also a producer, so each is a Virtual Cypher hop from
 * a Position.
 */

const ENGINE = "Stockfish 19 lite (single-threaded WebAssembly)";

function legal(fen: string): Chess {
  try {
    return new Chess(fen.trim());
  } catch (e) {
    throw new Error(`Not a legal position: ${fen} (${(e as Error).message})`);
  }
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

function candidateRecords(fen: string, lines: RawLine[], before: Imbalances, elapsedMs: number): CandidateLineRecord[] {
  const whiteToMove = before.sideToMove === "white";
  const best = lines[0];
  return lines.map((l) => {
    const scoreCp = l.kind === "cp" ? l.value : null;
    const mate = l.kind === "mate" ? l.value : null;
    const r = readLine(fen, l.pv, before);
    return {
      candidateId: `${fen} ${l.pv[0]}`,
      fen,
      rank: l.multipv,
      uci: l.pv[0],
      san: r.pvSan[0] ?? l.pv[0],
      side: before.sideToMove,
      scoreCp,
      mate,
      whiteCp: scoreCp === null ? null : whiteToMove ? scoreCp : -scoreCp,
      lossCp: best.kind === "cp" && scoreCp !== null ? best.value - scoreCp
        : best.kind === "mate" && l.kind === "mate" && Math.sign(best.value) === Math.sign(l.value) ? 0 : null,
      depth: l.depth,
      pvSan: r.pvSan.join(" "),
      pvUci: l.pv.join(" "),
      creates: r.gained.join("\n"),
      removes: r.lost.join("\n"),
      engine: ENGINE,
      elapsedMs,
    };
  });
}

async function linesFor(fen: string, multiPv: number, depth: number) {
  const t = Date.now();
  const { lines } = await search(fen, multiPv, depth);
  return { lines, elapsedMs: Date.now() - t };
}

const clamp = (v: number | undefined, dflt: number, lo: number, hi: number) =>
  Math.min(Math.max(Math.trunc(v ?? dflt), lo), hi);

/**
 * The engine's best lines in each position, strongest first, each with what it changes about
 * the position's imbalances. A position with no legal moves returns nothing: there is nothing
 * to recommend in a checkmate or a stalemate, and the FEN says which.
 */
export async function analysePosition(
  _ctx: GenericGatewayContext,
  args: { fens: string[]; multiPv?: number; depth?: number },
): Promise<CandidateLineRecord[]> {
  const multiPv = clamp(args.multiPv, 5, 1, 8);
  const depth = clamp(args.depth, 18, 6, 22);
  const out: CandidateLineRecord[] = [];
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    if (legal(fen).moves().length === 0) continue;
    const { lines, elapsedMs } = await linesFor(fen, multiPv, depth);
    out.push(...candidateRecords(fen, lines, imbalancesOf(fen), elapsedMs));
  }
  return out;
}

export interface ImbalanceRecord {
  fen: string;
  sideToMove: string;
  phase: string;
  /** Every imbalance, one plain sentence per line. */
  facts: string;
  /** Which opening's pawn structure this is, from the book's pawn skeletons; empty if none within two pawns. */
  structure: string;
  materialWhite: number;
  materialBlack: number;
  bishopPairWhite: boolean;
  bishopPairBlack: boolean;
  isolatedQueenPawnWhite: boolean;
  isolatedQueenPawnBlack: boolean;
  passedWhite: string;
  passedBlack: string;
  openFiles: string;
  oppositeSideCastling: boolean;
  oppositeColouredBishops: boolean;
  /** The whole computation, for a caller that wants more than the sentences. */
  detail: string;
}

/** Jeremy Silman's imbalances for each position: material, minor pieces, pawn structure, space, files, key squares, development and king safety. */
export async function positionImbalances(
  _ctx: GenericGatewayContext,
  args: { fens: string[] },
): Promise<ImbalanceRecord[]> {
  return (args.fens ?? []).map((raw) => {
    const fen = raw.trim();
    legal(fen);
    const x = imbalancesOf(fen);
    return {
      fen,
      sideToMove: x.sideToMove,
      phase: x.phase,
      facts: x.facts.join("\n"),
      structure: structureSentence(structureOf(fen)) ?? "",
      materialWhite: x.white.material.points,
      materialBlack: x.black.material.points,
      bishopPairWhite: x.white.bishopPair,
      bishopPairBlack: x.black.bishopPair,
      isolatedQueenPawnWhite: x.white.pawns.isolatedQueenPawn,
      isolatedQueenPawnBlack: x.black.pawns.isolatedQueenPawn,
      passedWhite: x.white.pawns.passed.join(" "),
      passedBlack: x.black.pawns.passed.join(" "),
      openFiles: x.openFiles.join(" "),
      oppositeSideCastling: x.oppositeSideCastling,
      oppositeColouredBishops: x.oppositeColouredBishops,
      detail: JSON.stringify(x),
    };
  });
}

export interface OpeningRecord { fen: string; eco: string; name: string; pgn: string }

export interface TheoryRecord {
  /** The game line: SAN moves from the start, space-separated. */
  line: string;
  /** The deepest page along the line that exists. */
  title: string;
  url: string;
  /** How many plies of the line the page covers, and how many the line has gone past it. */
  pliesCovered: number;
  pliesPast: number;
  /** The page's theory, as plain text. Not called `text`: a gateway result whose record has a
   *  `text` field is unwrapped to that string, and the producer then sees no records at all. */
  theory: string;
  licence: string;
}

type WikibooksPage = { title: string; missing?: string; extract?: string };
type WikibooksGateway = { wikibooks: { wikibooksQuery(a: Record<string, string>): Promise<{ query?: { pages?: Record<string, WikibooksPage> } }> } };

/*
 * The deepest page of the Chess Opening Theory wikibook along a line: one request asks which of
 * the line's prefix pages exist (the deepest 50), a second reads that one's text.
 */
async function theoryFor(ctx: GenericGatewayContext, moves: string[]): Promise<TheoryRecord | null> {
  const wb = (ctx as unknown as WikibooksGateway).wikibooks;
  const titles = theoryTitles(moves);
  if (titles.length === 0) return null;
  const candidates = titles.slice(-50);
  const info = await wb.wikibooksQuery({ action: "query", format: "json", prop: "info", titles: candidates.join("|") });
  const present = new Set(Object.values(info.query?.pages ?? {}).filter((p) => p.missing === undefined).map((p) => p.title));
  const deepest = [...candidates].reverse().find((t) => present.has(t));
  if (!deepest) return null;
  const page = await wb.wikibooksQuery({ action: "query", format: "json", prop: "extracts", explaintext: "1", redirects: "1", titles: deepest });
  const extract = Object.values(page.query?.pages ?? {})[0]?.extract ?? "";
  const text = theoryText(extract);
  if (!text) return null;
  const covered = titles.indexOf(deepest) + 1;
  return {
    line: moves.join(" "), title: deepest, url: pageUrl(deepest), pliesCovered: covered, pliesPast: moves.length - covered,
    theory: text, licence: "Excerpt from the Chess Opening Theory wikibook, by Wikibooks contributors, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); references and tables omitted.",
  };
}

/** What opening theory says along each game line: the deepest page of the Chess Opening Theory wikibook the line reaches. */
export async function theoryOfGameLine(
  ctx: GenericGatewayContext,
  args: { lines: string[] },
): Promise<TheoryRecord[]> {
  const out: TheoryRecord[] = [];
  for (const raw of args.lines ?? []) {
    const moves = splitLine(raw);
    positionAfter(moves);
    const t = await theoryFor(ctx, moves);
    if (t) out.push(t);
  }
  return out;
}

export interface LineOpeningRecord extends OpeningRecord {
  /** The game line looked up: SAN moves from the start, space-separated. */
  line: string;
  /** The ply at which the book last named the line. */
  namedAtPly: number;
  /** How far past that name the line has gone, in plies. */
  pliesPast: number;
}

/**
 * The deepest named opening along each game line (SAN from the start): the name a game keeps
 * after it leaves the book. A line the book never names returns nothing.
 */
export async function openingOfGameLine(
  _ctx: GenericGatewayContext,
  args: { lines: string[] },
): Promise<LineOpeningRecord[]> {
  const out: LineOpeningRecord[] = [];
  for (const raw of args.lines ?? []) {
    const line = splitLine(raw).join(" ");
    positionAfter(splitLine(line));
    const hit = openingOfLine(splitLine(line));
    if (hit) out.push({ line, fen: hit.fen, eco: hit.eco, name: hit.name, pgn: hit.pgn, namedAtPly: hit.namedAtPly, pliesPast: hit.pliesPast });
  }
  return out;
}

/** The named opening each position is, from the Lichess opening book. A position the book does not name returns nothing. */
export async function openingLookup(
  _ctx: GenericGatewayContext,
  args: { fens: string[] },
): Promise<OpeningRecord[]> {
  const out: OpeningRecord[] = [];
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const hit = openingOf(fen);
    if (hit) out.push({ fen, ...hit });
  }
  return out;
}

export interface PlanRecord {
  planId: string;
  fen: string;
  side: string;
  /** Order of importance within the side: 1 first. */
  priority: number;
  name: string;
  idea: string;
  /** Key moves and manoeuvres, in notation, space-separated. */
  moves: string;
  /** The imbalances this plan exploits or repairs, one per line. */
  imbalances: string;
  /** Which of the engine's candidate moves carry this plan, and how the engine rates them. */
  engineEvidence: string;
  /** The position-level verdict: who stands better, why, and how the plans meet. Same on every row for a position. */
  summary: string;
  /** The row of the skill's structure table the model matched, or "none". Same on every row for a position. */
  structure: string;
  /** Who the plans were written for: beginner, intermediate or expert. */
  level: string;
  opening: string;
  model: string;
}

interface ModelPlan {
  side?: string; name?: string; idea?: string; moves?: string[] | string; imbalances?: (number | string)[] | string;
  engineEvidence?: string; priority?: number;
}

function promptFor(fen: string, x: Imbalances, opening: string | null, structure: string | null,
                   candidates: CandidateLineRecord[], withinCp: number, theory: TheoryRecord | null = null,
                   level: Level = "intermediate"): string {
  const lines = candidates
    .filter((c) => c.rank === 1 || (c.lossCp !== null && c.lossCp <= withinCp))
    .map((c) => {
      const score = c.mate !== null ? `mate in ${Math.abs(c.mate)}${c.mate < 0 ? " against the side to move" : ""}`
        : `${(c.whiteCp! / 100).toFixed(2)} from White's side`;
      const loss = c.rank === 1 ? "the engine's best" : c.lossCp === null ? "not comparable with the mate" : `${c.lossCp} centipawns worse than best`;
      return [
        `- ${c.san} (${score}; ${loss}; depth ${c.depth})`,
        `  line: ${c.pvSan.split(" ").slice(0, 12).join(" ")}`,
        c.creates ? `  creates: ${c.creates.split("\n").join(" | ")}` : "",
        c.removes ? `  removes: ${c.removes.split("\n").join(" | ")}` : "",
      ].filter(Boolean).join("\n");
    }).join("\n");
  return `Use the chess-plans skill. Read it before answering.

Position (FEN): ${fen}
${x.sideToMove === "white" ? "White" : "Black"} to move.
Opening: ${opening ?? "not a named book position"}
Pawn structure: ${structure ?? "matches no book line's pawns within two pawns"}
${theory ? `
Opening theory — "${theory.title}" in the Chess Opening Theory wikibook${theory.pliesPast ? `, ${theory.pliesPast} ${theory.pliesPast === 1 ? "ply" : "plies"} before this position` : ", for this position"}:
"""
${theory.theory}
"""
` : ""}
Imbalances (computed from the board, numbered):
${citable(x).map((f, i) => `[${i + 1}] ${f}`).join("\n")}

The engine's candidate moves for the side to move (Stockfish, within ${withinCp} centipawns of best):
${lines}

First decide which row of the skill's structure table (section 4) this position is, from the
pawn structure and imbalances above — or "none" — and let that row's plans lead unless the
engine's moves show they do not work here.
${LEVEL_BRIEF[level]} (Section 8 of the skill says more.)
Name the plans for BOTH sides — up to ${MAX_PLANS[level]} each, most important first — as the skill describes.
Ground every plan in the numbered imbalances and, for the side to move, in the candidate moves.
Cite imbalances by number, in the "imbalances" field ONLY — never write the numbers in the
summary or the ideas; a reader does not see the list. Do not state any imbalance that is not in
the numbered list: if a file, pawn weakness or outpost is not listed, it is not there.
Reply with ONLY this JSON, no prose outside it:
{"structure": "<the matching row's name exactly as the first column of the skill's structure table gives it, e.g. Carlsbad (QGD Exchange) — or none>",
 "summary": "<3-6 sentences: who stands better and why, and how the two sides' plans meet>",
 "plans": [{"side": "white|black", "priority": 1, "name": "<short name>", "idea": "<2-4 sentences>",
            "moves": ["<key moves in SAN>"], "imbalances": [<numbers of the imbalances it uses>],
            "engineEvidence": "<which candidate moves carry it, or 'none of the engine's top moves'>"}]}`;
}

/* The imbalances a plan may cite: every fact but the move-count line. */
const citable = (x: Imbalances) => x.facts.filter((f) => !f.startsWith("Phase:"));

/* Cited numbers back to the sentences they number; a number that names nothing is dropped. */
function citedImbalances(x: Imbalances, cited: ModelPlan["imbalances"]): string[] {
  const facts = citable(x);
  const list = Array.isArray(cited) ? cited : cited ? [cited] : [];
  return list.map((c) => facts[Number(String(c).replace(/[^0-9]/g, "")) - 1]).filter((f): f is string => !!f);
}

/*
 * Models return near-JSON often enough to matter: a trailing comma, a fence. Repair those; the
 * caller asks once more if the repaired text still does not parse.
 */
function parseModelJson(text: string): { structure?: string; summary?: string; plans?: ModelPlan[] } {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`The model did not answer in JSON: ${text.slice(0, 200)}`);
  const candidate = body.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }
}

const asList = (v: string[] | string | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/* Citation numbers a model leaves in prose — "(2)", "(7, 8)", "(#4)" — point at a list the
 * reader never sees. */
const uncite = (text: string | undefined) =>
  (text ?? "").replace(/\s*\((?:#?\d+(?:\s*[,&]\s*#?\d+)*)\)/g, "").replace(/\s+([.,;:])/g, "$1");

interface PlanArgs { withinCp?: number; multiPv?: number; depth?: number; role?: string; level?: string }

export const LEVELS = ["beginner", "intermediate", "expert"] as const;
export type Level = (typeof LEVELS)[number];

/*
 * The audience. It arrives through the producer's pushdown — `WHERE pl.level = 'beginner'`
 * rendered into the `{filters}` slot — so an unrendered placeholder, or nothing, means no level
 * was asked for, and that is intermediate.
 */
/*
 * The level's rules, stated in the prompt as well as in the skill's section 8. Left to the skill
 * alone, the model wrote nearly the same plans for a beginner as for an expert — and for the
 * beginner skipped the attacked pawn on e4 that the expert version mentioned.
 */
const LEVEL_BRIEF: Record<Level, string> = {
  beginner: `Write for a BEGINNER. Your first plan for the side to move MUST deal with the Tactics lines above, if there are any — what is attacked, what is loose, what is threatened — said square by square in plain words. Then the basic principles that apply: develop, castle, fight for the centre. At most TWO plans per side, one or two short sentences each, one or two moves each. No jargon unless you say what it means; no structure names; no numbers.`,
  intermediate: `Write for an INTERMEDIATE player: plans from the imbalances, the structure named and its known plans, the engine's moves tied to the plans, what each plan concedes. Tactics that are there come first. Explain an uncommon term once, briefly.`,
  expert: `Write for an EXPERT: full depth, no hand-holding — structure and variation names, the plans theory gives both sides, move-order finesse and why this move first, the pawn breaks and their timing, what the engine's second and third choices say. Tactics that are there are stated, briefly. Never explain basic terms.`,
};
const MAX_PLANS: Record<Level, number> = { beginner: 2, intermediate: 3, expert: 3 };

function levelOf(v: string | undefined): Level {
  const t = (v ?? "").trim().toLowerCase();
  return (LEVELS as readonly string[]).includes(t) ? (t as Level) : "intermediate";
}

/*
 * One position's plans. `opening` is what is known of its name — from the book by position, or
 * from the game line that reached it, which keeps a name long after the position leaves the book.
 */
async function plansFor(ctx: GenericGatewayContext, fen: string, opening: string | null, args: PlanArgs,
                        theory: TheoryRecord | null = null): Promise<PlanRecord[]> {
  const withinCp = clamp(args.withinCp, 50, 0, 300);
  const multiPv = clamp(args.multiPv, 5, 1, 8);
  const depth = clamp(args.depth, 18, 6, 22);
  const gateway = ctx as unknown as { ai: { complete(a: { prompt: string; role?: string; skills?: string[] }): Promise<unknown> } };
  if (legal(fen).moves().length === 0) return [];
  const x = imbalancesOf(fen);
  const structure = structureSentence(structureOf(fen));
  const { lines, elapsedMs } = await linesFor(fen, multiPv, depth);
  const candidates = candidateRecords(fen, lines, x, elapsedMs);
  const ask = (prompt: string) => gateway.ai.complete({
    prompt,
    skills: ["chess-plans"],
    ...(args.role ? { role: args.role } : {}),
  }).then((r) => (typeof r === "string" ? r : JSON.stringify(r)));
  const level = levelOf(args.level);
  const prompt = promptFor(fen, x, opening, structure, candidates, withinCp, theory, level);
  let text = await ask(prompt);
  let parsed: ReturnType<typeof parseModelJson>;
  try {
    parsed = parseModelJson(text);
  } catch (e) {
    text = await ask(`${prompt}\n\nYour previous answer was not valid JSON (${(e as Error).message}). Reply again with ONLY the JSON object.`);
    parsed = parseModelJson(text);
  }
  const perSide: Record<string, number> = { white: 0, black: 0 };
  const plans = (parsed.plans ?? []).filter((p) => p.side === "white" || p.side === "black")
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9))
    .filter((p) => ++perSide[p.side as string] <= MAX_PLANS[level]);
  if (plans.length === 0) throw new Error(`The model named no plans for ${fen}: ${text.slice(0, 200)}`);
  const count: Record<string, number> = { white: 0, black: 0 };
  return plans.map((p) => {
    const side = p.side as "white" | "black";
    const priority = typeof p.priority === "number" ? p.priority : ++count[side];
    return {
      planId: `${fen}#${level}#${side}#${priority}#${(p.name ?? "").slice(0, 40)}`,
      fen,
      side,
      priority,
      name: p.name ?? "",
      idea: uncite(p.idea),
      moves: asList(p.moves).join(" "),
      imbalances: citedImbalances(x, p.imbalances).join("\n"),
      engineEvidence: uncite(p.engineEvidence),
      summary: uncite(parsed.summary),
      structure: parsed.structure ?? "",
      opening: opening ?? "",
      level,
      model: args.role ?? "default",
    };
  });
}

/**
 * The plans for both sides in each position, decided by a model with the chess-plans skill from
 * the position's imbalances, its opening-book name and the engine's candidate moves. The facts
 * are computed; the judgement is the model's.
 */
export async function explainPlans(
  ctx: GenericGatewayContext,
  args: { fens: string[] } & PlanArgs,
): Promise<PlanRecord[]> {
  const out: PlanRecord[] = [];
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const hit = openingOf(fen);
    out.push(...await plansFor(ctx, fen, hit ? `${hit.eco} ${hit.name} (${hit.pgn})` : null, args));
  }
  return out;
}

export interface LinePlanRecord extends PlanRecord {
  /** The game line: SAN moves from the start, space-separated. */
  line: string;
}

/**
 * The plans in the position a game line reaches, told the line's deepest opening name — which a
 * position looked up alone has lost once it is past the book.
 */
export async function explainLinePlans(
  ctx: GenericGatewayContext,
  args: { lines: string[] } & PlanArgs,
): Promise<LinePlanRecord[]> {
  const out: LinePlanRecord[] = [];
  for (const raw of args.lines ?? []) {
    const moves = splitLine(raw);
    const line = moves.join(" ");
    const fen = positionAfter(moves);
    const hit = openingOfLine(moves);
    const opening = hit
      ? `${hit.eco} ${hit.name} (${hit.pgn})${hit.pliesPast ? `, left the book ${hit.pliesPast} ${hit.pliesPast === 1 ? "ply" : "plies"} ago` : ""}`
      : null;
    // Theory is evidence, not a requirement: a line the wikibook cannot be reached for still gets plans.
    const theory = await theoryFor(ctx, moves).catch(() => null);
    for (const p of await plansFor(ctx, fen, opening, args, theory)) {
      out.push({ ...p, planId: `${line}#${p.level}#${p.side}#${p.priority}#${p.name.slice(0, 40)}`, line });
    }
  }
  return out;
}

/* ── The Lichess opening explorer: master games, and one player's games, by position ── */

interface ExplorerMove { uci: string; san: string; white: number; draws: number; black: number; averageRating?: number; averageOpponentRating?: number; performance?: number }
interface ExplorerGame {
  id: string; uci?: string; winner?: "white" | "black" | null; speed?: string; year?: number; month?: string;
  white?: { name?: string; rating?: number }; black?: { name?: string; rating?: number };
}
interface ExplorerAnswer { white?: number; draws?: number; black?: number; moves?: ExplorerMove[]; topGames?: ExplorerGame[]; recentGames?: ExplorerGame[] }
type LichessGateway = { lichess: {
  mastersExplorer(a: Record<string, unknown>): Promise<unknown>;
  playerExplorer(a: Record<string, unknown>): Promise<unknown>;
} };

/*
 * The explorer answers JSON, except the player database, which streams newline-delimited JSON —
 * each line a more complete version of the last. A JSON-only reader keeps the first line, the
 * least complete; this keeps the LAST line that parses. Whatever the gateway hands back — a
 * parsed object, or the raw text — is read the same way.
 */
export function explorerAnswer(raw: unknown): ExplorerAnswer {
  if (raw && typeof raw === "object") return raw as ExplorerAnswer;
  const lines = String(raw ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch { /* an incomplete line: try the one before */ }
  }
  throw new Error(`The Lichess explorer answered with nothing readable: ${String(raw).slice(0, 200)}`);
}

const share = (n: number, of: number) => (of > 0 ? Math.round((1000 * n) / of) / 10 : null);

export interface ExplorerMoveRecord {
  moveId: string; fen: string; uci: string; san: string; games: number;
  white: number; draws: number; black: number;
  /** Percent of games won by White, drawn, won by Black. */
  whiteWinPct: number | null; drawPct: number | null; blackWinPct: number | null;
  /** Points per game for the side that played the move: 1 a win, 0.5 a draw. */
  scoreForMover: number | null;
  averageRating: number | null;
  player: string; color: string;
}

export interface ExplorerGameRecord {
  gameId: string; fen: string; uci: string; white: string; whiteElo: number | null; black: string; blackElo: number | null;
  result: string; year: number | null; month: string; speed: string; url: string; player: string; color: string;
}

function moveRecords(fen: string, a: ExplorerAnswer, player = "", color = ""): ExplorerMoveRecord[] {
  const mover = new Chess(fen).turn();
  return (a.moves ?? []).map((m) => {
    const games = (m.white ?? 0) + (m.draws ?? 0) + (m.black ?? 0);
    const wins = mover === "w" ? m.white : m.black;
    return {
      moveId: `${fen}#${player}#${color}#${m.uci}`, fen, uci: m.uci, san: m.san, games,
      white: m.white, draws: m.draws, black: m.black,
      whiteWinPct: share(m.white, games), drawPct: share(m.draws, games), blackWinPct: share(m.black, games),
      scoreForMover: games ? Math.round(((wins + m.draws / 2) / games) * 1000) / 1000 : null,
      averageRating: m.averageRating ?? m.averageOpponentRating ?? null,
      player, color,
    };
  });
}

function gameRecords(fen: string, games: ExplorerGame[] | undefined, url: (id: string) => string, player = "", color = ""): ExplorerGameRecord[] {
  return (games ?? []).map((g) => ({
    gameId: `${fen}#${player}#${color}#${g.id}`, fen, uci: g.uci ?? "",
    white: g.white?.name ?? "", whiteElo: g.white?.rating ?? null,
    black: g.black?.name ?? "", blackElo: g.black?.rating ?? null,
    result: g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "½-½",
    year: g.year ?? null, month: g.month ?? "", speed: g.speed ?? "", url: url(g.id), player, color,
  }));
}

/**
 * What masters played from each position — every move with its game count and results — and the
 * top master games through it. One request per position feeds both: the moves (MASTERS_PLAYED)
 * and the games (MASTER_GAME). Needs the Lichess token.
 */
export async function mastersAtPosition(
  ctx: GenericGatewayContext,
  args: { fens: string[] },
): Promise<{ moves: ExplorerMoveRecord[]; games: ExplorerGameRecord[] }> {
  const lichess = (ctx as unknown as LichessGateway).lichess;
  const out = { moves: [] as ExplorerMoveRecord[], games: [] as ExplorerGameRecord[] };
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const a = explorerAnswer(await lichess.mastersExplorer({ fen, moves: 12, topGames: 15 }));
    out.moves.push(...moveRecords(fen, a));
    out.games.push(...gameRecords(fen, a.topGames, (id) => `https://lichess.org/${id}`));
  }
  return out;
}

/*
 * The player and colour arrive the way the plan level does: a query's
 * `WHERE m.player = 'DrNykterstein' AND m.color = 'white'` is pushed down into the `{filters}`
 * slot as "player=DrNykterstein color=white". Without a player there is nothing to ask.
 */
export function playerFilter(filters: string | undefined): { player: string; color: "white" | "black" } | null {
  const f = filters ?? "";
  const player = f.match(/player=([A-Za-z0-9_-]{2,30})/)?.[1];
  const color = f.match(/color=(white|black)/)?.[1] as "white" | "black" | undefined;
  return player ? { player, color: color ?? "white" } : null;
}

/**
 * What one Lichess player played from each position, as one colour — every move with its results
 * — and their recent games through it (PLAYER_PLAYED, PLAYER_GAME). Covers the player's whole
 * Lichess history in one request. Needs the Lichess token.
 */
export async function playerAtPosition(
  ctx: GenericGatewayContext,
  args: { fens: string[]; filters?: string },
): Promise<{ moves: ExplorerMoveRecord[]; games: ExplorerGameRecord[] }> {
  const lichess = (ctx as unknown as LichessGateway).lichess;
  const out = { moves: [] as ExplorerMoveRecord[], games: [] as ExplorerGameRecord[] };
  const who = playerFilter(args.filters);
  if (!who) return out;
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const a = explorerAnswer(await lichess.playerExplorer({ player: who.player, color: who.color, fen, recentGames: 8 }));
    out.moves.push(...moveRecords(fen, a, who.player, who.color));
    out.games.push(...gameRecords(fen, a.recentGames, (id) => `https://lichess.org/${id}`, who.player, who.color));
  }
  return out;
}

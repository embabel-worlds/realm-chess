import type { GenericGatewayContext } from "@embabel/runtime-types";
import { Chess } from "chess.js";
import { search, type RawLine } from "../lib/engine";
import { imbalancesOf, type Imbalances } from "../lib/imbalances";
import { readLine } from "../lib/lines";
import { openingOf, structureOf, structureSentence } from "../lib/openings";

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
  opening: string;
  model: string;
}

interface ModelPlan {
  side?: string; name?: string; idea?: string; moves?: string[] | string; imbalances?: (number | string)[] | string;
  engineEvidence?: string; priority?: number;
}

function promptFor(fen: string, x: Imbalances, opening: OpeningRecord | null, structure: string | null,
                   candidates: CandidateLineRecord[], withinCp: number): string {
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
Opening book: ${opening ? `${opening.eco} ${opening.name} (${opening.pgn})` : "not a named book position"}
Pawn structure: ${structure ?? "matches no book line's pawns within two pawns"}

Imbalances (computed from the board, numbered):
${citable(x).map((f, i) => `[${i + 1}] ${f}`).join("\n")}

The engine's candidate moves for the side to move (Stockfish, within ${withinCp} centipawns of best):
${lines}

First decide which row of the skill's structure table (section 4) this position is, from the
pawn structure and imbalances above — or "none" — and let that row's plans lead unless the
engine's moves show they do not work here.
Name the plans for BOTH sides — up to three each, most important first — as the skill describes.
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

/**
 * The plans for both sides in each position, decided by a model with the chess-plans skill from
 * the position's imbalances, its opening-book name and the engine's candidate moves. The facts
 * are computed; the judgement is the model's.
 */
export async function explainPlans(
  ctx: GenericGatewayContext,
  args: { fens: string[]; withinCp?: number; multiPv?: number; depth?: number; role?: string },
): Promise<PlanRecord[]> {
  const withinCp = clamp(args.withinCp, 50, 0, 300);
  const multiPv = clamp(args.multiPv, 5, 1, 8);
  const depth = clamp(args.depth, 18, 6, 22);
  const gateway = ctx as unknown as { ai: { complete(a: { prompt: string; role?: string; skills?: string[] }): Promise<unknown> } };
  const out: PlanRecord[] = [];
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    if (legal(fen).moves().length === 0) continue;
    const x = imbalancesOf(fen);
    const hit = openingOf(fen);
    const opening = hit ? { fen, ...hit } : null;
    const structure = structureSentence(structureOf(fen));
    const { lines, elapsedMs } = await linesFor(fen, multiPv, depth);
    const candidates = candidateRecords(fen, lines, x, elapsedMs);
    const ask = (prompt: string) => gateway.ai.complete({
      prompt,
      skills: ["chess-plans"],
      ...(args.role ? { role: args.role } : {}),
    }).then((r) => (typeof r === "string" ? r : JSON.stringify(r)));
    const prompt = promptFor(fen, x, opening, structure, candidates, withinCp);
    let text = await ask(prompt);
    let parsed: ReturnType<typeof parseModelJson>;
    try {
      parsed = parseModelJson(text);
    } catch (e) {
      text = await ask(`${prompt}\n\nYour previous answer was not valid JSON (${(e as Error).message}). Reply again with ONLY the JSON object.`);
      parsed = parseModelJson(text);
    }
    const plans = (parsed.plans ?? []).filter((p) => p.side === "white" || p.side === "black");
    if (plans.length === 0) throw new Error(`The model named no plans for ${fen}: ${text.slice(0, 200)}`);
    const count: Record<string, number> = { white: 0, black: 0 };
    for (const p of plans) {
      const side = p.side as "white" | "black";
      const priority = typeof p.priority === "number" ? p.priority : ++count[side];
      out.push({
        planId: `${fen}#${side}#${priority}#${(p.name ?? "").slice(0, 40)}`,
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
        opening: opening ? `${opening.eco} ${opening.name}` : "",
        model: args.role ?? "default",
      });
    }
  }
  return out;
}

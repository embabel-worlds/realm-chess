import type { CandidateLineRecord } from "./engine.ts";
import type { Imbalances } from "./imbalances.ts";
import type { TheoryRecord } from "./theory.ts";

/*
 * The plans prompt and the reading of the model's answer, exactly as the Node realm had them in
 * src/api/chess.ts at 86b5bb5. tests/plans.test.ts holds the text between the markers to that
 * file, so only the transport around them differs.
 */

// ---- from src/api/chess.ts at 86b5bb5 ----
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
// ---- end ----

export { asList, citable, citedImbalances, levelOf, MAX_PLANS, parseModelJson, promptFor, uncite };
export type { ModelPlan, PlanArgs };

/** What the model answered, read by parseModelJson. */
export type ParsedPlans = ReturnType<typeof parseModelJson>;

/**
 * The plan rows from a parsed answer, as the Node realm made them: plans for either side only,
 * most important first, at most the level's number per side, citations that name no fact
 * dropped, and citation numbers taken out of the prose. No plans at all is an error.
 */
export function planRecords(fen: string, x: Imbalances, parsed: ParsedPlans, text: string, level: Level,
                            opening: string | null, role: string | undefined): PlanRecord[] {
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
      model: role ?? "default",
    };
  });
}

/** The prompt for asking again after an answer that was not valid JSON, as the Node realm asked. */
export const repairPrompt = (prompt: string, e: Error) =>
  `${prompt}\n\nYour previous answer was not valid JSON (${e.message}). Reply again with ONLY the JSON object.`;

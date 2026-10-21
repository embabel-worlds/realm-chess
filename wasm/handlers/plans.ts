/*
 * Plans, by the model with the chess-plans skill: for a position or for the position a game line
 * reaches, kept under what they were made from so the same inputs never ask the model twice.
 */

import { skills } from "../generated/realm.ts";
import type { ExplainLinePlansOutput, ExplainPlansOutput, Handler, RowsLinePlansInput, RowsPositionPlansInput } from "../generated/realm.ts";
import { fits } from "../lib/clock.ts";
import { ANALYSIS_TTL_MS, API_CALL_MS, MODEL_CALL_MS, MODEL_OUTPUT_TOKENS, PLANS_TTL_MS, SEARCH_MS, THEORY_TTL_MS } from "../lib/config.ts";
import { LEVEL, pinned } from "../lib/explorer.ts";
import { allWithValues } from "../lib/records.ts";
import type { WithValues } from "../lib/records.ts";
import { aiComplete, ModelRefused, ROLES } from "../lib/model.ts";
import type { ModelRole } from "../lib/model.ts";
import { citable, levelOf, parseModelJson, planRecords, promptFor, repairPrompt } from "../lib/plans.ts";
import type { Level, ParsedPlans, PlanArgs, PlanRecord } from "../lib/plans.ts";
import { sha256Hex } from "../lib/sha256.ts";
import { recordOutcome } from "../lib/status.ts";
import { theoryFor } from "../lib/theory.ts";
import type { TheoryRecord } from "../lib/theory.ts";
import { FULL } from "../lib/engine.ts";
import type { SearchConfig } from "../lib/engine.ts";
import { imbalancesOf } from "../lib/imbalances.ts";
import { lineKeys, openingOf, openingOfLine, pawnKey, positionAfter, positionKey, splitLine, structureOf, structureSentence } from "../lib/openings.ts";
import { bookFor, skeletonsFor, sqlText } from "../lib/store.ts";
import type { Db } from "../lib/store.ts";
import { keptFor, linesFor } from "./engine.ts";
import { clamp, cursorOf, fensOf, keysOf, legal } from "./shared.ts";
import type { Ctx, Item, Page, Paged, Served } from "./shared.ts";

/** A plan row as the graph sees it: the public record, and the analysis its lines came from. */
export interface PlanRow extends PlanRecord {
  analysisId: string;
  /** The game line, for line plans. */
  line?: string;
}

/** One dispatch's dealings with the model: whether it answered, and the code of a refusal. */
export interface ModelSession {
  asked: boolean;
  refused?: string;
}

export async function recordModel(db: Db, m: ModelSession): Promise<void> {
  if (m.refused || m.asked) await recordOutcome(db, { source: "model", code: m.refused, at: Date.now() });
}

/** A plan for a line describes the position the line reaches, told what the line has been. */
type PlanFor = { kind: "position"; fen: string } | { kind: "line"; fen: string; line: string };

/**
 * One position's plans, kept or made. They are kept under an identity made of what they were
 * made from: the kind and key, the analysis of the lines the model was shown, and a hash of every
 * other input to the prompt, the skill's digest included. Lines searched again that come out the
 * same keep their plans; anything else that changed asks the model again.
 *
 * `first` is whether this is the first unit of its page, which always runs. Any other unit
 * starts a search or a model call only when it fits, and is otherwise "later". A model refusal
 * that would only repeat (no grant, a budget spent) is noted on the session and is "stop".
 */
export async function plansFor(
  ctx: Ctx, m: ModelSession, target: PlanFor, opening: string | null, args: PlanArgs, theory: TheoryRecord | null, first: boolean,
): Promise<Served<PlanRow>> {
  const db = ctx.deps.db;
  const { fen } = target;
  const withinCp = clamp(args.withinCp, 50, 0, 300);
  const multiPv = clamp(args.multiPv, 5, 1, 8);
  const depth = clamp(args.depth, 18, 6, 22);
  if (args.role !== undefined && args.role !== "" && !(ROLES as readonly string[]).includes(args.role)) {
    throw new Error(`The model role must be one of ${ROLES.join(", ")}`);
  }
  const role = (args.role || undefined) as ModelRole | undefined;
  if (legal(fen).moves().length === 0) return [];
  const x = imbalancesOf(fen);
  const structure = structureSentence(structureOf(fen, await skeletonsFor(db, pawnKey(fen))));
  const c: SearchConfig = { ...FULL, multiPv, depthCap: depth };
  const kept = (await keptFor(db, c, [fen], false)).get(fen);
  const fresh = kept !== undefined && Date.now() - kept.createdAt < ANALYSIS_TTL_MS;
  if (!first && !fresh && !fits(SEARCH_MS + 2 * MODEL_CALL_MS)) return "later";
  const candidates = await linesFor(ctx, fen, c, kept);
  const analysisId = candidates[0]?.analysisId ?? "";
  const level = levelOf(args.level);
  const key = target.kind === "line" ? target.line : fen;
  const inputsHash = sha256Hex(JSON.stringify({
    level, withinCp, role: role ?? "", multiPv, depth, facts: citable(x), structure, opening,
    theory: theory ? { title: theory.title, pliesPast: theory.pliesPast, textSha: sha256Hex(theory.theory) } : null,
    skill: skills.digest["chess-plans"],
  }));
  const identity = sha256Hex([target.kind, key, analysisId, inputsHash].join("\n"));
  const keptPlans = (await db.exec(`SELECT plans_json, created_at FROM plans WHERE identity = ${sqlText(identity)}`))[0];
  if (keptPlans && Date.now() - Date.parse(String(keptPlans.created_at)) < PLANS_TTL_MS) {
    return JSON.parse(String(keptPlans.plans_json)) as PlanRow[];
  }
  if (m.refused) return "stop";
  if (!first && !fits(2 * MODEL_CALL_MS)) return "later";

  const ask = (prompt: string) => {
    const reply = aiComplete(ctx, { prompt, skills: ["chess-plans"], maxOutputTokens: MODEL_OUTPUT_TOKENS, ...(role ? { role } : {}) });
    m.asked = true;
    return reply.text;
  };
  const prompt = promptFor(fen, x, opening, structure, candidates, withinCp, theory, level as Level);
  let text: string;
  let parsed: ParsedPlans;
  try {
    text = ask(prompt);
    try {
      parsed = parseModelJson(text);
    } catch (e) {
      text = ask(repairPrompt(prompt, e as Error));
      parsed = parseModelJson(text);
    }
  } catch (e) {
    if (e instanceof ModelRefused) {
      ctx.log(`no plans for ${key}: ${e.message}`);
      m.refused = e.code;
      return "stop";
    }
    throw e;
  }
  const rows: PlanRow[] = planRecords(fen, x, parsed, text, level as Level, opening, role).map((p) =>
    target.kind === "line"
      ? { ...p, planId: `${target.line}#${p.level}#${p.side}#${p.priority}#${p.name.slice(0, 40)}`, line: target.line, analysisId }
      : { ...p, analysisId });
  await db.exec(
    `INSERT OR REPLACE INTO plans (identity, kind, fen_or_line, analysis_id, inputs_hash, skill_sha, plans_json, created_at) VALUES (` +
      `${sqlText(identity)}, ${sqlText(target.kind)}, ${sqlText(key)}, ${sqlText(analysisId)}, ${sqlText(inputsHash)}, ` +
      `${sqlText(skills.digest["chess-plans"])}, ${sqlText(JSON.stringify(rows))}, ${sqlText(new Date().toISOString())})`,
  );
  return rows;
}

/** A position's opening as the plans prompt names it, from the book. */
export async function positionOpening(db: Db, fen: string): Promise<string | null> {
  const hit = openingOf(fen, await bookFor(db, [positionKey(fen)]));
  return hit ? `${hit.eco} ${hit.name} (${hit.pgn})` : null;
}

/** A line's opening as the plans prompt names it: the deepest book name, and how long ago the line left the book. */
export async function lineOpening(db: Db, moves: string[]): Promise<string | null> {
  const hit = openingOfLine(moves, await bookFor(db, lineKeys(moves)));
  return hit
    ? `${hit.eco} ${hit.name} (${hit.pgn})${hit.pliesPast ? `, left the book ${hit.pliesPast} ${hit.pliesPast === 1 ? "ply" : "plies"} ago` : ""}`
    : null;
}

/**
 * Theory for line plans: kept, or looked up when the lookup and the plans after it both fit.
 * Theory is evidence, not a requirement: a lookup that fails or is skipped for time is no theory.
 */
export async function lineTheory(ctx: Ctx, moves: string[]): Promise<TheoryRecord | null> {
  try {
    const t = await theoryFor(ctx.deps.db, ctx.gateway, moves, THEORY_TTL_MS, () => fits(API_CALL_MS + SEARCH_MS + 2 * MODEL_CALL_MS));
    if (t === "later") ctx.log(`theory for "${moves.join(" ")}" was skipped for time; the plans are made without it`);
    return t === "later" ? null : t;
  } catch {
    return null;
  }
}

const publicPlan = <R extends PlanRow>({ analysisId: _id, ...p }: R): Omit<R, "analysisId"> => p;

/** Plans for a line carry the line, as the line views and explainLinePlans declare them. */
const withLine = (rows: Served<PlanRow>, line: string): Served<PlanRow & { line: string }> =>
  rows === "stop" || rows === "later" ? rows : rows.map((r) => ({ ...r, line }));

/**
 * The plans for both sides in each position, decided by a model with the chess-plans skill from
 * the position's imbalances, its opening-book name and the engine's candidate moves. The facts
 * are computed; the judgement is the model's. Without the model (no grant, a budget spent) there
 * are no plans, and ChessStatus says why.
 */
export const explainPlans: Handler<{ fens?: string[] } & PlanArgs, ExplainPlansOutput> = async (input: { fens?: string[] } & PlanArgs, ctx: Ctx) => {
  const m: ModelSession = { asked: false };
  const out: PlanRecord[] = [];
  for (const raw of input.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const r = await plansFor(ctx, m, { kind: "position", fen }, await positionOpening(ctx.deps.db, fen), input, null, true);
    if (r === "stop") break;
    if (r !== "later") out.push(...r.map(publicPlan));
  }
  await recordModel(ctx.deps.db, m);
  return allWithValues(out);
};

/**
 * The plans in the position a game line reaches, told the line's deepest opening name, which a
 * position looked up alone has lost once it is past the book, and what the wikibook says along it.
 */
export const explainLinePlans: Handler<{ lines?: string[] } & PlanArgs, ExplainLinePlansOutput> = async (input: { lines?: string[] } & PlanArgs, ctx: Ctx) => {
  const m: ModelSession = { asked: false };
  const out: (PlanRecord & { line: string })[] = [];
  for (const raw of input.lines ?? []) {
    const moves = splitLine(raw);
    const line = moves.join(" ");
    const fen = positionAfter(moves);
    const theory = await lineTheory(ctx, moves);
    const r = withLine(await plansFor(ctx, m, { kind: "line", fen, line }, await lineOpening(ctx.deps.db, moves), input, theory, true), line);
    if (r === "stop") break;
    if (r !== "later") out.push(...r.map(publicPlan));
  }
  await recordModel(ctx.deps.db, m);
  return allWithValues(out);
};

/** The fixed arguments the plan producers search and ask with; only the level comes from the query. */
export const PRODUCER_PLAN_ARGS = { withinCp: 50, multiPv: 5, depth: 18, role: "best" } as const;

/** The levels a query pinned, or intermediate when it pinned none. */
export const levelsOf = (level: unknown) => pinned(level, "level", LEVEL) ?? ["intermediate"];

/**
 * One unit a page: a plan costs a search and up to two model calls, which is a dispatch. The
 * cursor is the index of the next unit; a refusal from the model ends the fetch with no plans.
 */
async function onePlanPage<U, R extends PlanRow>(ctx: Ctx, units: U[], cursor: unknown, serve: (m: ModelSession, u: U) => Promise<Served<R>>) {
  const m: ModelSession = { asked: false };
  const start = cursorOf(cursor, Math.max(units.length, 1));
  let page: Page<WithValues<R>> = { rows: [], next: null };
  if (start < units.length) {
    const r = await serve(m, units[start]);
    page = r === "stop" || r === "later" ? { rows: [], next: null } : { rows: allWithValues(r), next: start + 1 < units.length ? String(start + 1) : null };
  }
  await recordModel(ctx.deps.db, m);
  return page;
}

export const rowsPositionPlans: Paged<RowsPositionPlansInput, Item<ExplainPlansOutput> & { analysisId: string }> = async (input: { fens?: unknown; level?: unknown; cursor?: unknown }, ctx: Ctx) => {
  const levels = levelsOf(input.level);
  const units = fensOf(keysOf(input.fens)).flatMap((fen) => levels.map((level) => ({ fen, level })));
  return onePlanPage(ctx, units, input.cursor, async (m, { fen, level }) =>
    plansFor(ctx, m, { kind: "position", fen }, await positionOpening(ctx.deps.db, fen), { ...PRODUCER_PLAN_ARGS, level }, null, true));
};

export const rowsLinePlans: Paged<RowsLinePlansInput, Item<ExplainLinePlansOutput> & { analysisId: string }> = async (input: { lines?: unknown; level?: unknown; cursor?: unknown }, ctx: Ctx) => {
  const levels = levelsOf(input.level);
  const units = keysOf(input.lines).flatMap((raw) => {
    const moves = splitLine(raw);
    return levels.map((level) => ({ moves, level }));
  });
  return onePlanPage(ctx, units, input.cursor, async (m, { moves, level }) => {
    const line = moves.join(" ");
    const fen = positionAfter(moves);
    const theory = await lineTheory(ctx, moves);
    return withLine(await plansFor(ctx, m, { kind: "line", fen, line }, await lineOpening(ctx.deps.db, moves), { ...PRODUCER_PLAN_ARGS, level }, theory, true), line);
  });
};

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { imbalancesOf } from "../wasm/lib/imbalances";
import { MODEL_OUTPUT_TOKENS, PLANS_TTL_MS } from "../wasm/lib/config";
import { theoryText, theoryTitles } from "../wasm/lib/theory";
import { skills } from "../wasm/generated/realm";
import { battery } from "./battery/battery";
import { RUY_THEORY, wikibooksAnswers } from "./fixtures/lichess";
import { fakeEngine, FOOLS_MATE, positions, STALEMATE } from "./guest/fakes";
import { type Answer, apiRefusal, FakeDb, realmHost } from "./guest/host";
import { type Clock, fetchProducer } from "./guest/producer";
import { buildGuest, call, hasTooling } from "./guest/runtime";

/*
 * Plans by the model, dispatched into the built guest. The engine and the model are fakes that
 * cost the time the plumbing spike measured: three seconds a search, six a model call.
 */

const T0 = Date.parse("2026-10-03T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const TICK = 5;
const NAJDORF = battery().find((p) => p.id === "najdorf-english-attack")!;
const NAJDORF_LINE = NAJDORF.moves!;

/** A model answer naming plans for both sides. The first white plan cites fact 99, which does not exist. */
const ANSWER = JSON.stringify({
  structure: "Sicilian (Najdorf)",
  summary: "Both sides attack where their pawns point (2). White goes for the king.",
  plans: [
    { side: "white", priority: 1, name: "Kingside pawn storm", idea: "Push g4 and h4 (1).", moves: ["g4", "h4"], imbalances: [1, 2, 99], engineEvidence: "the best move" },
    { side: "white", priority: 2, name: "Central control", idea: "Hold d5.", moves: ["Nd5"], imbalances: ["3"], engineEvidence: "none of the engine's top moves" },
    { side: "black", priority: 1, name: "Queenside counterplay", idea: "b5 and b4.", moves: "b5", imbalances: [2], engineEvidence: "" },
  ],
});

interface FakeModel {
  answer: Answer;
  requests: Record<string, unknown>[];
}

function fakeModel(clock: Clock, o: { ms?: number; texts?: string[] } = {}): FakeModel {
  const requests: Record<string, unknown>[] = [];
  const answer: Answer = (req) => {
    requests.push(req);
    clock.now += o.ms ?? 0;
    const texts = o.texts ?? [ANSWER];
    return { text: texts[Math.min(requests.length - 1, texts.length - 1)], truncated: false };
  };
  return { answer, requests };
}

const coded = (code: string): Answer => () => {
  throw Object.assign(new Error("refused"), { code });
};

function setup(o: { engineMs?: number; modelMs?: number; texts?: string[]; model?: Answer | null; variant?: () => number; wikibooks?: Answer } = {}) {
  const clock: Clock = { now: T0 };
  const db = new FakeDb();
  const engine = fakeEngine(clock, { ms: o.engineMs ?? 0, variant: o.variant });
  const model = fakeModel(clock, { ms: o.modelMs ?? 0, texts: o.texts });
  const host = realmHost(db, {
    engine: engine.analyse,
    model: o.model === null ? undefined : o.model ?? model.answer,
    apis: { wikibooks_wikibooksQuery: o.wikibooks ?? wikibooksAnswers(theoryTitles(NAJDORF_LINE.split(" ")).slice(0, 10), RUY_THEORY) },
    clock,
  });
  const fetch = (handler: string, keyArgument: string, keys: string[], extra: Record<string, unknown> = {}, module = buildGuest()) =>
    fetchProducer({ module, handler: `chess.${handler}`, keyArgument, keys, db, host, clock, tickMs: TICK, extra });
  const run = (verb: string, args: unknown) => call(buildGuest(), `chess.${verb}`, args, { host, clock: () => (clock.now += TICK) });
  return { clock, db, host, engine, model, fetch, run };
}

const plansOf = (s: ReturnType<typeof setup>, keys = [NAJDORF.fen], extra: Record<string, unknown> = {}, module?: WebAssembly.Module) =>
  s.fetch("rowsPositionPlans", "fens", keys, extra, module);

describe("the prompt", () => {
  it("built for the Najdorf position at the default level is the recorded text in tests/fixtures/plan-prompt.txt", async () => {
    const s = setup();
    await plansOf(s);
    const prompt = String(s.model.requests[0].prompt);
    expect(prompt).toBe(readFileSync("tests/fixtures/plan-prompt.txt", "utf8"));
  });
});

describe("the skill digest", () => {
  it("is the constant synth embedded, and equals the sha256 of the skill files in the bundle", () => {
    const folder = "skills/chess-plans";
    const files = readdirSync(folder, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name).slice(folder.length + 1)).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    const hash = createHash("sha256");
    for (const f of files) hash.update(`${f}\0${createHash("sha256").update(readFileSync(join(folder, f))).digest("hex")}\n`);
    const digest = hash.digest("hex");
    expect(skills.digest["chess-plans"]).toBe(digest);
    expect(JSON.parse(readFileSync("dist/skills.json", "utf8")).digest["chess-plans"]).toBe(digest);
    expect(readFileSync("wasm/handlers.ts", "utf8")).toContain('import { skills } from "./generated/realm.ts";');
  });
});

describe.skipIf(!hasTooling)("plans, in the guest", () => {
  it("HAS_PLAN on the Najdorf answers both sides, from the lines beside them, citations naming no fact dropped", async () => {
    const s = setup();
    const f = await plansOf(s);
    expect(f.refused).toBeUndefined();
    expect(new Set(f.rows.map((r) => r.side))).toEqual(new Set(["white", "black"]));
    const facts = imbalancesOf(NAJDORF.fen).facts.filter((x) => !x.startsWith("Phase:"));
    const storm = f.rows.find((r) => r.name === "Kingside pawn storm")!;
    expect(storm.imbalances).toBe([facts[0], facts[1]].join("\n"));
    expect(storm.idea).toBe("Push g4 and h4.");
    expect(storm).toMatchObject({ level: "intermediate", model: "best", fen: NAJDORF.fen, priority: 1 });
    const lines = await s.fetch("rowsCandidates", "fens", [NAJDORF.fen]);
    expect(new Set(f.rows.map((r) => r.analysisId))).toEqual(new Set([lines.rows[0].analysisId]));
    expect(s.engine.calls).toHaveLength(1);
    const req = s.model.requests[0];
    expect(req).toMatchObject({ role: "best", skills: ["chess-plans"], maxOutputTokens: MODEL_OUTPUT_TOKENS });
    expect(String(req.prompt)).toMatch(/^Use the chess-plans skill/);
    expect(String(req.prompt)).toContain(`[1] ${facts[0]}`);
  });

  it("invalid JSON is retried once, then refused", async () => {
    const repaired = setup({ texts: ["not json", ANSWER] });
    expect((await plansOf(repaired)).rows.length).toBeGreaterThan(0);
    expect(repaired.model.requests).toHaveLength(2);
    expect(String(repaired.model.requests[1].prompt)).toContain("Your previous answer was not valid JSON");
    const hopeless = setup({ texts: ["not json", "still not"] });
    const f = await plansOf(hopeless);
    expect(f.refused).toBe("HANDLER_FAILED");
    expect(f.error).toMatch(/did not answer in JSON/);
    expect(hopeless.model.requests).toHaveLength(2);
  });

  describe("the plan identity", () => {
    it("a second read makes no model call", async () => {
      const s = setup();
      const first = await plansOf(s);
      expect((await plansOf(s)).rows).toEqual(first.rows);
      expect(s.model.requests).toHaveLength(1);
    });

    it("changing the skill text and reinstalling makes a new call", async () => {
      const s = setup();
      await plansOf(s);
      const generated = readFileSync("wasm/generated/realm.ts", "utf8");
      const reinstalled = buildGuest(undefined, { "generated/realm.ts": generated.replace(skills.digest["chess-plans"], "0".repeat(64)) });
      await plansOf(s, [NAJDORF.fen], {}, reinstalled);
      expect(s.model.requests).toHaveLength(2);
      await plansOf(s, [NAJDORF.fen], {}, reinstalled);
      expect(s.model.requests).toHaveLength(2);
    });

    it("changed theory text under the same line key makes a new call", async () => {
      const s = setup();
      await s.fetch("rowsLinePlans", "lines", [NAJDORF_LINE]);
      await s.fetch("rowsLinePlans", "lines", [NAJDORF_LINE]);
      expect(s.model.requests).toHaveLength(1);
      s.db.exec(`UPDATE theory SET extract = 'A newer reading of the English Attack.'`);
      await s.fetch("rowsLinePlans", "lines", [NAJDORF_LINE]);
      expect(s.model.requests).toHaveLength(2);
      expect(String(s.model.requests[1].prompt)).toContain("A newer reading of the English Attack.");
    });

    it("a re-search after expiry that finds different lines makes a new call, though the plans are younger than seven days", async () => {
      let shift = 0;
      const s = setup({ variant: () => shift });
      await s.fetch("rowsCandidates", "fens", [NAJDORF.fen]);
      s.clock.now += 3 * DAY;
      await plansOf(s);
      s.clock.now += 4 * DAY + 60_000;
      shift = 7;
      await plansOf(s);
      expect(s.engine.calls).toHaveLength(2);
      expect(s.model.requests).toHaveLength(2);
    });

    it("one that finds identical lines does not", async () => {
      const s = setup();
      await s.fetch("rowsCandidates", "fens", [NAJDORF.fen]);
      s.clock.now += 3 * DAY;
      await plansOf(s);
      s.clock.now += 4 * DAY + 60_000;
      await plansOf(s);
      expect(s.engine.calls).toHaveLength(2);
      expect(s.model.requests).toHaveLength(1);
    });

    it("explainPlans' withinCp, depth, multiPv and role are part of the lookup", () => {
      const s = setup();
      const ask = (extra: Record<string, unknown>) => s.run("explainPlans", { fens: [NAJDORF.fen], ...extra }) as Record<string, unknown>[];
      const first = ask({});
      expect(first[0]).not.toHaveProperty("analysisId");
      ask({});
      expect(s.model.requests).toHaveLength(1);
      ask({ withinCp: 100 });
      ask({ role: "workhorse" });
      expect(s.model.requests).toHaveLength(3);
      expect(s.engine.calls).toHaveLength(1);
      ask({ depth: 16 });
      ask({ multiPv: 3 });
      expect(s.model.requests).toHaveLength(5);
      expect(s.engine.calls).toHaveLength(3);
      expect(s.model.requests[2].role).toBe("workhorse");
      expect(s.model.requests[0]).not.toHaveProperty("role");
    });

    it("plan rows carry the analysisId and kept plans expire after seven days", async () => {
      const s = setup();
      const first = await plansOf(s);
      expect(first.rows.every((r) => typeof r.analysisId === "string" && (r.analysisId as string).length === 64)).toBe(true);
      s.clock.now += PLANS_TTL_MS - 60_000;
      await plansOf(s);
      expect(s.model.requests).toHaveLength(1);
      s.clock.now += 120_000;
      await plansOf(s);
      expect(s.model.requests).toHaveLength(2);
    });
  });

  describe("level, role and line plans", () => {
    it("the level pushed down reaches the prompt and the rows; absent means intermediate", async () => {
      const s = setup();
      const beginner = await plansOf(s, [NAJDORF.fen], { level: ["beginner"] });
      expect(String(s.model.requests[0].prompt)).toContain("Write for a BEGINNER");
      expect(beginner.rows.every((r) => r.level === "beginner")).toBe(true);
      expect(beginner.rows.filter((r) => r.side === "white")).toHaveLength(2);
      await plansOf(s);
      expect(String(s.model.requests[1].prompt)).toContain("Write for an INTERMEDIATE player");
      expect(s.model.requests.every((r) => r.role === "best")).toBe(true);
    });

    it("line plans include the line's opening history and its theory", async () => {
      const s = setup();
      const f = await s.fetch("rowsLinePlans", "lines", [NAJDORF_LINE]);
      const prompt = String(s.model.requests[0].prompt);
      expect(prompt).toMatch(/\nOpening: B\d\d Sicilian Defense[^\n]*\(1\. e4 c5[^\n]*\)/);
      expect(prompt).toContain(theoryText(RUY_THEORY).slice(0, 60));
      expect(f.rows[0]).toMatchObject({ line: NAJDORF_LINE });
      expect(String(f.rows[0].planId)).toMatch(new RegExp(`^${NAJDORF_LINE}#intermediate#`));
    });

    it("a theory lookup that fails is tolerated", async () => {
      const s = setup({ wikibooks: apiRefusal });
      const f = await s.fetch("rowsLinePlans", "lines", [NAJDORF_LINE]);
      expect(f.rows.length).toBeGreaterThan(0);
      expect(String(s.model.requests[0].prompt)).not.toContain("Opening theory");
    });
  });

  describe("completeness and paging", () => {
    it("a position with no kept lines is searched at full and planned within its page, under 30 seconds", async () => {
      const s = setup({ engineMs: 3_000, modelMs: 6_000, texts: ["not json", ANSWER] });
      const f = await plansOf(s);
      expect(f.refused).toBeUndefined();
      expect(f.dispatches).toBe(1);
      expect(f.rows.length).toBeGreaterThan(0);
      expect(s.clock.now - T0).toBeLessThan(30_000);
      expect(s.engine.calls[0]).toMatchObject({ nodes: 3_500_000, maxDepth: 18, multiPv: 5 });
    });

    it("line plans on a cold line, with theory and the repair retry, finish inside the page", async () => {
      const s = setup({ engineMs: 3_000, modelMs: 6_000, texts: ["not json", ANSWER] });
      const f = await s.fetch("rowsLinePlans", "lines", [NAJDORF_LINE]);
      expect(f.refused).toBeUndefined();
      expect(String(s.model.requests[1].prompt)).toContain("Opening theory");
    });

    it("checkmate and stalemate return no plan rows and no refusal", async () => {
      const s = setup();
      const f = await plansOf(s, [FOOLS_MATE, STALEMATE]);
      expect(f.refused).toBeUndefined();
      expect(f.rows).toEqual([]);
      expect(s.model.requests).toHaveLength(0);
      expect(s.engine.calls).toHaveLength(0);
    });

    it("one position a page, disjoint pages, an index cursor", async () => {
      const s = setup();
      const keys = positions(3, 11);
      const f = await plansOf(s, keys);
      expect(f.dispatches).toBe(3);
      expect(f.cursors).toEqual([undefined, "1", "2"]);
      f.pages.forEach((page, i) => expect(new Set(page.map((r) => r.fen))).toEqual(new Set([keys[i]])));
    });

    it("a fetch past the page limit is refused by the host with PAGE_BOUND", { timeout: 60_000 }, async () => {
      const s = setup();
      const f = await plansOf(s, positions(17, 13));
      expect(f.refused).toBe("PAGE_BOUND");
      expect(f.dispatches).toBe(16);
    });
  });

  describe("without the model", () => {
    it("no grant: no plan rows, ChessStatus.model = not_granted, and the rest of the realm works", async () => {
      const s = setup({ model: null });
      const f = await plansOf(s, [NAJDORF.fen, positions(1, 3)[0]]);
      expect(f.refused).toBeUndefined();
      expect(f.rows).toEqual([]);
      expect(f.dispatches).toBe(1);
      expect((s.run("status", { username: ["james"] }) as Record<string, string>[])[0]).toMatchObject({ model: "not_granted", lastRefusal: "MODEL_NOT_GRANTED" });
      expect((await s.fetch("rowsCandidates", "fens", [NAJDORF.fen])).rows).toHaveLength(5);
      expect(s.run("explainPlans", { fens: [NAJDORF.fen] })).toEqual([]);
    });

    it.each(["MODEL_DAILY_BUDGET", "MODEL_CALL_BUDGET", "MODEL_SKILL_UNKNOWN"])("%s: no plans, said in lastRefusal, the grant left alone", async (code) => {
      const s = setup({ model: coded(code) });
      expect((await plansOf(s)).rows).toEqual([]);
      expect((s.run("status", { username: ["james"] }) as Record<string, string>[])[0]).toMatchObject({ model: "unknown", lastRefusal: code });
    });

    it("an answered call records the model as ok", async () => {
      const s = setup();
      await plansOf(s);
      expect((s.run("status", { username: ["james"] }) as Record<string, string>[])[0]).toMatchObject({ model: "ok" });
    });
  });
});

/*
 * The plan battery's structure, with a fake model: every battery position goes through the
 * handler tests/battery/run.mjs calls on an appliance (explainLinePlans for moves, explainPlans
 * for a FEN), and comes back with plans for both sides that the runner can grade. Whether the
 * plans are the ones theory gives needs a real model on an appliance; this proves the path.
 */
describe.skipIf(!hasTooling)("the plan battery, with a fake model", () => {
  it("every battery position answers plans for both sides through the verb the runner calls", { timeout: 120_000 }, () => {
    const s = setup();
    for (const p of battery()) {
      const [verb, args] = p.moves ? ["explainLinePlans", { lines: [p.moves], role: "best" }] : ["explainPlans", { fens: [p.fen], role: "best" }];
      const rows = s.run(verb, args) as Record<string, unknown>[];
      expect(new Set(rows.map((r) => r.side)), p.id).toEqual(new Set(["white", "black"]));
      for (const r of rows) for (const k of ["name", "idea", "moves", "priority", "summary", "structure", "opening", "level"]) expect(r, `${p.id} ${k}`).toHaveProperty(k);
    }
    expect(s.model.requests).toHaveLength(battery().length);
    expect(s.model.requests.every((r) => r.role === "best" && (r.skills as string[])[0] === "chess-plans")).toBe(true);
  });
});

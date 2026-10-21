import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { realEngine, STOCKFISH } from "../guest/engine";
import { chessHost, FakeDb } from "../guest/host";
import { buildGuest, call, hasTooling } from "../guest/runtime";
import { battery } from "./battery";

/*
 * The battery's positions through the engine path the graph uses: chess.rowsCandidates in the
 * guest with the real stockfish module at `full`. For each position it records the depth, the
 * best move, the five candidates, and how many of the side to move's expected plans show in
 * those lines (a plan's words found in a candidate line). The plan battery proper, with a model,
 * is tests/battery/run.mjs.
 *
 *   BATTERY=1 npx vitest run tests/battery/engine.test.ts
 */
describe.skipIf(!process.env.BATTERY || !hasTooling || !STOCKFISH)("engine battery", () => {
  it("every battery position, at full", () => {
    const db = new FakeDb();
    const host = chessHost(db, realEngine());
    const has = (text: string, w: string) => new RegExp(`(?<![a-z])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
    const results = battery().map((p) => {
      const t = Date.now();
      const { rows } = call(buildGuest(), "chess.rowsCandidates", { fens: [p.fen] }, { host }) as { rows: Record<string, unknown>[] };
      const ms = Date.now() - t;
      const side = rows[0].side as "white" | "black";
      const lines = rows.map((r) => `${r.pvSan}`.toLowerCase()).join(" \n ");
      const expected = p.plans[side] ?? [];
      const shown = expected.filter((e) => e.anyOf.some((w) => has(lines, w)) && !(e.not ?? []).some((w) => has(lines, w)));
      return { id: p.id, side, depth: rows[0].depth, nodes: rows[0].nodes, best: rows[0].san, scoreCp: rows[0].scoreCp,
        candidates: rows.map((r) => r.san).join(" "), plans: expected.length, shown: shown.length, ms };
    });
    const shown = results.reduce((n, r) => n + r.shown, 0);
    const total = results.reduce((n, r) => n + r.plans, 0);
    const lines = [`# Engine battery, ${new Date().toISOString()}`, "",
      `Side to move's expected plans visible in the engine's five lines: **${shown} of ${total}**.`, "",
      "| Position | Side | Depth | Nodes | Best | Score | Candidates | Plans shown | ms |", "|---|---|---|---|---|---|---|---|---|",
      ...results.map((r) => `| ${r.id} | ${r.side} | ${r.depth} | ${r.nodes} | ${r.best} | ${r.scoreCp} | ${r.candidates} | ${r.shown}/${r.plans} | ${r.ms} |`)];
    mkdirSync(join(__dirname, "results"), { recursive: true });
    writeFileSync(join(__dirname, "results", `engine-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`), lines.join("\n"));
    console.log(lines.join("\n"));
    expect(results.every((r) => r.depth === 18)).toBe(true);
  }, 600_000);
});

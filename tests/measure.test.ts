import { describe, expect, it } from "vitest";
import { MULTI_PV } from "../wasm/lib/config";
import { battery } from "./battery/battery";
import { realEngine, STOCKFISH } from "./guest/engine";
import { chessHost, FakeDb } from "./guest/host";
import { LIMITS } from "./guest/producer";
import { buildGuest, call, hasTooling } from "./guest/runtime";

/*
 * The numbers the README states about bulk queries, measured with the real engine at `full` over
 * the battery positions. Run by hand: MEASURE=1 npx vitest run tests/measure.test.ts
 */
describe.skipIf(!process.env.MEASURE || !hasTooling || !STOCKFISH)("bulk sizes", () => {
  it("how many positions one fetch and sixteen pages can answer", () => {
    const db = new FakeDb();
    const host = chessHost(db, realEngine());
    const fens = battery().map((p) => p.fen);
    const perPosition: number[] = [];
    const searchMs: number[] = [];
    const depths: number[] = [];
    for (const fen of fens) {
      const t = Date.now();
      const page = call(buildGuest(), "chess.rowsCandidates", { fens: [fen] }, { host }) as { rows: Record<string, unknown>[] };
      searchMs.push(Date.now() - t);
      perPosition.push(Buffer.byteLength(JSON.stringify(page.rows)));
      depths.push(page.rows[0].depth as number);
    }
    const bytes = Math.max(...perPosition);
    const mean = perPosition.reduce((a, b) => a + b, 0) / perPosition.length;
    const oneFetch = Math.min(Math.floor(LIMITS.rows / MULTI_PV), Math.floor(LIMITS.bytes / bytes));
    console.log(JSON.stringify({
      positions: fens.length, meanBytesPerPosition: Math.round(mean), maxBytesPerPosition: bytes, keptPositionsInOneFetch: oneFetch,
      searchMsMin: Math.min(...searchMs), searchMsMax: Math.max(...searchMs), depthMin: Math.min(...depths), depthMax: Math.max(...depths),
    }));
    expect(oneFetch).toBeGreaterThan(0);
  }, 600_000);
});

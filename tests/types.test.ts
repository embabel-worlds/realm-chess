import { describe, expect, it } from "vitest";
import type { Handlers } from "../wasm/generated/realm";
import { allWithValues } from "../wasm/lib/records";

/*
 * The handler types synth generates are what keeps a result the host would refuse out of the
 * realm: `npm run typecheck` checks every verb in wasm/handlers.ts against them. These lines are
 * checked by the same typecheck; each @ts-expect-error fails it if the type ever lets the case through.
 */

type Line = Awaited<ReturnType<Handlers["analysePosition"]>>[number];
const line = {
  candidateId: "x e2e4", fen: "x", rank: 1, uci: "e2e4", san: "e4", side: "white", scoreCp: null as number | null, mate: 3 as number | null,
  whiteCp: null as number | null, lossCp: 0 as number | null, depth: 18, pvSan: "e4", pvUci: "e2e4", creates: "", removes: "", engine: "sf", elapsedMs: 1,
};

describe("the generated handler types", () => {
  it("refuse a null where the manifest says a number, and take the record once its valueless fields are left out", () => {
    // @ts-expect-error a mate line's scoreCp is null, which the host refuses
    const raw: Line[] = [line];
    const sent: Line[] = allWithValues([line]);
    expect(raw[0].scoreCp).toBeNull();
    expect(sent[0]).not.toHaveProperty("scoreCp");
    expect(sent[0].mate).toBe(3);
  });

  it("refuse a model request with a field the host does not take", () => {
    type Call = Parameters<Handlers["explainPlans"]>[1]["call"];
    const ask = (call: Call) => {
      // @ts-expect-error `temperature` is not a field of ai_complete
      call("ai_complete", { prompt: "p", temperature: 1 });
      return call("ai_complete", { prompt: "p", role: "best", skills: ["chess-plans"], maxOutputTokens: 2048 }).text;
    };
    expect(ask(() => ({ text: "ok", truncated: false }))).toBe("ok");
  });
});

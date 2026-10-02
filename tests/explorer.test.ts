import { describe, expect, it } from "vitest";
import { explorerAnswer, playerFilter } from "../src/api/chess";

describe("the Lichess explorer's answers", () => {
  it("a streamed answer is read from its last complete line, not its first", () => {
    const ndjson = [
      JSON.stringify({ white: 1, draws: 0, black: 0, moves: [] }),
      JSON.stringify({ white: 40, draws: 12, black: 9, moves: [{ uci: "e2e4", san: "e4", white: 40, draws: 12, black: 9 }] }),
      '{"white": 41, "dra',
    ].join("\n");
    expect(explorerAnswer(ndjson).white).toBe(40);
  });

  it("an already-parsed answer passes through", () => {
    expect(explorerAnswer({ white: 3 }).white).toBe(3);
  });

  it("nothing readable is an error, not an empty answer", () => {
    expect(() => explorerAnswer("<html>401</html>")).toThrow(/nothing readable/);
  });
});

describe("the player filter pushed down from the query", () => {
  it("reads the player and colour", () => {
    expect(playerFilter("player=DrNykterstein color=black")).toEqual({ player: "DrNykterstein", color: "black" });
  });
  it("defaults the colour to white", () => {
    expect(playerFilter("player=penguingm1")).toEqual({ player: "penguingm1", color: "white" });
  });
  it("no player, or an unrendered placeholder, asks nothing", () => {
    expect(playerFilter("{filters}")).toBeNull();
    expect(playerFilter(undefined)).toBeNull();
  });
});

describe("which rating bands and time controls a query asks for", async () => {
  const { ratedGrid } = await import("../src/api/chess");
  it("a pinned time control compares every rating band", () => {
    const g = ratedGrid("speed=blitz");
    expect(g).toHaveLength(9);
    expect(new Set(g.map((c) => c.speed))).toEqual(new Set(["blitz"]));
  });
  it("a pinned band compares every time control", () => {
    expect(ratedGrid("band=1600").map((c) => c.speed)).toEqual(["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"]);
  });
  it("both pinned is one cell; neither is every band over all time controls", () => {
    expect(ratedGrid("band=2200 speed=classical")).toEqual([{ band: "2200", speed: "classical" }]);
    expect(ratedGrid("{filters}").every((c) => c.speed === "all")).toBe(true);
    expect(ratedGrid("speed=all")).toHaveLength(9);
  });
});

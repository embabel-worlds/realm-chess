import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { LICHESS_SPACING_MS, MASTERS_TTL_MS, PLAYER_TTL_MS, RATED_TTL_MS, THEORY_TTL_MS } from "../wasm/lib/config";
import { explorerAnswer } from "../wasm/lib/explorer";
import { LICENCE, pageUrl, theoryText, theoryTitles } from "../wasm/lib/theory";
import { rodBundle } from "./baseline/rod-bundle";
import {
  AFTER_E4, FIXTURE_FENS, mastersAnswer, ndjsonReply, ndjsonText, playerRecords, ratedAnswer, RUY, RUY_THEORY, START, wikibooksAnswers,
} from "./fixtures/lichess";
import { type Answer, apiRefusal, FakeDb, realmHost } from "./guest/host";
import { type Clock, fetchProducer } from "./guest/producer";
import { buildGuest, call, hasTooling } from "./guest/runtime";

/*
 * Lichess practice and wikibook theory, dispatched into the built guest with the APIs answered
 * by fakes. Where the Node realm answered the same question, its own bundle at 86b5bb5 is handed
 * the same answers and the two are compared field by field.
 */

const T0 = Date.parse("2026-10-03T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const TICK = 5;
const RUY_LINE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";
const RUY_PAGES = theoryTitles(RUY_LINE.split(" ")).slice(0, 7);

interface Fakes {
  latencyMs?: number;
  masters?: Answer;
  wikibooks?: Answer;
}

/** Every API the realm declares, answered from the fixtures, each call costing `latencyMs` of fake time. */
function apis(clock: Clock, o: Fakes = {}): Record<string, Answer> {
  const slow = (f: Answer): Answer => (a) => {
    clock.now += o.latencyMs ?? 0;
    return f(a);
  };
  return {
    lichess_mastersExplorer: slow(o.masters ?? ((a) => mastersAnswer(String(a.fen)))),
    lichess_playerExplorer: slow((a) => ndjsonReply(playerRecords(String(a.fen), String(a.player), String(a.color)))),
    lichess_lichessExplorer: slow((a) => ratedAnswer(String(a.fen), String(a.ratings), a.speeds as string | undefined)),
    wikibooks_wikibooksQuery: slow(o.wikibooks ?? wikibooksAnswers(RUY_PAGES, RUY_THEORY)),
  };
}

/** The Node realm's gateway over the same fixtures. The player database reached it as raw NDJSON text. */
const rodCtx = {
  lichess: {
    mastersExplorer: async (a: Record<string, unknown>) => mastersAnswer(String(a.fen)),
    playerExplorer: async (a: Record<string, unknown>) =>
      ndjsonText(playerRecords(String(a.fen), String(a.player), String(a.color)), '{"white": 41, "dra'),
    lichessExplorer: async (a: Record<string, unknown>) => ratedAnswer(String(a.fen), String(a.ratings), a.speeds as string | undefined),
  },
  wikibooks: { wikibooksQuery: async (a: Record<string, string>) => wikibooksAnswers(RUY_PAGES, RUY_THEORY)(a) },
};

function setup(o: Fakes & { refuseLichess?: boolean } = {}) {
  const clock: Clock = { now: T0 };
  const db = new FakeDb();
  const a = apis(clock, o);
  if (o.refuseLichess) for (const k of Object.keys(a)) if (k.startsWith("lichess_")) a[k] = apiRefusal;
  const host = realmHost(db, { apis: a, clock });
  const run = (verb: string, args: unknown) => call(buildGuest(), `chess.${verb}`, args, { host, clock: () => (clock.now += TICK) });
  const fetch = (handler: string, keyArgument: string, keys: string[], extra: Record<string, unknown> = {}) =>
    fetchProducer({ module: buildGuest(), handler: `chess.${handler}`, keyArgument, keys, db, host, clock, tickMs: TICK, extra });
  return { clock, db, host, run, fetch };
}

/** A guest clock that moves a little on every read, so a guest waiting on it gets there. */
const ticking = () => {
  let t = T0;
  return () => (t += TICK);
};

const lichessCalls = (host: ReturnType<typeof realmHost>) => host.calls.filter((c) => c.tool.startsWith("lichess_"));

describe.skipIf(!hasTooling)("Lichess and theory, in the guest", () => {
  describe("with no Lichess credential bound", () => {
    it("the five Lichess relationships return no rows, ChessStatus says refused, and theory still answers", async () => {
      const { run, fetch, db } = setup({ refuseLichess: true });
      expect((await fetch("rowsMasterMoves", "fens", [START])).rows).toEqual([]);
      expect((await fetch("rowsMasterGames", "fens", [START])).rows).toEqual([]);
      expect((await fetch("rowsPlayerMoves", "fens", [START], { player: ["DrNykterstein"] })).rows).toEqual([]);
      expect((await fetch("rowsPlayerGames", "fens", [START], { player: ["DrNykterstein"] })).rows).toEqual([]);
      expect((await fetch("rowsRatedMoves", "fens", [START], { speed: ["blitz"] })).rows).toEqual([]);
      const status = run("status", { username: ["james"] }) as { rows: Record<string, string>[] };
      expect(status.rows[0]).toMatchObject({ lichess: "refused", lastRefusal: "LICHESS_REFUSED" });
      expect(status.rows[0].at).toMatch(/^2026-10-03T09:/);
      expect(db.exec("SELECT COUNT(*) AS n FROM explorer")[0].n).toBe("0");
      const theory = await fetch("rowsTheory", "lines", [RUY_LINE]);
      expect(theory.rows).toHaveLength(1);
      expect((await fetch("rowsImbalances", "fens", [START])).rows).toHaveLength(1);
    });

    it("a refused request stops the fetch: one refusal, not one per position", async () => {
      const { fetch, host } = setup({ refuseLichess: true });
      await fetch("rowsMasterMoves", "fens", FIXTURE_FENS);
      expect(lichessCalls(host)).toHaveLength(1);
    });

    it("Rod's public handlers keep his contract and say Lichess refused", () => {
      const { run } = setup({ refuseLichess: true });
      expect(() => run("mastersAtPosition", { fens: [START] })).toThrow(/refused/);
      expect(run("playerAtPosition", { fens: [START] })).toEqual({ moves: [], games: [] });
    });
  });

  describe("the same rows as the Node realm, from the same answers", () => {
    beforeEach(() => {
      vi.spyOn(globalThis, "setTimeout").mockImplementation(((f: () => void) => {
        f();
        return 0;
      }) as unknown as typeof setTimeout);
    });
    afterEach(() => vi.restoreAllMocks());

    it("MastersAtPosition: moves and games for three positions, from one kept request per position", async () => {
      const rod = (await rodBundle().mastersAtPosition(rodCtx, { fens: FIXTURE_FENS })) as { moves: unknown[]; games: unknown[] };
      const { fetch, host, run } = setup();
      const moves = await fetch("rowsMasterMoves", "fens", FIXTURE_FENS);
      const games = await fetch("rowsMasterGames", "fens", FIXTURE_FENS);
      expect(moves.rows).toEqual(rod.moves);
      expect(games.rows).toEqual(rod.games);
      expect(host.count("lichess_mastersExplorer")).toBe(3);
      expect(run("mastersAtPosition", { fens: FIXTURE_FENS })).toEqual(rod);
      expect(host.count("lichess_mastersExplorer")).toBe(3);
    });

    it("masterMoves and masterGames share one kept response: one gateway call between them", async () => {
      const { fetch, host } = setup();
      await fetch("rowsMasterMoves", "fens", [START]);
      await fetch("rowsMasterGames", "fens", [START]);
      expect(host.count("lichess_mastersExplorer")).toBe(1);
    });

    it("PlayerAtPosition: the player's moves and games for three positions, from the last complete NDJSON record", async () => {
      const filters = "player=DrNykterstein color=black";
      const rod = (await rodBundle().playerAtPosition(rodCtx, { fens: FIXTURE_FENS, filters })) as { moves: unknown[]; games: unknown[] };
      const { fetch, run } = setup();
      const pin = { player: ["DrNykterstein"], color: ["black"] };
      expect((await fetch("rowsPlayerMoves", "fens", FIXTURE_FENS, pin)).rows).toEqual(rod.moves);
      expect((await fetch("rowsPlayerGames", "fens", FIXTURE_FENS, pin)).rows).toEqual(rod.games);
      expect(run("playerAtPosition", { fens: FIXTURE_FENS, filters })).toEqual(rod);
    });

    it.each([["speed=blitz", { speed: ["blitz"] }], ["band=1600", { band: ["1600"] }], ["", {}], ["band=2200 speed=classical", { band: ["2200"], speed: ["classical"] }]])(
      "MovesByRating and MovesByTimeControl (%s): every cell's rows for three positions",
      async (filters, pin) => {
        const rod = await rodBundle().ratedMoves(rodCtx, { fens: FIXTURE_FENS, filters });
        const { fetch, run } = setup();
        const f = await fetch("rowsRatedMoves", "fens", FIXTURE_FENS, pin);
        expect(f.refused).toBeUndefined();
        expect(f.rows).toEqual(rod);
        expect(run("ratedMoves", { fens: FIXTURE_FENS, filters })).toEqual(rod);
      },
    );

    it("TheoryOfLine: the attributed excerpt and its link", async () => {
      const rod = await rodBundle().theoryOfGameLine(rodCtx, { lines: [RUY_LINE] });
      const { fetch, run } = setup();
      const f = await fetch("rowsTheory", "lines", [RUY_LINE]);
      expect(f.rows).toEqual(rod);
      expect(f.rows[0]).toMatchObject({
        title: RUY_PAGES[6], url: pageUrl(RUY_PAGES[6]), theory: theoryText(RUY_THEORY), licence: LICENCE, pliesCovered: 7, pliesPast: 10,
      });
      expect(run("theoryOfGameLine", { lines: [RUY_LINE] })).toEqual(rod);
    });
  });

  describe("the player database streams NDJSON", () => {
    it("is declared ndjson, so synth lists it for the host", () => {
      const lichess = (parse(readFileSync("apis/apis.yml", "utf8")) as { name: string; "ndjson-operation-ids"?: string[] }[]).find((a) => a.name === "lichess")!;
      expect(lichess["ndjson-operation-ids"]).toEqual(["playerExplorer"]);
    });

    it("a truncated stream is read as the Node realm reads it: from the last complete record", () => {
      const records = playerRecords(START, "DrNykterstein", "white");
      const host = realmHost(new FakeDb(), { apis: { lichess_playerExplorer: () => ndjsonReply(records, true) } });
      const fromGuest = call(buildGuest(), "chess.playerAtPosition", { fens: [START], filters: "player=DrNykterstein" }, { host, clock: ticking() }) as { moves: { games: number }[] };
      const fromText = explorerAnswer(ndjsonText(records, '{"white": 41, "dra'));
      expect(fromGuest.moves.map((m) => m.games)).toEqual(fromText.moves!.map((m) => m.white + m.draws + m.black));
    });

    it("a stream with no records is nothing readable, never an empty answer", () => {
      const host = realmHost(new FakeDb(), { apis: { lichess_playerExplorer: () => ndjsonReply([], true) } });
      expect(() => call(buildGuest(), "chess.playerAtPosition", { fens: [START], filters: "player=DrNykterstein" }, { host, clock: ticking() })).toThrow(/nothing readable/);
    });
  });

  describe("pushdown, for every pin the thirteen views can make", () => {
    const BANDS = ["0", "1000", "1200", "1400", "1600", "1800", "2000", "2200", "2500"];
    const SPEEDS = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"];
    type Case = { what: string; handler: string; pin: Record<string, unknown>; requests: Record<string, unknown>[] };
    const rated = (cells: [string, string][]) => cells.map(([b, s]) => ({ ratings: b, ...(s === "all" ? {} : { speeds: s }) }));
    const cases: Case[] = [
      { what: "PlayerAtPosition: player and colour", handler: "rowsPlayerMoves", pin: { player: ["DrNykterstein"], color: ["black"] }, requests: [{ player: "DrNykterstein", color: "black" }] },
      { what: "PlayerGamesAtPosition: player and colour", handler: "rowsPlayerGames", pin: { player: ["penguingm1"], color: ["white"] }, requests: [{ player: "penguingm1", color: "white" }] },
      { what: "only m.player: White, as playerFilter defaults", handler: "rowsPlayerMoves", pin: { player: ["DrNykterstein"] }, requests: [{ player: "DrNykterstein", color: "white" }] },
      { what: "only g.player on games", handler: "rowsPlayerGames", pin: { player: ["DrNykterstein"] }, requests: [{ player: "DrNykterstein", color: "white" }] },
      { what: "colour without a player asks nothing", handler: "rowsPlayerMoves", pin: { color: ["black"] }, requests: [] },
      { what: "no player asks nothing", handler: "rowsPlayerGames", pin: {}, requests: [] },
      { what: "two players in both colours", handler: "rowsPlayerMoves", pin: { player: ["a1", "b2"], color: ["white", "black"] }, requests: [{ player: "a1", color: "white" }, { player: "a1", color: "black" }, { player: "b2", color: "white" }, { player: "b2", color: "black" }] },
      { what: "a pin no value satisfies", handler: "rowsPlayerMoves", pin: { player: [] }, requests: [] },
      { what: "MovesByRating: speed pinned, every band", handler: "rowsRatedMoves", pin: { speed: ["blitz"] }, requests: rated(BANDS.map((b) => [b, "blitz"])) },
      { what: "MovesByRating with speed all", handler: "rowsRatedMoves", pin: { speed: ["all"] }, requests: rated(BANDS.map((b) => [b, "all"])) },
      { what: "MovesByTimeControl: band pinned, every time control", handler: "rowsRatedMoves", pin: { band: ["1600"] }, requests: rated(SPEEDS.map((s) => ["1600", s])) },
      { what: "nothing pinned: Rod's default grid", handler: "rowsRatedMoves", pin: {}, requests: rated(BANDS.map((b) => [b, "all"])) },
      { what: "band and speed: one cell", handler: "rowsRatedMoves", pin: { band: ["2200"], speed: ["classical"] }, requests: rated([["2200", "classical"]]) },
      { what: "several bands and speeds: one request per cell", handler: "rowsRatedMoves", pin: { band: ["1600", "2200"], speed: ["blitz", "rapid"] }, requests: rated([["1600", "blitz"], ["1600", "rapid"], ["2200", "blitz"], ["2200", "rapid"]]) },
      { what: "MastersAtPosition: nothing to pin", handler: "rowsMasterMoves", pin: {}, requests: [{ moves: 12, topGames: 15 }] },
      { what: "MasterGamesAtPosition: nothing to pin", handler: "rowsMasterGames", pin: {}, requests: [{ moves: 12, topGames: 15 }] },
    ];

    it.each(cases)("$what", async ({ handler, pin, requests }) => {
      const { fetch, host } = setup();
      const f = await fetch(handler, "fens", [AFTER_E4], pin);
      expect(f.refused).toBeUndefined();
      const sent = lichessCalls(host).map((c) => c.args);
      expect(sent).toHaveLength(requests.length);
      requests.forEach((r, i) => expect(sent[i]).toMatchObject({ fen: AFTER_E4, ...r }));
      if (requests.length === 0) expect(f.rows).toEqual([]);
      else expect(f.rows.length).toBeGreaterThan(0);
    });

    it("several cells keep their own statistics, one row per cell and move", async () => {
      const { fetch } = setup();
      const f = await fetch("rowsRatedMoves", "fens", [AFTER_E4], { band: ["1600", "2200"], speed: ["blitz"] });
      const move = f.rows[0].san;
      const same = f.rows.filter((r) => r.san === move);
      expect(same.map((r) => r.band)).toEqual(["1600", "2200"]);
      expect(same[0].games).not.toBe(same[1].games);
      expect(same[0].bandGames).not.toBe(same[1].bandGames);
    });

    it.each([
      ["rowsRatedMoves", { band: ["1500"] }],
      ["rowsRatedMoves", { speed: ["hyperbullet"] }],
      ["rowsPlayerMoves", { player: ["has space"] }],
      ["rowsPlayerGames", { player: ["DrNykterstein"], color: ["red"] }],
      ["rowsPositionPlans", { level: ["grandmaster"] }],
    ])("%s refuses %j with PUSHDOWN_VALUE", async (handler, pin) => {
      const { fetch, host } = setup();
      const f = await fetch(handler, "fens", [AFTER_E4], pin);
      expect(f.refused).toBe("HANDLER_FAILED");
      expect(f.error).toMatch(/^PUSHDOWN_VALUE/);
      expect(host.calls).toHaveLength(0);
    });
  });

  describe("keeping answers", () => {
    it.each([
      ["rowsMasterMoves", {}, MASTERS_TTL_MS, "lichess_mastersExplorer"],
      ["rowsPlayerMoves", { player: ["DrNykterstein"] }, PLAYER_TTL_MS, "lichess_playerExplorer"],
      ["rowsRatedMoves", { band: ["1600"], speed: ["blitz"] }, RATED_TTL_MS, "lichess_lichessExplorer"],
    ] as const)("%s keeps its answer for the Node realm's time, then asks again", async (handler, pin, ttl, tool) => {
      const { fetch, host, clock } = setup();
      const first = await fetch(handler, "fens", [START], pin);
      expect(host.count(tool)).toBe(1);
      clock.now += ttl - 60_000;
      expect((await fetch(handler, "fens", [START], pin)).rows).toEqual(first.rows);
      expect(host.count(tool)).toBe(1);
      clock.now += 120_000;
      await fetch(handler, "fens", [START], pin);
      expect(host.count(tool)).toBe(2);
    });

    it("an empty answer is not kept, as the Node realm's producers never cached one", async () => {
      const empty = () => ({ white: 0, draws: 0, black: 0, moves: [], topGames: [] });
      const { fetch, host, db } = setup({ masters: empty });
      expect((await fetch("rowsMasterMoves", "fens", [START])).rows).toEqual([]);
      await fetch("rowsMasterMoves", "fens", [START]);
      expect(host.count("lichess_mastersExplorer")).toBe(2);
      expect(db.exec("SELECT COUNT(*) AS n FROM explorer")[0].n).toBe("0");
    });

    it("a refused request is not kept, and is recorded as refused with its time", async () => {
      let refuse = true;
      const { fetch, host, run, clock } = setup({ masters: (a) => (refuse ? apiRefusal() : mastersAnswer(String(a.fen))) });
      await fetch("rowsMasterMoves", "fens", [START]);
      const refusedAt = (run("status", { username: ["james"] }) as { rows: { at: string; lichess: string }[] }).rows[0];
      expect(refusedAt.lichess).toBe("refused");
      expect(Date.parse(refusedAt.at)).toBeGreaterThanOrEqual(T0);
      expect(Date.parse(refusedAt.at)).toBeLessThanOrEqual(clock.now);
      refuse = false;
      expect((await fetch("rowsMasterMoves", "fens", [START])).rows.length).toBeGreaterThan(0);
      expect(host.count("lichess_mastersExplorer")).toBe(2);
      expect((run("status", { username: ["james"] }) as { rows: { lichess: string; lastRefusal: string }[] }).rows[0]).toMatchObject({ lichess: "ok", lastRefusal: "LICHESS_REFUSED" });
    });

    it("what is kept is the checked answer: unknown fields and malformed entries never reach SQLite", async () => {
      const dirty = (a: Record<string, unknown>) => ({
        ...mastersAnswer(String(a.fen)),
        opening: { eco: "<script>" },
        moves: [...mastersAnswer(String(a.fen)).moves, { uci: "zz99", san: "<b>", white: 1, draws: 1, black: 1 }],
        topGames: [...mastersAnswer(String(a.fen)).topGames, { id: "../../etc", white: { name: "x" } }],
      });
      const { fetch, db } = setup({ masters: dirty });
      const rows = (await fetch("rowsMasterMoves", "fens", [START])).rows;
      expect(rows).toHaveLength(6);
      const kept = db.exec("SELECT response_json FROM explorer")[0].response_json!;
      expect(kept).not.toContain("script");
      expect(kept).not.toContain("zz99");
      expect(kept).not.toContain("etc");
    });

    it("writes only keyed upserts", async () => {
      const { fetch, db } = setup();
      await fetch("rowsMasterMoves", "fens", [START]);
      await fetch("rowsTheory", "lines", [RUY_LINE]);
      for (const w of db.writes()) expect(w).toMatch(/^(INSERT OR REPLACE INTO (explorer|theory) |INSERT INTO (lichess_clock|chess_status) .* ON CONFLICT\((name|owner)\) DO UPDATE)/s);
    });
  });

  describe("spacing and paging", () => {
    it("requests are 1.1 seconds apart within a dispatch and across dispatches, through lichess_last_request_at", async () => {
      const { fetch, host } = setup({ latencyMs: 200 });
      await fetch("rowsMasterMoves", "fens", FIXTURE_FENS);
      await fetch("rowsRatedMoves", "fens", [START], { band: ["1600"], speed: ["blitz", "rapid"] });
      const at = lichessCalls(host).map((c) => c.at);
      expect(at).toHaveLength(5);
      for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(LICHESS_SPACING_MS + 200);
    });

    it("the unfiltered nine-cell grid fits one dispatch at the latency the plumbing spike measured", async () => {
      const { fetch } = setup({ latencyMs: 150 });
      const f = await fetch("rowsRatedMoves", "fens", [START]);
      expect(f.dispatches).toBe(1);
      expect(new Set(f.rows.map((r) => r.band)).size).toBe(9);
    });

    it("cells that do not fit a dispatch are paged, never dropped, and pages are disjoint", async () => {
      const { fetch } = setup({ latencyMs: 4_000 });
      const f = await fetch("rowsRatedMoves", "fens", [START, AFTER_E4]);
      expect(f.refused).toBeUndefined();
      expect(f.dispatches).toBeGreaterThan(1);
      const cells = f.rows.map((r) => `${r.fen} ${r.band} ${r.speed}`);
      expect(new Set(cells).size).toBe(18);
      const ids = f.rows.map((r) => r.rowId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(f.cursors.slice(1).every((c) => /^\d+$/.test(c!))).toBe(true);
    });
  });

  describe("theory", () => {
    it("a second read within seven days makes no gateway call; after seven days it asks again", async () => {
      const { fetch, host, clock } = setup();
      const first = await fetch("rowsTheory", "lines", [RUY_LINE]);
      expect(host.count("wikibooks_wikibooksQuery")).toBe(2);
      clock.now += THEORY_TTL_MS - 60_000;
      expect((await fetch("rowsTheory", "lines", [RUY_LINE])).rows).toEqual(first.rows);
      expect(host.count("wikibooks_wikibooksQuery")).toBe(2);
      clock.now += 120_000;
      await fetch("rowsTheory", "lines", [RUY_LINE]);
      expect(host.count("wikibooks_wikibooksQuery")).toBe(4);
    });

    it("a line the wikibook has no page for is kept as a miss for the week", async () => {
      const { fetch, host } = setup({ wikibooks: wikibooksAnswers([], "") });
      expect((await fetch("rowsTheory", "lines", ["a3 a6"])).rows).toEqual([]);
      expect((await fetch("rowsTheory", "lines", ["a3 a6"])).rows).toEqual([]);
      expect(host.count("wikibooks_wikibooksQuery")).toBe(1);
    });

    it("a refused lookup has no row, keeps nothing, and the next read asks again", async () => {
      const { fetch, host, db } = setup({ wikibooks: apiRefusal });
      expect((await fetch("rowsTheory", "lines", [RUY_LINE])).rows).toEqual([]);
      expect(db.exec("SELECT COUNT(*) AS n FROM theory")[0].n).toBe("0");
      await fetch("rowsTheory", "lines", [RUY_LINE]);
      expect(host.count("wikibooks_wikibooksQuery")).toBe(2);
    });

    it("keeps the attributed excerpt, never the whole page, and only a title it asked about", async () => {
      const long = `${"Theory sentence. ".repeat(400)}\n== References ==\n${"x".repeat(5000)}`;
      const sneaky = (a: Record<string, unknown>) =>
        a.prop === "info" ? { query: { pages: { "1": { title: "Some Other Page" }, "2": { title: RUY_PAGES[2] } } } } : wikibooksAnswers(RUY_PAGES, long)(a);
      const { fetch, db } = setup({ wikibooks: sneaky });
      const row = (await fetch("rowsTheory", "lines", [RUY_LINE])).rows[0];
      expect(row.title).toBe(RUY_PAGES[2]);
      const kept = db.exec("SELECT extract FROM theory")[0].extract!;
      expect(kept.length).toBeLessThanOrEqual(3002);
      expect(kept).not.toContain("References");
    });
  });
});

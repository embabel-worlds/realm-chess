import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseView, runView } from "../wasm/lib/cypher";
import { STATUS_VIEW, VIEWS, type ViewSpec } from "../wasm/lib/views";
import { START } from "./fixtures/lichess";
import { fakeEngine } from "./guest/fakes";
import { apiRefusal, FakeDb, realmHost } from "./guest/host";
import { type Clock, declaredProducers, fetchProducer, isPage, isRowList, type ProducerDeclaration } from "./guest/producer";
import { buildGuest, dispatch, hasTooling } from "./guest/runtime";

/*
 * The shape every producer hands the host, and the path a view's empty answer takes to be
 * explained. The host takes `{ rows, next }` from a paged producer and a plain list of rows from
 * one with no page, and refuses anything else, which fails the view outright. So each declared
 * producer is checked three ways: its handler's declared output schema, what the built guest
 * really answers, and a fetch through the host's model of the producer. Then every view is run
 * through its producers with Lichess refused and no model grant, and each empty column must be
 * explained by ChessStatus, itself fetched through its own producer.
 */

interface Entry { name: string; outputSchema: { type?: string; items?: { type?: string } } }
const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8")) as { entries: Entry[] };
const PRODUCERS = declaredProducers() as (ProducerDeclaration & { joins: { anchorLabel: string; relationship: string }[]; pushdown?: { argument: string; property: string }[] })[];
const handlerName = (p: ProducerDeclaration) => p.handler.replace(/^chess\./, "");

const T0 = Date.parse("2026-10-03T09:00:00Z");
const TICK = 5;

/* A value for every view parameter, and a key of each kind a producer takes. */
const PARAMS: Record<string, unknown> = {
  fen: START, moves: "e4 e5", withinCp: 50, maxLines: 5, level: "intermediate",
  player: "DrNykterstein", color: "white", speed: "blitz", band: "1600", minShare: 3,
};
const KEYS: Record<string, string> = { fens: START, lines: "e4 e5", username: "james" };

/* The producers that need Lichess, and the ones that need the model. */
const LICHESS = ["rowsMasterMoves", "rowsMasterGames", "rowsPlayerMoves", "rowsPlayerGames", "rowsRatedMoves"];
const MODEL = ["rowsPositionPlans", "rowsLinePlans"];

/** The producer a view reads, found by the anchor label and relationship its MATCH names. */
function producerOf(v: ViewSpec) {
  const m = v.cypher.match(/MATCH \(\w+:(\w+)[^)]*\)-\[:(\w+)\]->/);
  if (!m) throw new Error(`${v.name} has no relationship to read`);
  const found = PRODUCERS.filter((p) => p.joins.some((j) => j.anchorLabel === m[1] && j.relationship === m[2]));
  expect(found, v.name).toHaveLength(1);
  return found[0];
}

/** The key a view's MATCH anchors on, as the host would send it. */
function keyOf(v: ViewSpec): string {
  const param = v.cypher.match(/MATCH \(\w+:\w+ \{\w+: \$(\w+)\}\)/)![1];
  return String(PARAMS[param]);
}

function setup() {
  const clock: Clock = { now: T0 };
  const db = new FakeDb();
  const lichess = Object.fromEntries(["lichess_mastersExplorer", "lichess_playerExplorer", "lichess_lichessExplorer", "wikibooks_wikibooksQuery"].map((k) => [k, apiRefusal]));
  const host = realmHost(db, { engine: fakeEngine(clock).analyse, apis: lichess, clock });
  const fetch = (p: ProducerDeclaration, key: string, extra: Record<string, unknown> = {}) =>
    fetchProducer({ module: buildGuest(), handler: p.handler, keyArgument: p.keyArgument, keys: [key], db, host, clock, tickMs: TICK, extra });
  return { clock, db, host, fetch };
}

describe("every producer's declared shape", () => {
  it.each(PRODUCERS.map((p) => [p.name, p] as const))("%s declares the output its paging asks for", (_name, p) => {
    const schema = manifest.entries.find((e) => e.name === handlerName(p))!.outputSchema;
    if (p.page) expect(schema.type, p.handler).toBe("object");
    else expect(schema, p.handler).toEqual({ type: "array", items: { type: "object" } });
  });
});

describe.skipIf(!hasTooling)("every producer, in the guest", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((f: () => void) => {
      f();
      return 0;
    }) as unknown as typeof setTimeout);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(PRODUCERS.map((p) => [p.name, p] as const))("%s answers the host's shape, and its fetch is not refused", async (_name, p) => {
    const s = setup();
    s.db.begin();
    const d = dispatch(buildGuest(), p.handler, { [p.keyArgument]: [KEYS[p.keyArgument]] }, { host: s.host, clock: () => (s.clock.now += TICK) });
    s.db.rollback();
    expect(d.error, p.handler).toBeUndefined();
    if (p.page) expect(isPage(d.result), `${p.handler} answers { rows, next }`).toBe(true);
    else expect(isRowList(d.result), `${p.handler} answers a plain list of rows`).toBe(true);
    const f = await s.fetch(p, KEYS[p.keyArgument]);
    expect(f.refused, `${p.handler} ${f.error ?? ""}`).toBeUndefined();
  });

  it("the host's model refuses the wrong shape either way", async () => {
    const s = setup();
    const wrong = `export const unpagedAsPage = async () => ({ rows: [], next: null });\nexport const pagedAsList = async () => [];\n`;
    const module = buildGuest(wrong);
    const at = (handler: string, page: boolean) => ({ name: "x", handler: `chess.${handler}`, keyArgument: "fens", ...(page ? { page: { argument: "cursor", maxPages: 16 } } : {}) });
    expect((await fetchProducer({ module, handler: "chess.unpagedAsPage", keyArgument: "fens", keys: [START], db: s.db, host: s.host, clock: s.clock, declaration: at("unpagedAsPage", false) })).refused).toBe("RESULT_NOT_OBJECT");
    expect((await fetchProducer({ module, handler: "chess.pagedAsList", keyArgument: "fens", keys: [START], db: s.db, host: s.host, clock: s.clock, declaration: at("pagedAsList", true) })).refused).toBe("PAGE_SHAPE");
  });

  it("every view answers through its producer, and each empty column is explained by ChessStatus", async () => {
    const s = setup();
    const empty: string[] = [];
    for (const v of VIEWS.filter((x) => x !== STATUS_VIEW)) {
      const p = producerOf(v);
      const params = Object.fromEntries(Object.keys(v.params ?? {}).map((k) => [k, PARAMS[k]]));
      expect(parseView(v.cypher).columns.length, v.name).toBeGreaterThan(0);
      const extra = Object.fromEntries((p.pushdown ?? []).filter((d) => d.property in params).map((d) => [d.argument, [params[d.property]]]));
      const f = await s.fetch(p, keyOf(v), extra);
      expect(f.refused, `${v.name} through ${p.name}: ${f.error ?? ""}`).toBeUndefined();
      const rows = runView(v, params, f.rows);
      const name = handlerName(p);
      if (LICHESS.includes(name) || MODEL.includes(name)) {
        expect(rows, v.name).toEqual([]);
        empty.push(name);
      }
    }
    expect(new Set(empty)).toEqual(new Set([...LICHESS, ...MODEL]));
    const statusProducer = producerOf(STATUS_VIEW);
    expect(statusProducer.page, "chess-status has no page").toBeUndefined();
    const status = await s.fetch(statusProducer, "james");
    expect(status.refused, status.error).toBeUndefined();
    expect(runView(STATUS_VIEW, {}, status.rows)).toEqual([{ lichess: "refused", model: "not_granted", lastRefusal: expect.any(String), at: expect.any(String) }]);
  });
});

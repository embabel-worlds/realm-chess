import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runView } from "../wasm/lib/cypher";
import { titlesOfSans, theoryTitles } from "../wasm/lib/theory";
import { VIEWS } from "../wasm/lib/views";
import { realEngine, STOCKFISH } from "./guest/engine";
import { nodeLib } from "./impl";
import { fakeEngine } from "./guest/fakes";
import { FakeDb, realmHost } from "./guest/host";
import { RUY_THEORY, wikibooksAnswers } from "./fixtures/lichess";
import type { Clock } from "./guest/producer";
import { buildGuest, dispatch, hasTooling } from "./guest/runtime";

/*
 * How long chess.appPosition takes, stage by stage, over the first game played on the appliance:
 * 80 plies, each asked once fresh and once again, as the page asks on every step. The guest times
 * its own stages with the host's clock through wasm/lib/timing.ts, which a test-only entry turns
 * on; the realm's own verbs never read or print it.
 *
 * MEASURE=1 prints the per-stage medians for the first and last ten plies (with the real engine
 * when the stockfish module is there). Without it, the tests check that stepping through the game
 * answers what playing each line from the start answers, and that a repeated call makes the same
 * reads at the end of the game as at the start, with no board work.
 */

/* The appliance's game 2, 1. d4 d5 2. c4 e6 3. Nc3 Nf6 then the realm's top move each side. */
export const GAME =
  "d4 d5 c4 e6 Nc3 Nf6 cxd5 Nxd5 Nf3 Nxc3 bxc3 c5 e3 Qc7 Rb1 Be7 Bd3 b6 e4 cxd4 cxd4 O-O Qe2 Qc3+ Bd2 Qa3 h4 Ba6 Bxa6 Qxa6 " +
  "h5 Qxa2 O-O Qa6 Rb5 h6 Ne5 Kh8 d5 exd5 exd5 Bd6 Rc1 Qa4 Rc8 Rxc8 Nxf7+ Kh7 Nxd6 Rf8 Rb4 Qd7 Bf4 Na6 Qxa6 Rxf4 Rxf4 Qxd6 " +
  "Rd4 Rd8 g3 Qc5 Qd3+ Kh8 d6 Qxh5 d7 Qe5 Qc4 Qe7 Rd1 a5 Kh2 Kh7 Qc6 Qf6 Qe4+ Qg6 Qd5 a4";

const PROFILED = `${readFileSync("wasm/handlers.ts", "utf8")}
import { timing } from "./lib/timing.ts";
export const profiledAppPosition = async (input, ctx) => {
  timing.on = true;
  const started = Date.now();
  const reply = await appPosition(input, ctx);
  return { reply, stages: timing.stages, handlerMs: Date.now() - started };
};
`;

export interface Profile {
  ply: number;
  /** The whole dispatch as the host sees it: a fresh instance, the module's start, the handler. */
  wallMs: number;
  handlerMs: number;
  stages: Record<string, number>;
  replyBytes: number;
}

/** Each ply of the game, as the page asks it: the position before that ply and the moves that reached it. */
export function plies(game = GAME): { ply: number; fen: string; moves: string }[] {
  const sans = game.split(" ");
  const c = new Chess();
  const out = [{ ply: 1, fen: c.fen(), moves: "" }];
  for (let i = 0; i < sans.length - 1; i++) {
    c.move(sans[i]);
    out.push({ ply: i + 2, fen: c.fen(), moves: sans.slice(0, i + 1).join(" ") });
  }
  return out;
}

interface Reply {
  fen: string;
  views: Record<string, { rows: Record<string, unknown>[]; error?: string; skipped?: string }>;
  status: Record<string, string>;
}

function setup(engine: "real" | "fake") {
  const clock: Clock = { now: Date.now() };
  const db = new FakeDb();
  const host = realmHost(db, {
    // A fake engine answers two-ply lines, so the checks do not pay for reading long ones.
    engine: engine === "real" ? realEngine() : fakeEngine(clock, { plies: 2 }).analyse,
    // The wikibook has pages for the game's first six plies, and theory is kept like the rest.
    apis: { wikibooks_wikibooksQuery: wikibooksAnswers(titlesOfSans(GAME.split(" ").slice(0, 6)), RUY_THEORY) },
  });
  const module = buildGuest(PROFILED);
  const ask = (ply: number, fen: string, moves: string): Profile & { reply: Reply; statements: string[] } => {
    const before = db.statements.length;
    db.begin();
    const started = performance.now();
    const d = dispatch(module, "chess.profiledAppPosition", moves ? { fen, moves } : { fen }, { host });
    const wallMs = performance.now() - started;
    if (d.error !== undefined) {
      db.rollback();
      throw new Error(d.error);
    }
    db.commit();
    const r = d.result as { reply: Reply; stages: Record<string, number>; handlerMs: number };
    return {
      ply, wallMs: Math.round(wallMs), handlerMs: r.handlerMs, stages: r.stages, replyBytes: Buffer.byteLength(JSON.stringify(r.reply)),
      reply: r.reply, statements: db.statements.slice(before),
    };
  };
  return { ask, host, db };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Median of every stage, and of the totals, over some plies. */
export function summary(ps: Profile[]) {
  const names = [...new Set(ps.flatMap((p) => Object.keys(p.stages)))].sort();
  return {
    wallMs: median(ps.map((p) => p.wallMs)),
    handlerMs: median(ps.map((p) => p.handlerMs)),
    replyBytes: median(ps.map((p) => p.replyBytes)),
    stages: Object.fromEntries(names.map((n) => [n, median(ps.map((p) => p.stages[n] ?? 0))])),
  };
}

describe.skipIf(!hasTooling)("appPosition over a whole game, in the guest", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((f: () => void) => {
      f();
      return 0;
    }) as unknown as typeof setTimeout);
  });
  afterEach(() => vi.restoreAllMocks());

  it("stepping through the game answers each line's opening as playing it from the start does, and a repeat answers the same", async () => {
    const s = setup("fake");
    const opening = VIEWS.find((v) => v.name === "OpeningOfLine")!;
    for (const p of plies()) {
      await new Promise((r) => setImmediate(r));
      const step = s.ask(p.ply, p.fen, p.moves);
      expect(Object.values(step.reply.views).filter((v) => v.error), `ply ${p.ply}`).toEqual([]);
      if (p.moves) {
        const hit = nodeLib.openingOfLine(p.moves.split(" "));
        const expected = hit ? [{ line: p.moves, fen: hit.fen, eco: hit.eco, name: hit.name, pgn: hit.pgn, namedAtPly: hit.namedAtPly, pliesPast: hit.pliesPast }] : [];
        expect(step.reply.views.OpeningOfLine.rows, `ply ${p.ply}`).toEqual(runView(opening, { moves: p.moves }, expected));
      }
      const again = s.ask(p.ply, p.fen, p.moves);
      expect(again.reply, `ply ${p.ply}`).toEqual(step.reply);
    }
    // A line asked cold, with nothing kept, answers what the steps answered.
    const last = plies().at(-1)!;
    const cold = setup("fake").ask(last.ply, last.fen, last.moves);
    expect(cold.reply.views).toEqual(s.ask(last.ply, last.fen, last.moves).reply.views);
  }, 300_000);

  it("a repeated call makes the same reads at ply 80 as at ply 3, and does no board work", () => {
    const s = setup("fake");
    const [, , second] = plies();
    const last = plies().at(-1)!;
    const repeats = [second, last].map((p) => {
      s.ask(p.ply, p.fen, p.moves);
      return s.ask(p.ply, p.fen, p.moves);
    });
    const shape = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "?");
    expect(repeats[1].statements.map(shape)).toEqual(repeats[0].statements.map(shape));
    for (const r of repeats) {
      expect(r.statements.every((q) => /^\s*SELECT\b/i.test(q)), "a repeat only reads").toBe(true);
      for (const work of ["imbalances", "skeletons", "structure", "search", "candidateRows"]) expect(r.stages, work).not.toHaveProperty(work);
    }
  }, 60_000);

  it("a line is kept under the board's SAN: a loose spelling of the same moves adds no row", () => {
    const s = setup("fake");
    const fen = plies()[2].fen;
    s.ask(3, fen, "d4 d5");
    for (const loose of ["d2d4 d7d5", "d2-d4 d5", "d4 d7d5"]) {
      const r = s.ask(3, fen, loose);
      expect(Object.values(r.reply.views).filter((v) => v.error)).toEqual([]);
    }
    expect(s.db.exec("SELECT line_key FROM game_lines").map((r) => r.line_key)).toEqual(["d4 d5"]);
  }, 60_000);

  it("the theory titles from the board's own SAN are the titles a replay gives, at every ply", () => {
    const sans = GAME.split(" ");
    for (let n = 1; n <= sans.length; n++) expect(titlesOfSans(sans.slice(0, n))).toEqual(theoryTitles(sans.slice(0, n)));
  });

  it.skipIf(!process.env.MEASURE)("prints the stages of a fresh and a repeated call, early and late in the game", async () => {
    const s = setup(STOCKFISH ? "real" : "fake");
    const fresh: Profile[] = [];
    const repeat: Profile[] = [];
    for (const p of plies()) {
      await new Promise((r) => setImmediate(r));
      fresh.push(s.ask(p.ply, p.fen, p.moves));
      repeat.push(s.ask(p.ply, p.fen, p.moves));
    }
    const early = (ps: Profile[]) => ps.filter((p) => p.ply <= 10);
    const late = (ps: Profile[]) => ps.filter((p) => p.ply > 70);
    console.log(JSON.stringify({
      engine: STOCKFISH ? "real" : "fake",
      fresh: { all: summary(fresh), early: summary(early(fresh)), late: summary(late(fresh)) },
      repeat: { all: summary(repeat), early: summary(early(repeat)), late: summary(late(repeat)) },
      repeatByPly: repeat.map((p) => [p.ply, p.wallMs]),
    }, null, 1));
    expect(repeat).toHaveLength(80);
  }, 1_200_000);
});

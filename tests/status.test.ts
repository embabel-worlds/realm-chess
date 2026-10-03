import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { readStatus, recordOutcome, type Outcome } from "../wasm/lib/status";
import type { Db } from "../wasm/lib/store";
import { chessHost, FakeDb } from "./guest/host";
import { buildGuest, call, dispatch, hasTooling } from "./guest/runtime";

/*
 * ChessStatus: what the realm could not do, as the guest recorded it. The handlers that call
 * Lichess and the model record their outcomes through recordOutcome; here a fake recorder plays
 * them, and the producer reads back what was recorded.
 */

const T0 = Date.parse("2026-10-03T09:00:00Z");
const store = (db: FakeDb): Db => ({ exec: async (sql) => db.exec(sql) });
const noEngine = () => {
  throw new Error("no engine here");
};

/* A test-only entry that records outcomes the way a handler would, inside the guest. */
const RECORDER = `
import { recordOutcome } from "./lib/status.ts";
export const record = async (input, ctx) => {
  for (const o of input.outcomes) await recordOutcome(ctx.deps.db, o);
  return null;
};
`;

describe("recording outcomes", () => {
  const after = async (outcomes: Outcome[]) => {
    const db = new FakeDb();
    for (const o of outcomes) await recordOutcome(store(db), o);
    return readStatus(store(db));
  };

  it("nothing recorded yet is unknown on every count", async () => {
    expect(await after([])).toEqual({ lichess: "unknown", model: "unknown", lastRefusal: "", at: "" });
  });

  it("a refused Lichess call says refused, with no cause beyond its code", async () => {
    expect(await after([{ source: "lichess", code: "UPSTREAM_REFUSED", at: T0 }])).toEqual({
      lichess: "refused", model: "unknown", lastRefusal: "UPSTREAM_REFUSED", at: "2026-10-03T09:00:00.000Z",
    });
  });

  it("a later success clears the state but keeps the last refusal code", async () => {
    const s = await after([
      { source: "lichess", code: "UPSTREAM_REFUSED", at: T0 },
      { source: "lichess", at: T0 + 1000 },
    ]);
    expect(s).toMatchObject({ lichess: "ok", lastRefusal: "UPSTREAM_REFUSED", at: "2026-10-03T09:00:01.000Z" });
  });

  it("a model without the grant is not_granted; a budget refusal says nothing about the grant", async () => {
    expect(await after([{ source: "model", code: "MODEL_NOT_GRANTED", at: T0 }])).toMatchObject({ model: "not_granted", lastRefusal: "MODEL_NOT_GRANTED" });
    expect(await after([
      { source: "model", at: T0 },
      { source: "model", code: "MODEL_CALL_BUDGET", at: T0 + 1 },
    ])).toMatchObject({ model: "ok", lastRefusal: "MODEL_CALL_BUDGET" });
  });

  it("each source keeps its own state", async () => {
    expect(await after([
      { source: "model", code: "MODEL_NOT_GRANTED", at: T0 },
      { source: "lichess", at: T0 + 1 },
    ])).toMatchObject({ lichess: "ok", model: "not_granted" });
  });

  it("writes only keyed upserts, so the host can replay them", async () => {
    const db = new FakeDb();
    await recordOutcome(store(db), { source: "lichess", at: T0 });
    for (const w of db.writes()) expect(w).toMatch(/^INSERT INTO chess_status .* ON CONFLICT\(owner\) DO UPDATE SET /s);
  });
});

describe.skipIf(!hasTooling)("chess.status, in the guest", () => {
  it("returns one row per username the host names, with what the guest recorded", () => {
    const db = new FakeDb();
    const host = chessHost(db, noEngine);
    call(buildGuest(RECORDER), "chess.record", { outcomes: [{ source: "lichess", code: "UPSTREAM_REFUSED", at: T0 }, { source: "model", at: T0 + 5 }] }, { host });
    expect(call(buildGuest(), "chess.status", { username: ["james"] }, { host })).toEqual([
      { username: "james", lichess: "refused", model: "ok", lastRefusal: "UPSTREAM_REFUSED", at: "2026-10-03T09:00:00.005Z" },
    ]);
  });

  it("a dispatch that died left nothing, so the status is unchanged", () => {
    const db = new FakeDb();
    const host = chessHost(db, noEngine);
    // The host publishes a dispatch's writes only when it succeeds.
    db.begin();
    const failing = `${RECORDER}\nexport const recordThenFail = async (input, ctx) => { await record(input, ctx); throw new Error("died"); };\n`;
    const d = dispatch(buildGuest(failing), "chess.recordThenFail", { outcomes: [{ source: "lichess", code: "X", at: T0 }] }, { host });
    expect(d.error).toBe("died");
    db.rollback();
    expect(call(buildGuest(), "chess.status", { username: ["james"] }, { host })).toMatchObject([{ lichess: "unknown", lastRefusal: "" }]);
  });

  it("refuses keys the host would never send", () => {
    const host = chessHost(new FakeDb(), noEngine);
    expect(() => call(buildGuest(), "chess.status", { username: [] }, { host })).toThrow("Invalid producer keys");
  });
});

describe("the declaration", () => {
  it("is user keyed: AssistantUser by username, the username returned as the record key", () => {
    const p = parse(readFileSync("producers/chess-status.yml", "utf8"));
    expect(p).toEqual({
      version: 1, name: "chess-status", handler: "chess.status", keyArgument: "username",
      joins: [{ anchorLabel: "AssistantUser", keyField: "username", recordKeyField: "username", relationship: "HAS_CHESS_STATUS", targetLabel: "ChessStatus" }],
    });
  });

  it("has a ChessStatus view with no params", () => {
    const views = parse(readFileSync("views/chess.yml", "utf8")) as { name: string; params?: unknown; cypher: string }[];
    const v = views.find((x) => x.name === "ChessStatus")!;
    expect(v.params).toBeUndefined();
    expect(v.cypher).toContain("[:HAS_CHESS_STATUS]->(s:ChessStatus)");
  });
});

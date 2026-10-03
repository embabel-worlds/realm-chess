import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { HostCall } from "./runtime";

/*
 * A stand-in for the appliance's side of a dispatch: the realm's SQLite, built from
 * db/schema.sql and the migrations realm.ts declares, handing every value back as text the way
 * the host does; and the engine dependency, either the real stockfish module or a fake.
 */

const ROOT = resolve(__dirname, "..", "..");
/** The migrations the host applies, in order: the ones synth wrote into dependencies/manifest.json. */
export const MIGRATIONS: string[] = JSON.parse(readFileSync(join(ROOT, "dependencies/manifest.json"), "utf8"))
  .entries.find((e: { name: string }) => e.name === "db").migrations;

export type Rows = Record<string, string | null>[];

export class FakeDb {
  readonly sqlite = new DatabaseSync(":memory:");
  readonly statements: string[] = [];

  constructor(migrations = MIGRATIONS) {
    this.sqlite.exec(readFileSync(join(ROOT, "db/schema.sql"), "utf8"));
    for (const m of migrations) this.sqlite.exec(readFileSync(join(ROOT, m), "utf8"));
  }

  exec(sql: string): Rows {
    this.statements.push(sql);
    const statement = this.sqlite.prepare(sql);
    if (statement.columns().length === 0) {
      statement.run();
      return [];
    }
    return (statement.all() as Record<string, unknown>[]).map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === null ? null : String(v)])),
    );
  }

  /*
   * A dispatch's writes are published only when it succeeds, as the host publishes a
   * persistent mount: begin before, commit after, roll back when it fails.
   */
  begin(): void {
    this.sqlite.exec("BEGIN");
  }
  commit(): void {
    this.sqlite.exec("COMMIT");
  }
  rollback(): void {
    this.sqlite.exec("ROLLBACK");
  }

  /** The statements that wrote, for checking every write is a keyed upsert. */
  writes(): string[] {
    return this.statements.filter((s) => !/^\s*SELECT\b/i.test(s));
  }
}

export type Analyse = (fen: string, nodes: number, maxDepth: number, multiPv: number) => string;

/**
 * How the host runs a batch of engine calls, for the fake clock: side by side on spare cores (the
 * batch takes as long as its longest search) or one after another (as long as all of them).
 */
export interface BatchModel { clock: { now: number }; parallel: boolean }

/**
 * Answers the host calls a chess dispatch makes, and counts the engine's searches. The engine
 * answers one call, or a batch (`{ batch: [[fen, nodes, depth, multiPv], ...] }`), one answer per
 * entry in order, as the host's batch form does.
 */
export function chessHost(db: FakeDb, engine: Analyse, batchModel?: BatchModel): HostCall & { searches: number; batches: number[] } {
  const host = ((tool: string, args: unknown) => {
    if (tool === "dep:db.exec") return db.exec((args as { sql: string }).sql);
    if (tool === "dep:engine.analyse") {
      const batch = (args as { batch?: [string, number, number, number][] }).batch;
      if (!batch) {
        host.searches++;
        const [fen, nodes, depth, multiPv] = args as [string, number, number, number];
        return engine(fen, nodes, depth, multiPv);
      }
      if (batch.length < 1 || batch.length > 256) throw new Error("A batch takes 1 to 256 calls");
      host.batches.push(batch.length);
      host.searches += batch.length;
      const start = batchModel?.clock.now ?? 0;
      let end = start;
      const out = batch.map(([fen, nodes, depth, multiPv]) => {
        if (batchModel?.parallel) batchModel.clock.now = start;
        const answer = engine(fen, nodes, depth, multiPv);
        end = Math.max(end, batchModel?.clock.now ?? 0);
        return answer;
      });
      if (batchModel) batchModel.clock.now = end;
      return out;
    }
    throw new Error(`unexpected host call ${tool}`);
  }) as HostCall & { searches: number; batches: number[] };
  host.searches = 0;
  host.batches = [];
  return host;
}

/** A host call the test answers: an API operation or the model. Throw to refuse; give the error a `code` to code it. */
export type Answer = (args: Record<string, unknown>) => unknown;

export interface RealmHostOptions {
  engine?: Analyse;
  /** API operations by host call name, `lichess_mastersExplorer` and so on. */
  apis?: Record<string, Answer>;
  model?: Answer;
  /** The guest's clock, so each call can be stamped with the time it was made. */
  clock?: { now: number };
  /** Whether a batch of engine calls runs side by side; needs `clock`. */
  parallelBatches?: boolean;
}

export interface CallRecord {
  tool: string;
  args: Record<string, unknown>;
  at: number;
}

/**
 * Answers every host call a chess dispatch makes: its SQLite, the engine, the declared APIs and
 * the model. Every call but SQLite's is recorded with the guest clock's time.
 */
export function realmHost(db: FakeDb, o: RealmHostOptions = {}): HostCall & { searches: number; batches: number[]; calls: CallRecord[]; count(tool: string): number } {
  const base = chessHost(db, o.engine ?? (() => {
    throw new Error("no engine in this test");
  }), o.clock ? { clock: o.clock, parallel: !!o.parallelBatches } : undefined);
  const host = ((tool: string, args: unknown) => {
    if (tool.startsWith("dep:")) {
      const r = base(tool, args);
      host.searches = base.searches;
      host.batches = base.batches;
      return r;
    }
    host.calls.push({ tool, args: args as Record<string, unknown>, at: o.clock?.now ?? Date.now() });
    if (tool === "ai_complete") {
      if (!o.model) throw Object.assign(new Error("refused"), { code: "MODEL_NOT_GRANTED" });
      return o.model(args as Record<string, unknown>);
    }
    const api = o.apis?.[tool];
    if (!api) throw new Error(`unexpected host call ${tool}`);
    return api(args as Record<string, unknown>);
  }) as HostCall & { searches: number; batches: number[]; calls: CallRecord[]; count(tool: string): number };
  host.searches = 0;
  host.batches = [];
  host.calls = [];
  host.count = (tool: string) => host.calls.filter((c) => c.tool === tool).length;
  return host;
}

/** A refusal as the host sends an API one: a message and no code, whatever the cause. */
export const apiRefusal = () => {
  throw new Error("The API call was refused");
};

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { positionKey } from "../wasm/lib/openings";
import { battery } from "./battery/battery";
import { FakeDb } from "./guest/host";
import { libs } from "./impl";

/*
 * The book is rows in the realm's SQLite. These hold it to a recorded digest: a SHA-256 of its
 * canonical JSON, its entry counts, and a few named entries, all kept in fixtures/book-digest.json.
 */

type Digest = {
  book: { entries: number; sha256: string };
  skeletons: { entries: number; sha256: string };
  structures: Record<string, unknown>;
  lines: Record<string, unknown>;
};
const digest = JSON.parse(readFileSync("tests/fixtures/book-digest.json", "utf8")) as Digest;

/* The same JSON with every object's keys in sorted order, so the hash does not depend on row order. */
const sorted = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])]))
      : v;
const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(sorted(v))).digest("hex");

/* Every battery position, and every position along each battery line: openings, middlegames, endgames. */
const positions = (() => {
  const out = new Set<string>();
  for (const p of battery()) {
    out.add(p.fen);
    if (!p.moves) continue;
    const c = new Chess();
    for (const m of p.moves.split(/\s+/)) {
      c.move(m);
      out.add(c.fen());
    }
  }
  return [...out];
})();

describe("db/schema.sql", () => {
  const schema = readFileSync("db/schema.sql");

  it("is the file installed realms hold: a changed init script locks them out of their database", () => {
    expect(createHash("sha256").update(schema).digest("hex")).toBe(
      "38f0d1b930a1a273c8048475c3a2c46f5b23fcbc0036f3759a6639b2de519b61",
    );
  });

  it("creates the kept-result tables and the book's tables with the design's columns, and no rows", () => {
    expect(schema.toString()).not.toMatch(/\bINSERT\b/i);
    const db = new FakeDb([]);
    const columns = (table: string) => db.exec(`SELECT name FROM pragma_table_info('${table}') ORDER BY cid`).map((r) => r.name);
    expect(columns("analyses")).toEqual(["fen", "config_key", "analysis_id", "depth", "nodes", "lines_json", "records_json", "elapsed_ms", "created_at"]);
    expect(columns("plans")).toEqual(["identity", "kind", "fen_or_line", "analysis_id", "inputs_hash", "skill_sha", "plans_json", "created_at"]);
    expect(columns("theory")).toEqual(["line_key", "title", "extract", "url", "text_sha", "fetched_at", "found"]);
    expect(columns("explorer")).toEqual(["request_key", "operation", "fen", "filters_json", "response_json", "fetched_at"]);
    expect(columns("openings")).toEqual(["position_key", "eco", "name", "pgn"]);
    expect(columns("skeletons")).toEqual(["pawns_key", "families_json", "names_json"]);
    for (const t of ["analyses", "plans", "theory", "explorer", "openings", "skeletons"]) {
      expect(db.exec(`SELECT count(*) AS n FROM ${t}`)[0].n, t).toBe("0");
    }
  });

  it("gives every table a full unique key, so every write can be a keyed upsert", () => {
    const db = new FakeDb([]);
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name as string);
    for (const t of tables) {
      const keyed = db.exec(`SELECT 1 FROM pragma_index_list('${t}') WHERE "unique" = 1 AND "partial" = 0`);
      expect(keyed.length, t).toBeGreaterThan(0);
    }
  });
});

describe("the book as migrations", () => {
  it("ships in two scripts, each well under the host's 1 MiB per script", () => {
    for (const f of ["db/0001-openings.sql", "db/0002-skeletons.sql"]) expect(statSync(f).size).toBeLessThan(800_000);
  });

  it("holds the recorded book: its entry count and digest", () => {
    const db = new FakeDb();
    const rows = db.exec("SELECT position_key, eco, name, pgn FROM openings");
    expect(rows).toHaveLength(digest.book.entries);
    const book = Object.fromEntries(rows.map((r) => [r.position_key, { eco: r.eco, name: r.name, pgn: r.pgn }]));
    expect(Object.keys(book)).toHaveLength(digest.book.entries);
    expect(sha(book)).toBe(digest.book.sha256);
  });

  it("names the Ruy Lopez Exchange, the Najdorf, and nothing at the start position", () => {
    const db = new FakeDb();
    const named = (fen: string) => {
      const key = positionKey(fen);
      const rows = db.exec(`SELECT eco, name FROM openings WHERE position_key = '${key}'`);
      return rows.length ? { eco: rows[0].eco, name: rows[0].name } : null;
    };
    expect(named("r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4")).toEqual({ eco: "C68", name: "Ruy Lopez: Exchange Variation" });
    expect(named("rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6")).toEqual({ eco: "B90", name: "Sicilian Defense: Najdorf Variation" });
    expect(named(new Chess().fen())).toBeNull();
  });

  it("keeps every family and every name of each skeleton, so a shared skeleton is still seen as shared", () => {
    const db = new FakeDb();
    const rows = db.exec("SELECT pawns_key, families_json, names_json FROM skeletons");
    expect(rows).toHaveLength(digest.skeletons.entries);
    const skeletons = Object.fromEntries(
      rows.map((r) => [r.pawns_key, { families: JSON.parse(r.families_json as string), names: JSON.parse(r.names_json as string) }]),
    );
    expect(sha(skeletons)).toBe(digest.skeletons.sha256);
  });
});

describe.each(libs)("$name: structure and line names answer as recorded", ({ structureOf: structureFromBook, openingOfLine: lineFromBook }) => {
  it(`structureOf gives the recorded answer over ${positions.length} positions, ambiguous skeletons and near matches included`, () => {
    expect(Object.keys(digest.structures).sort()).toEqual([...positions].sort());
    let near = 0, none = 0;
    for (const fen of positions) {
      const expected = digest.structures[fen] as { pawnsDifferent: number } | null;
      expect(structureFromBook(fen), fen).toEqual(expected);
      if (expected === null) none++;
      else if (expected.pawnsDifferent > 0) near++;
    }
    // The sample has to exercise every branch to mean anything.
    expect(near).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
  });

  it("the starting pawns, shared by many families, name no structure", () => {
    expect(structureFromBook(new Chess().fen())).toBeNull();
  });

  it("openingOfLine gives the recorded answer along every battery line", () => {
    for (const p of battery().filter((b) => b.moves)) {
      expect(lineFromBook(p.moves!.split(/\s+/)) ?? null, p.id).toEqual(digest.lines[p.id]);
    }
  });
});

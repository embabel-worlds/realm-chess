import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { openingOfLine, structureOf, type Book, type Skeletons } from "../wasm/lib/openings";
import { baselineJson } from "./baseline/rod";
import { battery } from "./battery/battery";
import { FakeDb } from "./guest/host";
import { libs } from "./impl";

/*
 * The book moved from JSON files beside the bundle to rows in the realm's SQLite. These hold the
 * move to the answers Rod's realm gave at 86b5bb5, with his own built files as the reference.
 */

const rodBook = baselineJson<Book>("dist/data/openings.json");
const rodSkeletons = baselineJson<Skeletons>("dist/data/skeletons.json");

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
      "a5155b917fc5ba9dceab12234365a1c8307865c3cc777f1f08f21e069f93d301",
    );
  });

  it("creates the kept-result tables and the book's tables with the design's columns, and no rows", () => {
    expect(schema.toString()).not.toMatch(/\bINSERT\b/i);
    const db = new FakeDb([]);
    const columns = (table: string) => db.exec(`SELECT name FROM pragma_table_info('${table}') ORDER BY cid`).map((r) => r.name);
    expect(columns("analyses")).toEqual(["fen", "config_key", "analysis_id", "depth", "nodes", "lines_json", "elapsed_ms", "created_at"]);
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

  it("holds every named position of Rod's book", () => {
    const db = new FakeDb();
    const rows = db.exec("SELECT position_key, eco, name, pgn FROM openings");
    expect(rows).toHaveLength(Object.keys(rodBook).length);
    const book = Object.fromEntries(rows.map((r) => [r.position_key, { eco: r.eco, name: r.name, pgn: r.pgn }]));
    expect(book).toEqual(rodBook);
  });

  it("keeps every family and every name of each skeleton, so a shared skeleton is still seen as shared", () => {
    const db = new FakeDb();
    const rows = db.exec("SELECT pawns_key, families_json, names_json FROM skeletons");
    expect(rows).toHaveLength(Object.keys(rodSkeletons).length);
    for (const r of rows) {
      const rod = rodSkeletons[r.pawns_key as string];
      const families = JSON.parse(r.families_json as string) as string[];
      const names = JSON.parse(r.names_json as string) as { name: string }[];
      expect(families.length, r.pawns_key as string).toBe(rod.families);
      expect(names.slice(0, 6)).toEqual(rod.openings);
    }
  });
});

describe.each(libs)("$name: structure and line names answer as at 86b5bb5", ({ structureOf: structureFromBook, openingOfLine: lineFromBook }) => {
  it(`structureOf matches Rod's over ${positions.length} positions, ambiguous skeletons and near matches included`, () => {
    let near = 0, none = 0;
    for (const fen of positions) {
      const rod = structureOf(fen, rodSkeletons);
      expect(structureFromBook(fen), fen).toEqual(rod);
      if (rod === null) none++;
      else if (rod.pawnsDifferent > 0) near++;
    }
    // The sample has to exercise every branch to mean anything.
    expect(near).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
  });

  it("the starting pawns, shared by many families, name no structure", () => {
    expect(structureFromBook(new Chess().fen())).toBeNull();
  });

  it("openingOfLine matches Rod's along every battery line", () => {
    for (const p of battery().filter((b) => b.moves)) {
      const moves = p.moves!.split(/\s+/);
      expect(lineFromBook(moves), p.id).toEqual(openingOfLine(moves, rodBook));
    }
  });
});

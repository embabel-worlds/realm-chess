/*
 * The opening book, as SQL for the realm's SQLite: db/0001-openings.sql holds every named
 * position and db/0002-skeletons.sql every pawn skeleton. Both are migrations, so the book can
 * grow without touching db/schema.sql. Run by `npm run build`; the output is committed.
 *
 * The keys must be computed exactly as wasm/lib/openings.ts computes them; both drop an en
 * passant square no capture can use.
 */
import { Chess } from "chess.js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function bookLines(file = "data/openings.tsv") {
  return readFileSync(file, "utf8").trim().split("\n").slice(1).map((line) => {
    const [eco, name, pgn] = line.split("\t");
    return { eco, name, pgn };
  });
}

/* Where two lines reach one position, the longer name wins: it is the more specific one. */
export function buildBook(lines) {
  const book = {};
  for (const { eco, name, pgn } of lines) {
    const c = new Chess();
    c.loadPgn(pgn);
    const [board, turn, castling, ep] = c.fen().split(" ");
    const epLegal = ep !== "-" && c.moves({ verbose: true }).some((m) => m.flags.includes("e"));
    const key = `${board} ${turn} ${castling} ${epLegal ? ep : "-"}`;
    if (!book[key] || book[key].name.length < name.length) book[key] = { eco, name, pgn };
  }
  return book;
}

/*
 * Pawn skeletons: the pawns alone. Pawn structure decides plans, and a position a few piece
 * moves past the book usually still has the pawns of a named line. Each row keeps every family
 * (the name before the colon) and every name, shortest first, so the handler can tell a
 * structure many families share from one that names something.
 */
export function buildSkeletons(lines) {
  const skeletons = {};
  for (const { eco, name, pgn } of lines) {
    const c = new Chess();
    c.loadPgn(pgn);
    const pawns = [];
    for (const row of c.board()) for (const p of row) if (p && p.type === "p") pawns.push(p.color + p.square);
    (skeletons[pawns.sort().join(" ")] ??= []).push({ eco, name });
  }
  const out = {};
  for (const [key, entries] of Object.entries(skeletons)) {
    const seen = new Set();
    out[key] = {
      families: [...new Set(entries.map((e) => e.name.split(":")[0]))].sort(),
      names: entries.sort((a, b) => a.name.length - b.name.length).filter((e) => (seen.has(e.name) ? false : seen.add(e.name))),
    };
  }
  return out;
}

const text = (v) => `'${String(v).replaceAll("'", "''")}'`;

function inserts(table, columns, rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200).map((r) => `(${r.map(text).join(", ")})`).join(",\n");
    out.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${chunk};`);
  }
  return out.join("\n");
}

export function bookSql(lines) {
  const book = buildBook(lines);
  const skeletons = buildSkeletons(lines);
  const openings = `-- The Lichess opening book (CC0), one row per named position. Written by scripts/book.mjs.\n${
    inserts("openings", ["position_key", "eco", "name", "pgn"], Object.entries(book).map(([k, e]) => [k, e.eco, e.name, e.pgn]))}\n`;
  const pawns = `-- Pawn skeletons of every book line, with every family and name. Written by scripts/book.mjs.\n${
    inserts("skeletons", ["pawns_key", "families_json", "names_json"],
      Object.entries(skeletons).map(([k, s]) => [k, JSON.stringify(s.families), JSON.stringify(s.names)]))}\n`;
  return { openings, pawns, positions: Object.keys(book).length, skeletons: Object.keys(skeletons).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lines = bookLines();
  const { openings, pawns, positions, skeletons } = bookSql(lines);
  writeFileSync("db/0001-openings.sql", openings);
  writeFileSync("db/0002-skeletons.sql", pawns);
  console.log(`opening book: ${positions} positions from ${lines.length} lines, ${Buffer.byteLength(openings)} bytes`);
  console.log(`pawn skeletons: ${skeletons}, ${Buffer.byteLength(pawns)} bytes`);
}

/*
 * The sandbox is seeded with dist/ and nothing else — node_modules never reaches it. So each
 * handler namespace is bundled with its imports (chess.js) into one CommonJS file, and the
 * engine's two files are copied beside it, where src/lib/engine.ts requires them at runtime.
 */
import { build } from "esbuild";
import { Chess } from "chess.js";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

rmSync("dist", { recursive: true, force: true });
const entries = readdirSync("src/api").filter((f) => f.endsWith(".ts")).map((f) => join("src/api", f));
await build({
  entryPoints: entries,
  outdir: "dist/api",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  logLevel: "warning",
});
writeFileSync("dist/package.json", JSON.stringify({ type: "commonjs" }));
const bin = "node_modules/stockfish/bin";
mkdirSync("dist/engine", { recursive: true });
for (const f of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) copyFileSync(join(bin, f), join("dist/engine", f));
copyFileSync("node_modules/stockfish/Copying.txt", "dist/engine/COPYING");

/*
 * The opening book, keyed by position. Built here rather than at runtime so a lookup is one map
 * read. The key must be computed exactly as src/lib/openings.ts computes it; both drop an en
 * passant square no capture can use. Where two lines reach one position, the longer name wins:
 * it is the more specific one.
 */
const book = {};
const lines = readFileSync("data/openings.tsv", "utf8").trim().split("\n").slice(1);
for (const line of lines) {
  const [eco, name, pgn] = line.split("\t");
  const c = new Chess();
  c.loadPgn(pgn);
  const [board, turn, castling, ep] = c.fen().split(" ");
  const epLegal = ep !== "-" && c.moves({ verbose: true }).some((m) => m.flags.includes("e"));
  const key = `${board} ${turn} ${castling} ${epLegal ? ep : "-"}`;
  if (!book[key] || book[key].name.length < name.length) book[key] = { eco, name, pgn };
}
mkdirSync("dist/data", { recursive: true });
writeFileSync("dist/data/openings.json", JSON.stringify(book));

/*
 * Pawn skeletons: the pawns alone, keyed exactly as src/lib/openings.ts keys them. Pawn
 * structure decides plans, and a position a few piece moves past the book usually still has
 * the pawns of a named line — so this answers "which opening's structure is this" where the
 * position itself is not in the book. At most six names per skeleton, the shortest first: the
 * family name is the useful one.
 */
const skeletons = {};
for (const line of lines) {
  const [eco, name, pgn] = line.split("\t");
  const c = new Chess();
  c.loadPgn(pgn);
  const pawns = [];
  for (const row of c.board()) for (const p of row) if (p && p.type === "p") pawns.push(p.color + p.square);
  const key = pawns.sort().join(" ");
  (skeletons[key] ??= []).push({ eco, name });
}
for (const k of Object.keys(skeletons)) {
  const seen = new Set();
  // A family is the name before the colon: "Ruy Lopez", "Sicilian Defense". A skeleton that many
  // families share — the starting pawns, 1.e4 e5 — names no structure, and the count says so.
  const families = new Set(skeletons[k].map((e) => e.name.split(":")[0])).size;
  const openings = skeletons[k].sort((a, b) => a.name.length - b.name.length)
    .filter((e) => (seen.has(e.name) ? false : seen.add(e.name))).slice(0, 6);
  skeletons[k] = { families, openings };
}
writeFileSync("dist/data/skeletons.json", JSON.stringify(skeletons));
console.log(`pawn skeletons: ${Object.keys(skeletons).length}`);
console.log(`opening book: ${Object.keys(book).length} positions from ${lines.length} lines`);

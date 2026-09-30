/*
 * The sandbox is seeded with dist/ and nothing else — node_modules never reaches it. So each
 * handler namespace is bundled with its imports (chess.js) into one CommonJS file, and the
 * engine's two files are copied beside it, where src/lib/engine.ts requires them at runtime.
 */
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

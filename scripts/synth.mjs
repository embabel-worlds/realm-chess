/*
 * Writes the realm's declaration files from realm.ts with the SDK's synth, found beside the
 * installed @embabel/realm-types package so it is the same SDK the definition is typed against.
 * It runs under Bun.
 *
 * Synth clears the directory it writes to, so it writes to a fresh temporary one and only the
 * files it generates are copied back here. Pointing it at the realm itself would delete the
 * realm's sources and its .git.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* What synth writes. Everything else in its output is a copy of a source file already here. */
const GENERATED = ["realm.yml", "credentials.yml", "apis/apis.yml", "producers", "types", "views", "dependencies", "dist/manifest.json"];

const types = realpathSync("node_modules/@embabel/realm-types");
const cli = join(types, "..", "realm-synth", "src", "cli.ts");
const out = mkdtempSync(join(tmpdir(), "realm-chess-synth-"));
try {
  const run = spawnSync("bun", [cli, "realm.ts", "--out", out, ...process.argv.slice(2)], { stdio: ["inherit", "ignore", "inherit"] });
  if (run.status !== 0) process.exit(run.status ?? 1);
  for (const dir of ["producers", "types", "views", "dependencies"]) rmSync(dir, { recursive: true, force: true });
  for (const path of GENERATED) cpSync(join(out, path), path, { recursive: true });
  console.log(`synth: ${GENERATED.join(", ")}`);
} finally {
  rmSync(out, { recursive: true, force: true });
}

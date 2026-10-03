/*
 * Writes the realm's declaration files from realm.ts with the SDK's synth, found beside the
 * installed @embabel/realm-types package so it is the same SDK the definition is typed against.
 * It runs under Bun.
 *
 * Synth clears the directory it writes to, so it writes to a fresh temporary one and only the
 * files it generates are copied back here. Pointing it at the realm itself would delete the
 * realm's sources and its .git. Synth also leaves a record of what it wrote in its output
 * (.realm-synth-output.json); that stays in the temporary directory with everything else.
 *
 * The generated types go to wasm/generated/realm.ts. It is a .ts file because it carries a value
 * as well as types: the digest of each skill folder, which the plan handlers key their kept plans on.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/* What synth writes. Everything else in its output is a copy of a source file already here. */
const GENERATED = [
  "realm.yml", "credentials.yml", "apis/apis.yml", "producers", "types", "views", "dependencies", "dist/manifest.json", "dist/skills.json",
];
const TYPES = "wasm/generated/realm.ts";

const types = realpathSync("node_modules/@embabel/realm-types");
const cli = join(types, "..", "realm-synth", "src", "cli.ts");
const out = mkdtempSync(join(tmpdir(), "realm-chess-synth-"));
try {
  const run = spawnSync("bun", [cli, "realm.ts", "--out", join(out, "realm"), "--types", join(out, "realm.ts"), ...process.argv.slice(2)], {
    stdio: ["inherit", "ignore", "inherit"],
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
  for (const dir of ["producers", "types", "views", "dependencies"]) rmSync(dir, { recursive: true, force: true });
  for (const path of GENERATED) cpSync(join(out, "realm", path), path, { recursive: true });
  mkdirSync(dirname(TYPES), { recursive: true });
  cpSync(join(out, "realm.ts"), TYPES);
  console.log(`synth: ${[...GENERATED, TYPES].join(", ")}`);
} finally {
  rmSync(out, { recursive: true, force: true });
}

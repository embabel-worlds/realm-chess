import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BASELINE } from "./rod";

/*
 * The Node realm's own handlers, as Rod built them into dist/api/chess.js at 86b5bb5, loaded
 * from git into a scratch folder with the data files beside them. A test hands them a gateway
 * of fakes and compares what they return with what the captured realm returns from the same
 * answers.
 */

const ROOT = resolve(__dirname, "..", "..");

export type Fn = (ctx: unknown, args: unknown) => Promise<unknown>;

export interface RodApi {
  mastersAtPosition: Fn;
  playerAtPosition: Fn;
  ratedMoves: Fn;
  theoryOfGameLine: Fn;
  explainPlans: Fn;
  explainLinePlans: Fn;
}

let api: RodApi | undefined;

export function rodBundle(): RodApi {
  if (api) return api;
  const dir = mkdtempSync(join(tmpdir(), "realm-chess-rod-"));
  execFileSync("sh", ["-c", `git archive ${BASELINE} dist | tar -x -C '${dir}'`], { cwd: ROOT });
  api = createRequire(join(dir, "dist", "api", "chess.js"))(join(dir, "dist", "api", "chess.js")) as RodApi;
  return api;
}

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parse } from "yaml";

/*
 * Rod's Node realm as it was at 86b5bb5, read straight from git, so the captured realm is held
 * to the files he shipped and not to a copy that could drift.
 */
export const BASELINE = "86b5bb5";
const ROOT = resolve(__dirname, "..", "..");

export const atBaseline = (path: string): string =>
  execFileSync("git", ["show", `${BASELINE}:${path}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

export const baselineYaml = <T>(path: string): T => parse(atBaseline(path)) as T;
export const baselineJson = <T>(path: string): T => JSON.parse(atBaseline(path)) as T;

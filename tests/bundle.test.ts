import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bundleGuest, hasTooling } from "./guest/runtime";

/*
 * Neither guest has room for a schema library. The handlers run in the Wasm bundle built from
 * wasm/, where zod (or anything speaking the Standard Schema protocol) balloons the bundle and
 * breaks the Javy build. The definition, realm.ts and realm/, is evaluated by the host in an
 * interpreted guest too, under a thirty-second wall clock, and building its schemas with zod took
 * thirteen of those on a quiet machine; on a busy one the realm stopped installing. So the
 * handler schemas are plain JSON Schema. These tests read the real bundle and the sources.
 */

const WASM = resolve(__dirname, "..", "wasm");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(ts|js|mjs)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

describe("the guest bundle", () => {
  it.skipIf(!hasTooling)("carries neither zod nor the Standard Schema key", () => {
    const js = bundleGuest();
    expect(js.length).toBeGreaterThan(1000);
    expect(js).not.toContain("~standard");
    expect(js).not.toMatch(/zod/i);
  });

  it("has no file in the definition importing zod", () => {
    const files = [resolve(__dirname, "..", "realm.ts"), ...sources(resolve(__dirname, "..", "realm"))];
    expect(files.length).toBeGreaterThan(1);
    const bad = files.filter((f) => /(?:from\s*|import\s*\(?\s*)["']zod(?:\/[^"']*)?["']/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("has no file under wasm/ importing from realm/ or zod", () => {
    const files = sources(WASM);
    expect(files.length).toBeGreaterThan(0);
    const bad = files.filter((f) =>
      /(?:from\s*|import\s*\(?\s*)["'](?:zod(?:\/[^"']*)?|(?:\.\.?\/)+realm\/[^"']*|realm\/[^"']*)["']|import\s*["']zod["']/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});

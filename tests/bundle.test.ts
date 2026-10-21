import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bundleGuest, hasTooling } from "./guest/runtime";

/*
 * The guest has no room for a schema library. Zod lives on the host side of the realm; if it
 * (or anything speaking the Standard Schema protocol) leaks into wasm/, the bundle balloons and
 * the build starts failing in Javy. These tests read the real bundle and the sources to catch it.
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

  it("has no file under wasm/ importing from realm/ or zod", () => {
    const files = sources(WASM);
    expect(files.length).toBeGreaterThan(0);
    const bad = files.filter((f) =>
      /(?:from\s*|import\s*\(?\s*)["'](?:zod(?:\/[^"']*)?|(?:\.\.?\/)+realm\/[^"']*|realm\/[^"']*)["']|import\s*["']zod["']/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});

/*
 * Packs the realm SDK (@embabel/realm-types and @embabel/realm-synth) from an embabel-ts checkout
 * into vendor/sdk/, so the realm installs from a fresh clone before the SDK is on npm.
 *
 *   node scripts/vendor-sdk.mjs <path to embabel-ts>
 *
 * Each package is copied to a temporary folder with just its package.json and src, and packed
 * there with npm pack. Two edits happen on the copy, never in the SDK checkout: "files" is set to
 * src, so test fixtures and turbo logs stay out of the tarball, and a "workspace:*" dependency
 * becomes the sibling package's version, because npm cannot install the workspace protocol.
 * realm-synth runs from its TypeScript source under Bun, so src is all it needs.
 *
 * After packing, reinstall the tarballs so package-lock.json records their new integrity:
 *
 *   npm install --save-dev ./vendor/sdk/embabel-realm-types-0.1.0.tgz ./vendor/sdk/embabel-realm-synth-0.1.0.tgz
 *
 * A plain npm install keeps the old integrity while the tarball names stay the same.
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PACKAGES = ["realm-types", "realm-synth"];
const sdk = process.argv[2];
if (!sdk) {
  console.error("usage: node scripts/vendor-sdk.mjs <path to embabel-ts>");
  process.exit(1);
}
const dest = resolve("vendor/sdk");
mkdirSync(dest, { recursive: true });

const manifests = Object.fromEntries(
  PACKAGES.map((name) => [name, JSON.parse(readFileSync(join(sdk, "packages", name, "package.json"), "utf8"))]),
);
const versions = Object.fromEntries(Object.values(manifests).map((m) => [m.name, m.version]));

for (const name of PACKAGES) {
  const stage = mkdtempSync(join(tmpdir(), `vendor-sdk-${name}-`));
  try {
    const manifest = { ...manifests[name], files: ["src"] };
    delete manifest.scripts;
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
        if (!spec.startsWith("workspace:")) continue;
        if (!versions[dep]) throw new Error(`${name} depends on ${dep} from the workspace, which is not packed here`);
        manifest[field][dep] = versions[dep];
      }
    }
    writeFileSync(join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    cpSync(join(sdk, "packages", name, "src"), join(stage, "src"), { recursive: true });
    const tarball = execFileSync("npm", ["pack", "--pack-destination", dest], { cwd: stage, encoding: "utf8" }).trim();
    console.log(`vendor/sdk/${tarball.split("\n").pop()}`);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/*
 * The guest bundle can only import files inside wasm/, and it joins every file into one scope.
 * So chess.js is copied in as wasm/lib/chess.js, its whole body wrapped in one function so none
 * of its own top-level names can meet ours, with `Chess` the only name it hands out.
 *
 * Run by `npm run build`. The output is committed, so the appliance builds the realm without npm.
 */
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("node_modules/chess.js/package.json", "utf8"));
const source = readFileSync("node_modules/chess.js/dist/esm/chess.js", "utf8");
const licence = readFileSync("node_modules/chess.js/LICENSE", "utf8").trim();

const exportLine = /^export \{([^}]*)\};\s*$/m;
if (!exportLine.test(source)) throw new Error("chess.js has no single export line to rewrite; check the new version by hand");
const body = source.replace(exportLine, "return { Chess };").replace(/^\/\/# sourceMappingURL=.*$/m, "");

const out = `/*
 * chess.js ${pkg.version}, vendored by scripts/vendor-chess.mjs. Do not edit.
 *
${licence.split("\n").map((l) => ` * ${l}`.trimEnd()).join("\n")}
 */
const vendoredChessJs = (function () {
${body}
})();

export const Chess = vendoredChessJs.Chess;
`;
writeFileSync("wasm/lib/chess.js", out);
console.log(`wasm/lib/chess.js: chess.js ${pkg.version}, ${out.length} bytes`);

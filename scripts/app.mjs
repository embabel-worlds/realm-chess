/*
 * Builds Chesscalator's assets. The app runs in a sandboxed frame with no network, and the host
 * inlines each asset ahead of the page as a <style> or a classic <script>, so everything the page
 * used to fetch is carried here:
 *
 * - board.css: cm-chessboard's stylesheet and those of its arrows and markers.
 * - board.js: cm-chessboard, its two extensions and chess.js as one script that sets
 *   `window.Chesscalator`, together with the three sprites. The board finds a sprite already in
 *   the document by its id and then never fetches it, so `installSprites()` puts them there
 *   before the board is made.
 *
 * The page's own styles are a source file beside these, chesscalator.css. Nothing an asset
 * carries may contain a closing style or script tag, since the host refuses that.
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "apps/chesscalator.html.assets";
const board = (path) => readFileSync(`node_modules/cm-chessboard/${path}`, "utf8");
const sprite = (name) => readFileSync(`apps/${name}`, "utf8").replace(/<\?xml[^>]*>\s*/, "").trim();

const css = ["assets/chessboard.css", "assets/extensions/arrows/arrows.css", "assets/extensions/markers/markers.css"]
  .map((p) => `/* cm-chessboard ${p} */\n${board(p).trim()}\n`).join("\n");

const entry = `
import { Chessboard, COLOR, INPUT_EVENT_TYPE, FEN } from "cm-chessboard/src/Chessboard.js";
import { Arrows, ARROW_TYPE } from "cm-chessboard/src/extensions/arrows/Arrows.js";
import { Markers, MARKER_TYPE } from "cm-chessboard/src/extensions/markers/Markers.js";
import { Chess } from "chess.js";

const SPRITES = ${JSON.stringify({
  "cm-chessboard-sprite": sprite("chesscalator-pieces.svg"),
  "cm-chessboard-arrows": sprite("chesscalator-arrows.svg"),
  "cm-chessboard-markers": sprite("chesscalator-markers.svg"),
})};

/* Puts each sprite in the document under the id the board looks for, hidden as the board hides its own. */
function installSprites() {
  for (const [id, svg] of Object.entries(SPRITES)) {
    if (document.getElementById(id)) continue;
    const wrapper = document.createElement("div");
    wrapper.id = id;
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.style.cssText = "position:absolute;transform:scale(0)";
    wrapper.innerHTML = svg;
    document.body.prepend(wrapper);
  }
}

window.Chesscalator = { Chessboard, COLOR, INPUT_EVENT_TYPE, FEN, Arrows, ARROW_TYPE, Markers, MARKER_TYPE, Chess, installSprites };
`;

const js = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: "js" },
  bundle: true,
  format: "iife",
  target: "es2022",
  legalComments: "inline",
  write: false,
  logLevel: "warning",
});
const script = `/* Chesscalator's board: cm-chessboard 8.15.1 (MIT, Stefan Haack) and chess.js 1.4.0 (BSD-2-Clause, Jeff Hlywa), bundled by scripts/app.mjs. */\n${js.outputFiles[0].text}`;

for (const [name, text, closing] of [["board.css", css, /<\/style/i], ["board.js", script, /<\/script/i]]) {
  if (closing.test(text)) throw new Error(`${name} contains a closing tag the host would refuse`);
  writeFileSync(`${OUT}/${name}`, text);
}
console.log(`app: ${OUT}/board.css (${css.length} bytes), ${OUT}/board.js (${script.length} bytes)`);

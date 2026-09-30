/*
 * Recaptures tests/fixtures/envelopes.json from a running appliance: every view call the page
 * makes in tests/app.spec.mjs, with the arguments it makes them with. Rerun after any change to
 * a view, a producer or the handler — the page harness only tests what these envelopes say.
 *
 *   APPLIANCE=http://127.0.0.1:11043 APPLIANCE_AUTH="Basic ..." node tests/fixtures/capture.mjs
 *
 * Producers cache per position, and the cache outlives a realm refresh: restart the appliance
 * before capturing after a handler change, or the old answers are what get captured.
 */
import { Chess } from "chess.js";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.APPLIANCE ?? "http://127.0.0.1:11043";
const auth = process.env.APPLIANCE_AUTH;
if (!auth) throw new Error("APPLIANCE_AUTH is required (the Authorization header value)");

const fenAfter = (moves) => {
  const c = new Chess();
  for (const m of moves.split(" ").filter(Boolean)) c.move(m);
  return c.fen();
};
const RUY = "r1b1kbnr/1pp3pp/p4p2/2p5/4P3/1N6/PPP2PPP/RNBR2K1 b kq - 0 9";
const EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";
/* Games the page plays from the start, looked up as lines; and one position loaded as a FEN. */
const LINES = ["", "e4", "e4 e5", "e4 c5", EXCHANGE];

const calls = [];
for (const line of LINES) {
  const fen = fenAfter(line);
  calls.push(["BestMoves", { fen, withinCp: 50, maxLines: 5 }], ["ImbalancesOf", { fen }]);
  if (line) calls.push(["OpeningOfLine", { moves: line }], ["TheoryOfLine", { moves: line }]);
}
calls.push(["BestMoves", { fen: RUY, withinCp: 50, maxLines: 5 }], ["ImbalancesOf", { fen: RUY }], ["OpeningOf", { fen: RUY }]);
for (const fen of [fenAfter(""), RUY]) for (const withinCp of [20, 100]) calls.push(["BestMoves", { fen, withinCp, maxLines: 5 }]);
calls.push(["PlansInPosition", { fen: RUY, level: "intermediate" }], ["PlansInLine", { moves: EXCHANGE, level: "intermediate" }],
  ["PlansInLine", { moves: EXCHANGE, level: "beginner" }]);

const key = (name, args) => `view:${name}:${JSON.stringify(Object.fromEntries(Object.entries(args).sort()))}`;
const out = {};
for (const [name, args] of calls) {
  const res = await fetch(`${base}/api/v1/views/${name}/invoke`, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ args }),
  });
  const env = await res.json();
  const rows = Array.isArray(env.data) ? env.data.length : 0;
  console.log(`${name.padEnd(16)} ${String(args.withinCp ?? "").padEnd(4)} ${env.status} ${rows} rows  ${args.fen ?? args.moves}`);
  if (env.status !== "SUCCEEDED") throw new Error(`${name} did not succeed: ${JSON.stringify(env.error)}`);
  out[key(name, args)] = env;
}
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "envelopes.json"), JSON.stringify(out, null, 1));

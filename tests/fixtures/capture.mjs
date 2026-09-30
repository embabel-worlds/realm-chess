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
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.APPLIANCE ?? "http://127.0.0.1:11043";
const auth = process.env.APPLIANCE_AUTH;
if (!auth) throw new Error("APPLIANCE_AUTH is required (the Authorization header value)");

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const E4E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
const RUY = "r1b1kbnr/1pp3pp/p4p2/2p5/4P3/1N6/PPP2PPP/RNBR2K1 b kq - 0 9";

const calls = [];
for (const fen of [START, E4, E4E5, RUY]) {
  calls.push(["BestMoves", { fen, withinCp: 50, maxLines: 5 }], ["ImbalancesOf", { fen }], ["OpeningOf", { fen }]);
}
for (const fen of [START, RUY]) for (const withinCp of [20, 100]) calls.push(["BestMoves", { fen, withinCp, maxLines: 5 }]);
calls.push(["PlansInPosition", { fen: RUY }]);

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
  console.log(`${name.padEnd(16)} ${String(args.withinCp ?? "").padEnd(4)} ${env.status} ${rows} rows  ${args.fen}`);
  if (env.status !== "SUCCEEDED") throw new Error(`${name} did not succeed: ${JSON.stringify(env.error)}`);
  out[key(name, args)] = env;
}
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "envelopes.json"), JSON.stringify(out, null, 1));

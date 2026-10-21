/*
 * Runs every view on a running appliance with the chess realm installed, for the fixture
 * positions, and says for each whether it answered as expected.
 *
 *   APPLIANCE=http://127.0.0.1:11043 APPLIANCE_AUTH="Basic ..." node tests/live/views.mjs
 *
 * What is expected of each view:
 * - BestMoves, ImbalancesOf, OpeningOf, OpeningOfLine: the recorded envelopes
 *   (tests/fixtures/envelopes.json), field by field. These depend only on the board, the book and
 *   the engine at depth 18. OpeningOf for the Exchange Ruy position is legitimately empty.
 * - MastersAtPosition, MasterGamesAtPosition, MovesByRating, MovesByTimeControl, PlayerAtPosition,
 *   PlayerGamesAtPosition: rows with the recorded columns when a Lichess token is bound; with no
 *   token, no rows and ChessStatus saying lichess=refused. Lichess's own numbers move daily, so
 *   they are not compared.
 * - TheoryOfLine: a page with the recorded columns once the wikibooks API is approved; none
 *   for the start position's empty line.
 * - PlansInPosition, PlansInLine: plans for both sides at the asked level with the model granted;
 *   no rows and ChessStatus saying model=not_granted without it.
 * - ChessStatus: one row.
 *
 * Exits non-zero when any view does not answer as expected.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.APPLIANCE ?? "http://127.0.0.1:11043";
const auth = process.env.APPLIANCE_AUTH;
if (!auth) throw new Error("APPLIANCE_AUTH is required (the Authorization header value)");

const here = dirname(fileURLToPath(import.meta.url));
const recorded = JSON.parse(readFileSync(join(here, "..", "fixtures", "envelopes.json"), "utf8"));
const DETERMINISTIC = new Set(["BestMoves", "ImbalancesOf", "OpeningOf", "OpeningOfLine"]);
const LICHESS = new Set(["MastersAtPosition", "MasterGamesAtPosition", "MovesByRating", "MovesByTimeControl", "PlayerAtPosition", "PlayerGamesAtPosition"]);
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

async function invoke(name, args) {
  const t = Date.now();
  const res = await fetch(`${base}/api/v1/views/${name}/invoke`, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ args }),
  });
  const env = await res.json();
  return { env, ms: Date.now() - t, rows: Array.isArray(env.data) ? env.data : [] };
}

const calls = Object.keys(recorded).map((k) => {
  const m = k.match(/^view:(\w+):(.*)$/);
  return { name: m[1], args: JSON.parse(m[2]), recorded: recorded[k] };
});
calls.push(
  { name: "PlayerAtPosition", args: { fen: START, player: "DrNykterstein", color: "white" } },
  { name: "PlayerGamesAtPosition", args: { fen: START, player: "DrNykterstein", color: "white" } },
);

/*
 * ChessStatus says what the realm last recorded. A view's own fetch is what records a refusal, so
 * an empty view is judged by the status read just after it; a status read before any view ran
 * says nothing about the views that follow, and on a fresh installation it is all unknown.
 */
const readStatus = async () => (await invoke("ChessStatus", {})).rows[0] ?? {};
console.log(`ChessStatus before the views: ${JSON.stringify(await readStatus())}`);
const columnsOf = (name) => {
  const r = Object.values(recorded).find((e) => e.operationId === name && e.data?.length);
  return r ? Object.keys(r.data[0]).sort().join(",") : undefined;
};

let failed = 0;
for (const c of calls) {
  const { env, ms, rows } = await invoke(c.name, c.args);
  let verdict;
  if (env.status !== "SUCCEEDED") verdict = `FAILED ${JSON.stringify(env.error ?? env).slice(0, 200)}`;
  else if (DETERMINISTIC.has(c.name)) {
    verdict = JSON.stringify(rows) === JSON.stringify(c.recorded.data) ? `ok, as recorded (${rows.length})` : "DIFFERS from the recorded rows";
  } else if (rows.length === 0) {
    const status = await readStatus();
    const why = LICHESS.has(c.name) ? status.lichess === "refused" : c.name.startsWith("Plans") ? status.model === "not_granted" : c.name === "TheoryOfLine";
    verdict = why ? `empty, as ChessStatus explains (lichess=${status.lichess}, model=${status.model}, lastRefusal=${status.lastRefusal || "none"})` : "EMPTY with nothing to explain it";
  } else {
    const want = columnsOf(c.name);
    const got = Object.keys(rows[0]).sort().join(",");
    verdict = !want || want === got ? `ok (${rows.length} rows)` : `DIFFERENT COLUMNS: ${got}`;
    if (c.name.startsWith("Plans") && !["white", "black"].every((s) => rows.some((r) => r.side === s))) verdict = "MISSING a side";
  }
  if (!verdict.startsWith("ok") && !verdict.startsWith("empty")) failed++;
  console.log(`${c.name.padEnd(22)} ${String(ms).padStart(6)} ms  ${verdict}  ${JSON.stringify(c.args).slice(0, 90)}`);
}
console.log(failed ? `${failed} views did not answer as expected` : "every view answered as expected");
process.exit(failed ? 1 : 0);

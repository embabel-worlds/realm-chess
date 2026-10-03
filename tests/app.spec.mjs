/*
 * The Chesscalator page, driven headless as the appliance serves it: the document is put together
 * the way the host puts it together (its frame's Content-Security-Policy, the bridge, each asset
 * inlined ahead of the page in the order apps/chesscalator.html.app.json lists them), and the
 * bridge's realm.call answers from replies captured from the realm's own handlers
 * (tests/fixtures/app-replies.json, written by tests/app-handlers.test.ts with CAPTURE=1). Like the
 * real bridge, it refuses a second call while one is pending. Nothing reaches the network: any
 * request at all fails the test.
 *
 * Any call with no captured reply throws, so a missing capture must fail, never pass as "no rows".
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const replies = JSON.parse(readFileSync(join(here, "fixtures/app-replies.json"), "utf8"));
const app = JSON.parse(readFileSync(join(root, "apps/chesscalator.html.app.json"), "utf8"));
const html = readFileSync(join(root, "apps/chesscalator.html"), "utf8");
const assets = app.resources.map((path) => {
  const text = readFileSync(join(root, path), "utf8");
  return path.endsWith(".css") ? `<style>${text}</style>` : `<script>${text}</script>`;
}).join("");
/* The appliance frame's policy: no network, inline scripts and styles, data: images and fonts. */
const GUEST_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' data: blob:; style-src 'unsafe-inline'; " +
  "img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const RUY = "r1b1kbnr/1pp3pp/p4p2/2p5/4P3/1N6/PPP2PPP/RNBR2K1 b kq - 0 9";
const EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";
const link = (moves, at) => `#${new URLSearchParams({ line: moves, at: String(at) })}`;
const MATED = "3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1";
const sortedJson = (args) => JSON.stringify(Object.fromEntries(Object.entries(args).sort()));
const callKey = (handler, args) => `call:${handler}:${sortedJson(args)}`;

/*
 * The captured replies, indexed by the view each answers and that view's arguments, so the tests
 * can ask for "the BestMoves rows for this FEN" whichever call carried them.
 */
const byView = {};
for (const [k, reply] of Object.entries(replies)) {
  const args = JSON.parse(k.slice(k.indexOf(":", 5) + 1));
  const f = args.filters || {};
  const argsOf = {
    BestMoves: { fen: args.fen, withinCp: args.withinCp, maxLines: 5 },
    ImbalancesOf: { fen: args.fen },
    OpeningOf: { fen: args.fen },
    OpeningOfLine: { moves: args.moves },
    TheoryOfLine: { moves: args.moves },
    MastersAtPosition: { fen: args.fen },
    MasterGamesAtPosition: { fen: args.fen },
    MovesByRating: { fen: args.fen, speed: f.speed, minShare: f.minShare },
    MovesByTimeControl: { fen: args.fen, band: f.band, minShare: f.minShare },
    PlansInPosition: { fen: args.fen, level: args.level },
    PlansInLine: { moves: args.moves, level: args.level },
  };
  for (const [name, answer] of Object.entries(reply.views)) byView[key(name, argsOf[name])] = { data: answer.rows, callKey: k };
}
function key(name, args) {
  return `view:${name}:${sortedJson(args)}`;
}
const rowsOf = (k) => {
  if (!byView[k]) throw new Error(`no captured reply answers ${k}`);
  return byView[k].data;
};
/* A captured reply with one view's answer replaced, for a test of how the page shows it. */
const withView = (viewKey, answer) => {
  const k = byView[viewKey].callKey;
  const name = viewKey.split(":")[1];
  return { [k]: { ...replies[k], views: { ...replies[k].views, [name]: answer } } };
};
const best = (fen, withinCp = 50) => rowsOf(key("BestMoves", { fen, withinCp, maxLines: 5 }));
/* The facts as the page shows them: grouped under their names, in the order the names first appear. */
const factsOf = (fen) => {
  const groups = new Map();
  for (const f of rowsOf(key("ImbalancesOf", { fen }))[0].facts.split("\n")) {
    if (!f || f.startsWith("Phase:")) continue;
    const i = f.indexOf(": ");
    const [cat, text] = [f.slice(0, i), f.slice(i + 2)];
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(text);
  }
  return [...groups.values()].flat();
};
const namesOf = (fen) => [...new Set(rowsOf(key("ImbalancesOf", { fen }))[0].facts.split("\n")
  .filter((f) => f && !f.startsWith("Phase:")).map((f) => f.slice(0, f.indexOf(": "))))];

/* The bridge stub. `overrides` replaces replies; `delays` holds a call back, in ms. */
function bridge(overrides = {}, delays = {}) {
  return `window.__calls = [];
  (() => {
    const fx = Object.assign(${JSON.stringify(replies)}, ${JSON.stringify(overrides)});
    const delays = ${JSON.stringify(delays)};
    const key = (handler, args) => 'call:' + handler + ':' + JSON.stringify(Object.fromEntries(Object.entries(args || {}).sort()));
    let pending = false;
    Object.defineProperty(window, 'realm', { value: Object.freeze({
      async call(handler, args = {}) {
        if (pending) throw new Error('A Realm call is already running');
        pending = true;
        try {
          const k = key(handler, args);
          window.__calls.push(k);
          if (delays[k]) await new Promise((r) => setTimeout(r, delays[k]));
          const reply = fx[k];
          if (!reply) throw new Error('NO FIXTURE for ' + k);
          if (reply.failed) throw new Error(reply.failed);
          return JSON.parse(JSON.stringify(reply));
        } finally { pending = false; }
      },
    }) });
  })();`;
}

/* The document as the host composes it: policy, bridge, assets, then the page. */
const documentFor = (overrides, delays) =>
  `<meta http-equiv="Content-Security-Policy" content="${GUEST_CSP}"><script>${bridge(overrides, delays)}</script>${assets}${html}`;

async function open(page, overrides, delays, hash = "") {
  const errors = [];
  const network = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.host === "chess.test" && url.pathname === "/apps/chess/chesscalator.html") {
      return route.fulfill({ contentType: "text/html", body: documentFor(overrides, delays) });
    }
    network.push(url.href);
    return route.abort();
  });
  await page.goto(`http://chess.test/apps/chess/chesscalator.html${hash}`);
  // Kept beside the errors, out of their comparison: what the page tried to fetch.
  Object.defineProperty(errors, "network", { value: network, enumerable: false });
  return errors;
}

/* The engine's moves in the merged table: rows with an engine score (masters-only rows have none). */
const moves = (page) => page.locator("tr.cand:has(td.eng:not(.absent)) button.mv");
const tab = (page, name) => page.click(`.tabbar [data-tab=${name}]`);

async function load(page, fen) {
  await page.fill("#fenInput", fen);
  await page.click("#loadFen");
}

test("the start position renders every candidate and every imbalance the views returned", async ({ page }) => {
  const errors = await open(page);
  await expect(moves(page)).toHaveText(best(START).map((r) => r.move));
  await expect(page.locator("#imbalances li")).toHaveText(factsOf(START));
  await expect(page.locator("#imbalances .imb-name")).toHaveText(namesOf(START));
  await expect(page.locator("#who")).toHaveText("White to move");
  await expect(page.locator("#evalText")).toContainText(`+${(best(START)[0].whiteCp / 100).toFixed(2)}`);
  await expect(page.locator("#opening")).toHaveText("The starting position.");
  expect(errors).toEqual([]);
});

test("the Embabel badge is visible, attributed and linked", async ({ page }) => {
  await open(page);
  const badge = page.locator("#embabel-badge");
  await expect(badge).toBeInViewport();
  await expect(badge).toContainText("Created with");
  await expect(badge.locator("a")).toHaveAttribute("href", /embabel\.com/);
});

test("a game played here is named from its line; a loaded FEN by the structure it resembles", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "e4", exact: true }).click();
  const o = rowsOf(key("OpeningOfLine", { moves: "e4" }))[0];
  await expect(page.locator("#opening b")).toHaveText(`${o.eco} ${o.name}`);
  await load(page, RUY);
  await expect(page.locator("#opening")).toContainText("Ruy Lopez: Exchange");
});

test("a line keeps its book name long after it leaves the book, and shows its theory with attribution", async ({ page }) => {
  const errors = await open(page, {}, {}, link(EXCHANGE, 17));
  const o = rowsOf(key("OpeningOfLine", { moves: EXCHANGE }))[0];
  await expect(page.locator("#opening")).toContainText(`${o.eco} ${o.name}`);
  await expect(page.locator("#opening")).toContainText(`left the book ${o.pliesPast} plies ago`);
  await tab(page, "theory");
  await expect(page.locator("#theoryBox")).toBeVisible();
  await expect(page.locator("#theory p").first()).toBeVisible();
  await expect(page.locator("#theoryCredit a").first()).toHaveAttribute("href", /en\.wikibooks\.org\/wiki\/Chess_Opening_Theory/);
  await expect(page.locator("#theoryCredit")).toContainText("CC BY-SA 4.0");
  await expect(page.locator("#theoryCredit")).toContainText("Excerpt");
  expect(errors).toEqual([]);
});

test("the step buttons, the arrow keys and the browser's Back all move through the game", async ({ page }) => {
  await open(page, {}, {}, link("e4 e5", 2));
  await expect(page.locator("#ply")).toHaveText("2 / 2");
  await page.click("#back");
  await expect(page.locator("#ply")).toHaveText("1 / 2");
  await expect(moves(page)).toHaveText(best(E4).map((r) => r.move));
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#ply")).toHaveText("0 / 2");
  await page.goBack();
  await expect(page.locator("#ply")).toHaveText("1 / 2");
  await page.click("#last");
  await expect(page.locator("#ply")).toHaveText("2 / 2");
  await page.click('#moves span.mv[data-ply="1"]');
  await expect(page.locator("#ply")).toHaveText("1 / 2");
});

test("a different move from an earlier position starts a new line there", async ({ page }) => {
  await open(page, {}, {}, link("e4 e5", 1));
  await expect(page.locator("#ply")).toHaveText("1 / 2");
  await page.getByRole("button", { name: "c5", exact: true }).click();
  await expect(page.locator("#ply")).toHaveText("2 / 2");
  await expect(page.locator("#moves")).toContainText("1. e4 c5");
  await expect(page.locator("#moves")).not.toContainText("e5");
  const o = rowsOf(key("OpeningOfLine", { moves: "e4 c5" }))[0];
  await expect(page.locator("#opening b")).toHaveText(`${o.eco} ${o.name}`);
});

test("stepping back to the engine's side does not make it move", async ({ page }) => {
  await open(page, {}, {}, link("e4 e5", 2));
  await page.selectOption("#engineSide", "b");
  await page.click("#back");
  await expect(page.locator("#ply")).toHaveText("1 / 2");
  await page.waitForTimeout(1000);
  await expect(page.locator("#ply")).toHaveText("1 / 2");
});

test("plans for a game played here are asked for by line, and say what opening they were told", async ({ page }) => {
  await open(page, {}, {}, link(EXCHANGE, 17));
  await expect(moves(page).first()).toBeVisible();
  await tab(page, "plans");
  await page.click("#plansBtn");
  const plans = rowsOf(key("PlansInLine", { moves: EXCHANGE, level: "intermediate" }));
  await expect(page.locator(".plans .plan")).toHaveCount(plans.length);
  await expect(page.locator("#plans > .meta").first()).toContainText(plans[0].opening.slice(0, 30));
});

test("each move shows the imbalances its line creates and removes", async ({ page }) => {
  await open(page);
  await load(page, RUY);
  const first = best(RUY)[0];
  const detail = page.locator("tr.detail").first();
  await expect(detail).toBeHidden();
  await page.locator("tr.cand button.more").first().click();
  await expect(detail).toBeVisible();
  await expect(detail.locator(".chip.plus")).toHaveCount(first.creates.split("\n").filter(Boolean).length);
  await expect(detail.locator(".chip.minus")).toHaveCount(first.removes.split("\n").filter(Boolean).length);
});

test("the tolerance selector re-asks the view with the new withinCp", async ({ page }) => {
  await open(page);
  await load(page, RUY);
  await expect(moves(page)).toHaveCount(best(RUY).length);
  await page.selectOption("#within", "20");
  await expect(moves(page)).toHaveCount(best(RUY, 20).length);
  await page.selectOption("#within", "100");
  await expect(moves(page)).toHaveCount(best(RUY, 100).length);
});

test("clicking a candidate plays it and analyses the new position", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "e4", exact: true }).click();
  await expect(page.locator("#moves")).toContainText("1. e4");
  await expect(page.locator("#who")).toHaveText("Black to move");
  await expect(moves(page)).toHaveText(best(E4).map((r) => r.move));
  expect(errors).toEqual([]);
});

test("with the engine playing Black, a move on the board is answered with the engine's first line", async ({ page }) => {
  await open(page);
  await expect(moves(page).first()).toBeVisible();
  await page.selectOption("#engineSide", "b");
  // Locator clicks scroll the board into view; coordinates taken from a bounding box do not.
  await page.locator('rect[data-square="e2"]').click({ force: true });
  await page.locator('rect[data-square="e4"]').click({ force: true });
  await expect(page.locator("#moves")).toContainText(`1. e4 ${best(E4)[0].move}`);
  await expect(page.locator("#who")).toHaveText("White to move");
});

test("hovering a candidate draws it on the board", async ({ page }) => {
  await open(page);
  await moves(page).first().hover();
  await expect(page.locator(".arrow-info, [class*='arrow']").first()).toBeAttached();
});

test("the plans render for both sides, with the summary and no citation numbers", async ({ page }) => {
  await open(page);
  await load(page, RUY);
  await expect(moves(page).first()).toBeVisible();
  await tab(page, "plans");
  await page.click("#plansBtn");
  const plans = rowsOf(key("PlansInPosition", { fen: RUY, level: "intermediate" }));
  for (const side of ["white", "black"]) {
    await expect(page.locator(`.side[data-side=${side}] .plan`)).toHaveCount(plans.filter((p) => p.side === side).length);
  }
  const whiteFirst = plans.filter((p) => p.side === "white").sort((a, b) => a.priority - b.priority)[0];
  await expect(page.locator(".side[data-side=white] .plan.first h4")).toHaveText(whiteFirst.plan);
  await expect(page.locator(".summary")).toHaveText(plans[0].summary);
  expect(await page.locator("#plans").textContent()).not.toMatch(/\(\d+(,\s*\d+)*\)/);
});

test("an illegal FEN is refused in place and nothing is asked of the world", async ({ page }) => {
  await open(page);
  await expect(moves(page).first()).toBeVisible();
  const before = await page.evaluate(() => window.__calls.length);
  await load(page, "8/8/8/8/8/8/8/8 w - - 0 1");
  await expect(page.locator("#fenError")).toContainText("Not a legal position");
  expect(await page.evaluate(() => window.__calls.length)).toBe(before);
});

test("a finished game says so and does not call the engine", async ({ page }) => {
  await open(page);
  await expect(moves(page).first()).toBeVisible();
  const before = await page.evaluate(() => window.__calls.length);
  await load(page, MATED);
  await expect(page.locator("#who")).toHaveText("Checkmate \u2014 White wins");
  await expect(page.locator("#analysis")).toContainText("the game is over");
  expect(await page.evaluate(() => window.__calls.length)).toBe(before);
});

test("a failed engine view shows the error loudly, and the imbalances still render", async ({ page }) => {
  const k = key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 });
  await open(page, withView(k, { rows: [], error: "sandbox unavailable" }));
  await expect(page.locator("#analysis .state.error")).toContainText("The engine did not answer: sandbox unavailable");
  await expect(page.locator("#imbalances li")).toHaveCount(factsOf(START).length);
  await expect(page.locator("#plansBtn")).toBeDisabled();
});

test("an answer the realm had no time for says so", async ({ page }) => {
  const k = key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 });
  await open(page, withView(k, { rows: [], skipped: "time" }));
  await expect(page.locator("#analysis .state.error")).toContainText("No lines: there was no time left in this call");
});

test("failed plans say so, and leave the rest of the page alone", async ({ page }) => {
  const k = key("PlansInPosition", { fen: RUY, level: "intermediate" });
  await open(page, withView(k, { rows: [], error: "no skill named 'chess-plans'" }));
  await load(page, RUY);
  await expect(moves(page).first()).toBeVisible();
  await tab(page, "plans");
  await page.click("#plansBtn");
  await expect(page.locator("#plans .state.error")).toContainText("The plans could not be read: no skill named 'chess-plans'");
  await expect(moves(page)).toHaveCount(best(RUY).length);
});

test("an answer for a position the board has left is dropped, not shown", async ({ page }) => {
  await open(page, {}, { [byView[key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 })].callKey]: 800 });
  await load(page, RUY);
  await expect(moves(page).first()).toHaveText(best(RUY)[0].move);
  await page.waitForTimeout(1000);
  await expect(moves(page).first()).toHaveText(best(RUY)[0].move);
  await expect(page.locator("#who")).toHaveText("Black to move");
});

test("the board takes a move at once while the plans are still loading, and the old plans never appear", async ({ page }) => {
  await open(page, {}, { [byView[key("PlansInPosition", { fen: RUY, level: "intermediate" })].callKey]: 800 });
  await load(page, RUY);
  await expect(moves(page).first()).toBeVisible();
  await tab(page, "plans");
  await page.click("#plansBtn");
  await tab(page, "moves");
  await page.getByRole("button", { name: best(RUY)[0].move, exact: true }).click();
  await expect(page.locator("#moves")).toContainText(best(RUY)[0].move);
  await page.waitForTimeout(1000);
  await tab(page, "plans");
  await expect(page.locator(".plans .plan")).toHaveCount(0);
});

test("the How it works section opens from the footer link", async ({ page }) => {
  await open(page);
  await expect(page.locator("#how-it-works")).toBeHidden();
  await page.click("footer.how a");
  await expect(page.locator("#how-it-works")).toBeVisible();
  await expect(page.locator("#how-it-works pre").first()).toContainText("MATCH (p:Position {fen: $fen})");
});

test("stepping quickly through a game asks only about the position you stop on", async ({ page }) => {
  await open(page, {}, {}, link(EXCHANGE, 17));
  await expect(moves(page).first()).toBeVisible();
  const before = await page.evaluate(() => window.__calls.filter((k) => k.startsWith("call:chess.appPosition")).length);
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#ply")).toHaveText("7 / 17");
  await page.waitForTimeout(700);
  const asked = await page.evaluate(() => window.__calls.filter((k) => k.startsWith("call:chess.appPosition")));
  // One search for the ten positions stepped through: the last. (Its fixture is not captured, so
  // the page shows an error for it — what is asserted is that nothing else was asked.)
  expect(asked.length - before).toBe(1);
});

test("the plans are asked for at the reader's level, and the level is remembered", async ({ page }) => {
  await open(page, {}, {}, link(EXCHANGE, 17));
  await expect(moves(page).first()).toBeVisible();
  await tab(page, "plans");
  await page.selectOption("#level", "beginner");
  await page.click("#plansBtn");
  const plans = rowsOf(key("PlansInLine", { moves: EXCHANGE, level: "beginner" }));
  await expect(page.locator(".plans .plan")).toHaveCount(plans.length);
  expect(await page.evaluate(() => window.__calls.at(-1))).toContain('"level":"beginner"');
  await page.reload();
  await expect(page.locator("#level")).toHaveValue("beginner");
});

test("engine and masters answer in one table, merged by move", async ({ page }) => {
  await open(page, {}, {}, link("e4", 1));
  const masters = rowsOf(key("MastersAtPosition", { fen: E4 }));
  const engine = best(E4);
  await expect(moves(page)).toHaveText(engine.map((r) => r.move));
  if (masters.length) {
    const top = masters[0];
    const row = page.locator(`tr.cand[data-move="${top.move}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator("td").nth(3)).toContainText(Number(top.games).toLocaleString());
  }
  await expect(page.locator("#mastersNote")).toContainText("Masters:");
});

test("without the Lichess key, the table still shows the engine and says how to add masters", async ({ page }) => {
  const k = key("MastersAtPosition", { fen: E4 });
  await open(page, withView(k, { rows: [], error: "Lichess refused the request: The API call was refused" }), {}, link("e4", 1));
  await expect(moves(page)).toHaveText(best(E4).map((r) => r.move));
  await expect(page.locator("#mastersNote")).toContainText("Lichess token");
});

test("the tabs switch, and the chosen one is remembered", async ({ page }) => {
  await open(page);
  await tab(page, "theory");
  await expect(page.locator('.tabpane[data-pane="theory"]')).toBeVisible();
  await expect(page.locator('.tabpane[data-pane="moves"]')).toBeHidden();
  await page.reload();
  await expect(page.locator('.tabpane[data-pane="theory"]')).toBeVisible();
});

test("popularity compares a move's share across rating bands, or across time controls", async ({ page }) => {
  await open(page, {}, {}, link("e4", 1));
  await expect(moves(page).first()).toBeVisible();
  await tab(page, "popularity");
  await expect(page.locator("#popBandLabel")).toBeHidden();
  await page.selectOption("#popSpeed", "blitz");
  await page.click("#popBtn");
  const rows = rowsOf(key("MovesByRating", { fen: E4, speed: "blitz", minShare: 3 }));
  const bands = new Set(rows.map((r) => r.rating));
  await expect(page.locator("table.popgrid tr").first().locator("th")).toHaveCount(bands.size + 1);
  const top = rows.reduce((a, b) => (b.pctOfGames > a.pctOfGames ? b : a));
  await expect(page.locator(`table.popgrid tr[data-move="${top.move}"]`)).toContainText(`${Math.round(top.pctOfGames)}%`);
  // The chart: one line per move (at most five), a legend naming each, and a readout on hover.
  const charted = Math.min(5, new Set(rows.map((r) => r.move)).size);
  await expect(page.locator(".popchart svg path")).toHaveCount(charted);
  await expect(page.locator(".popchart .legend span")).toHaveCount(charted);
  await page.locator(".popchart svg rect").nth(2).hover();
  await expect(page.locator(".popchart .tip")).toBeVisible();
  await expect(page.locator(".popchart .tip b")).toContainText("Rated");
  await page.selectOption("#popAxis", "speed");
  await expect(page.locator("#popSpeedLabel")).toBeHidden();
  await expect(page.locator("#popBandLabel")).toBeVisible();
  await page.click("#popBtn");
  const speeds = new Set(rowsOf(key("MovesByTimeControl", { fen: E4, band: "1600", minShare: 3 })).map((r) => r.timeControl));
  await expect(page.locator("table.popgrid tr").first().locator("th")).toHaveCount(speeds.size + 1);
});

/* ── Running as a captured app ── */

test("the page asks for nothing over the network: board, sprites, styles and fonts are all in the document", async ({ page }) => {
  const errors = await open(page);
  await expect(moves(page)).toHaveText(best(START).map((r) => r.move));
  await expect(page.locator("#board svg use[href='#wk']").first()).toBeAttached();
  const pieceBox = await page.locator("#board .piece").first().boundingBox();
  expect(pieceBox && pieceBox.width).toBeGreaterThan(10);
  expect(errors.network).toEqual([]);
  expect(errors.filter((e) => /Content Security Policy|Refused/.test(e))).toEqual([]);
});

test("no asset carries a closing style or script tag, which the host refuses", () => {
  for (const path of app.resources) expect(readFileSync(join(root, path), "utf8"), path).not.toMatch(/<\/(script|style)/i);
  expect(app.handlers).toEqual(["chess.appPosition", "chess.appPractice", "chess.appPlans"]);
});

test("ten positions stepped through make no model call; the plans button makes one", async ({ page }) => {
  await open(page, {}, {}, link(EXCHANGE, 17));
  await expect(moves(page).first()).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(350);
  }
  await expect(page.locator("#ply")).toHaveText("7 / 17");
  await page.keyboard.press("End");
  await expect(page.locator("#ply")).toHaveText("17 / 17");
  await expect(moves(page).first()).toBeVisible();
  const positions = await page.evaluate(() => new Set(window.__calls.filter((k) => k.startsWith("call:chess.appPosition")).map((k) => JSON.parse(k.slice(k.indexOf("{"))).fen)).size);
  expect(positions).toBeGreaterThanOrEqual(10);
  expect(await page.evaluate(() => window.__calls.filter((k) => k.startsWith("call:chess.appPlans")).length)).toBe(0);
  await tab(page, "plans");
  await page.click("#plansBtn");
  await expect(page.locator(".plans .plan").first()).toBeVisible();
  expect(await page.evaluate(() => window.__calls.filter((k) => k.startsWith("call:chess.appPlans")).length)).toBe(1);
});

test("five quick steps while a call is pending: one call at a time, and only the last position is asked and shown", async ({ page }) => {
  const first = callKey("chess.appPosition", { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", moves: "e4 e5", withinCp: 50 });
  const errors = await open(page, {}, { [first]: 2500 }, link("e4 e5", 2));
  await page.waitForFunction(() => window.__calls.length === 1);
  for (const k of ["ArrowLeft", "ArrowLeft", "ArrowRight", "ArrowRight", "ArrowLeft"]) {
    await page.keyboard.press(k);
    await page.waitForTimeout(350);
  }
  await expect(page.locator("#ply")).toHaveText("1 / 2");
  await expect(moves(page)).toHaveText(best(E4).map((r) => r.move));
  await expect(page.locator("#who")).toHaveText("Black to move");
  const asked = await page.evaluate(() => window.__calls.filter((k) => k.startsWith("call:chess.appPosition")));
  expect(asked).toEqual([first, callKey("chess.appPosition", { fen: E4, moves: "e4", withinCp: 50 })]);
  expect(errors.filter((e) => /already running/.test(e))).toEqual([]);
});

test("a line beyond its last named opening, and a FEN loaded with no line, each name their opening their own way", async ({ page }) => {
  await open(page, {}, {}, link(EXCHANGE, 17));
  const o = rowsOf(key("OpeningOfLine", { moves: EXCHANGE }))[0];
  expect(Number(o.pliesPast)).toBeGreaterThan(0);
  await expect(page.locator("#opening")).toContainText(`left the book ${o.pliesPast} plies ago`);
  await load(page, RUY);
  await expect(moves(page)).toHaveText(best(RUY).map((r) => r.move));
  expect(rowsOf(key("OpeningOf", { fen: RUY }))).toEqual([]);
  await expect(page.locator("#opening")).toContainText(rowsOf(key("ImbalancesOf", { fen: RUY }))[0].structure);
  const asked = await page.evaluate(() => window.__calls.filter((k) => k.startsWith("call:chess.appPosition")).at(-1));
  expect(JSON.parse(asked.slice(asked.indexOf("{")))).toEqual({ fen: RUY, withinCp: 50 });
});

test("an empty column is explained in the words ChessStatus carries", async ({ page }) => {
  const status = { lichess: "refused", model: "not_granted", lastRefusal: "MODEL_NOT_GRANTED", at: "2026-10-03T09:00:00.000Z" };
  const masters = byView[key("MastersAtPosition", { fen: RUY })].callKey;
  const plans = byView[key("PlansInPosition", { fen: RUY, level: "intermediate" })].callKey;
  await open(page, {
    [masters]: { ...replies[masters], views: { MastersAtPosition: { rows: [] }, MasterGamesAtPosition: { rows: [] } }, status },
    [plans]: { ...replies[plans], views: { PlansInPosition: { rows: [] } }, status },
  });
  await load(page, RUY);
  await expect(page.locator("#mastersNote")).toContainText("ChessStatus: lichess refused (MODEL_NOT_GRANTED at 2026-10-03T09:00:00.000Z)");
  await tab(page, "plans");
  await page.click("#plansBtn");
  await expect(page.locator("#plans .state.error")).toContainText("No plans. ChessStatus: model not_granted (MODEL_NOT_GRANTED");
});

test("in a sandboxed frame with an opaque origin, as the appliance runs it, the page still plays", async ({ page }) => {
  const network = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === "host.test") return route.fulfill({ contentType: "text/html", body: '<!doctype html><iframe sandbox="allow-scripts" style="width:1280px;height:1000px"></iframe>' });
    network.push(url.href);
    return route.abort();
  });
  await page.goto("http://host.test/");
  await page.evaluate((doc) => { document.querySelector("iframe").srcdoc = doc; }, documentFor({}, {}));
  const frame = page.frameLocator("iframe");
  await expect(frame.locator(".cand button.mv").first()).toHaveText(best(START)[0].move);
  await frame.getByRole("button", { name: "e4", exact: true }).click();
  await expect(frame.locator("#who")).toHaveText("Black to move");
  await expect(frame.locator("#moves")).toContainText("1. e4");
  await expect(frame.locator(".cand button.mv").first()).toHaveText(best(E4)[0].move);
  if (process.env.SCREENSHOT) await page.screenshot({ path: join(root, "docs/chesscalator-harness.png") });
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});

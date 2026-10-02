/*
 * The Chesscalator page, driven headless against envelopes captured from live view runs
 * (tests/fixtures/envelopes.json, recaptured whenever a view changes). No network: the
 * appliance runtime is a stub, and the two CDN libraries the page imports are answered from
 * node_modules at the same URLs. What runs is the page's own bytes.
 *
 * Any call with no fixture throws — a missing capture must fail, never pass as "no rows".
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const fixtures = JSON.parse(readFileSync(join(here, "fixtures/envelopes.json"), "utf8"));

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const RUY = "r1b1kbnr/1pp3pp/p4p2/2p5/4P3/1N6/PPP2PPP/RNBR2K1 b kq - 0 9";
const EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";
const link = (moves, at) => `#${new URLSearchParams({ line: moves, at: String(at) })}`;
const MATED = "3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1";
const key = (name, args) => `view:${name}:${JSON.stringify(Object.fromEntries(Object.entries(args).sort()))}`;
const rowsOf = (k) => fixtures[k].data;
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

/* The runtime stub. `overrides` replaces envelopes; `delays` holds a call back, in ms. */
function stub(overrides = {}, delays = {}) {
  return `window.__calls = [];
  window.embabel = (() => {
    const fx = Object.assign(${JSON.stringify(fixtures)}, ${JSON.stringify(overrides)});
    const delays = ${JSON.stringify(delays)};
    const key = (kind, id, args) => kind + ':' + id + ':' + JSON.stringify(Object.fromEntries(Object.entries(args || {}).sort()));
    const invoke = (kind) => async (id, args) => {
      const k = key(kind, id, args);
      window.__calls.push(k);
      if (delays[k]) await new Promise((r) => setTimeout(r, delays[k]));
      const env = fx[k];
      if (!env) throw new Error('NO FIXTURE for ' + k);
      if (env.status === 'FAILED') throw Object.assign(new Error((env.error && env.error.message) || 'failed'), env.error);
      return env;
    };
    return { views: { invoke: invoke('view') }, lenses: { invoke: invoke('lens') },
             manifest: { ready: Promise.resolve(), preflight: async () => ({ ok: true }) },
             progress: { subscribe: () => () => {} }, cache: { invalidate() {}, clear() {} }, EmbabelError: Error };
  })();`;
}

async function open(page, overrides, delays, hash = "") {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.host === "chess.test") {
      if (url.pathname.includes("/apps-runtime/")) {
        return route.fulfill({ contentType: "text/javascript", body: url.pathname.endsWith("embabel.js") ? stub(overrides, delays) : "" });
      }
      const file = url.pathname.replace("/apps/chess/", "");
      return route.fulfill({ path: join(root, "apps", file) });
    }
    if (url.host === "cdn.jsdelivr.net") {
      const m = url.pathname.match(/^\/npm\/(cm-chessboard|chess\.js)@[^/]+\/(.*)$/);
      if (m) return route.fulfill({ path: join(root, "node_modules", m[1], m[2]) });
    }
    return route.abort();
  });
  await page.goto(`http://chess.test/apps/chess/chesscalator.html${hash}`);
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
  await open(page, { [k]: { status: "FAILED", error: { message: "sandbox unavailable" } } });
  await expect(page.locator("#analysis .state.error")).toContainText("The engine did not answer: sandbox unavailable");
  await expect(page.locator("#imbalances li")).toHaveCount(factsOf(START).length);
  await expect(page.locator("#plansBtn")).toBeDisabled();
});

test("an empty answer with warnings says what the warning was", async ({ page }) => {
  const k = key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 });
  await open(page, { [k]: { status: "SUCCEEDED", outcome: "EMPTY", data: [], warnings: [{ message: "candidateLines: source unavailable" }] } });
  await expect(page.locator("#analysis .state.error")).toContainText("No lines: candidateLines: source unavailable");
});

test("failed plans say so, and leave the rest of the page alone", async ({ page }) => {
  const k = key("PlansInPosition", { fen: RUY, level: "intermediate" });
  await open(page, { [k]: { status: "FAILED", error: { message: "no skill named 'chess-plans'" } } });
  await load(page, RUY);
  await expect(moves(page).first()).toBeVisible();
  await tab(page, "plans");
  await page.click("#plansBtn");
  await expect(page.locator("#plans .state.error")).toContainText("The plans could not be read: no skill named 'chess-plans'");
  await expect(moves(page)).toHaveCount(best(RUY).length);
});

test("an answer for a position the board has left is dropped, not shown", async ({ page }) => {
  await open(page, {}, { [key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 })]: 800 });
  await load(page, RUY);
  await expect(moves(page).first()).toHaveText(best(RUY)[0].move);
  await page.waitForTimeout(1000);
  await expect(moves(page).first()).toHaveText(best(RUY)[0].move);
  await expect(page.locator("#who")).toHaveText("Black to move");
});

test("the board takes a move at once while the plans are still loading, and the old plans never appear", async ({ page }) => {
  await open(page, {}, { [key("PlansInPosition", { fen: RUY, level: "intermediate" })]: 800 });
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
  const before = await page.evaluate(() => window.__calls.filter((k) => k.startsWith("view:BestMoves")).length);
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#ply")).toHaveText("7 / 17");
  await page.waitForTimeout(700);
  const asked = await page.evaluate(() => window.__calls.filter((k) => k.startsWith("view:BestMoves")));
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
  await open(page, { [k]: { status: "FAILED", error: { message: "gateway.lichess is not a world tool" } } }, {}, link("e4", 1));
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
  await page.selectOption("#popAxis", "speed");
  await expect(page.locator("#popSpeedLabel")).toBeHidden();
  await expect(page.locator("#popBandLabel")).toBeVisible();
  await page.click("#popBtn");
  const speeds = new Set(rowsOf(key("MovesByTimeControl", { fen: E4, band: "1600", minShare: 3 })).map((r) => r.timeControl));
  await expect(page.locator("table.popgrid tr").first().locator("th")).toHaveCount(speeds.size + 1);
});

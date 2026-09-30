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
const YUGO = "r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 3 9";
const MATED = "3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1";
const key = (name, args) => `view:${name}:${JSON.stringify(Object.fromEntries(Object.entries(args).sort()))}`;
const rowsOf = (k) => fixtures[k].data;
/* The page groups moves by plan, each group where its best move ranks — the order a reader sees. */
const grouped = (rows) => {
  const g = new Map();
  for (const r of rows) (g.get(r.plan) ?? g.set(r.plan, []).get(r.plan)).push(r.move);
  return [...g.values()].flat();
};

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

async function open(page, overrides, delays) {
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
  await page.goto("http://chess.test/apps/chess/chesscalator.html");
  return errors;
}

const moves = (page) => page.locator(".cand button.mv");

test("the start position renders every candidate the view returned, grouped by plan", async ({ page }) => {
  const errors = await open(page);
  const rows = rowsOf(key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 }));
  await expect(moves(page)).toHaveCount(rows.length);
  await expect(moves(page)).toHaveText(grouped(rows));
  await expect(page.locator(".plan")).toHaveCount(new Set(rows.map((r) => r.plan)).size);
  await expect(page.locator("#who")).toHaveText("White to move");
  await expect(page.locator("#evalText")).toContainText(`+${(rows[0].whiteCp / 100).toFixed(2)}`);
  expect(errors).toEqual([]);
});

test("the Embabel badge is visible, attributed and linked", async ({ page }) => {
  await open(page);
  const badge = page.locator("#embabel-badge");
  await expect(badge).toBeInViewport();
  await expect(badge).toContainText("Created with");
  await expect(badge.locator("a")).toHaveAttribute("href", /embabel\.com/);
});

test("the tolerance selector re-asks the view with the new withinCp", async ({ page }) => {
  await open(page);
  await expect(moves(page).first()).toBeVisible();
  await page.fill("#fenInput", YUGO);
  await page.click("#loadFen");
  await expect(moves(page)).toHaveCount(rowsOf(key("BestMoves", { fen: YUGO, withinCp: 50, maxLines: 5 })).length);
  await page.selectOption("#within", "20");
  await expect(moves(page)).toHaveCount(rowsOf(key("BestMoves", { fen: YUGO, withinCp: 20, maxLines: 5 })).length);
  await page.selectOption("#within", "100");
  await expect(moves(page)).toHaveCount(rowsOf(key("BestMoves", { fen: YUGO, withinCp: 100, maxLines: 5 })).length);
});

test("clicking a candidate plays it and analyses the new position", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "e4", exact: true }).click();
  await expect(page.locator("#moves")).toContainText("1. e4");
  await expect(page.locator("#who")).toHaveText("Black to move");
  const reply = rowsOf(key("BestMoves", { fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", withinCp: 50, maxLines: 5 }));
  await expect(moves(page)).toHaveText(grouped(reply));
  expect(errors).toEqual([]);
});

test("with the engine playing Black, a move on the board is answered with the engine's first line", async ({ page }) => {
  await open(page);
  await expect(moves(page).first()).toBeVisible();
  await page.selectOption("#engineSide", "b");
  const box = async (s) => page.locator(`rect[data-square="${s}"]`).boundingBox();
  const a = await box("e2"), b = await box("e4");
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const reply = rowsOf(key("BestMoves", { fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", withinCp: 50, maxLines: 5 }))[0];
  await expect(page.locator("#moves")).toContainText(`1. e4 ${reply.move}`);
  await expect(page.locator("#who")).toHaveText("White to move");
});

test("hovering a candidate draws it on the board", async ({ page }) => {
  await open(page);
  await moves(page).first().hover();
  await expect(page.locator(".arrow-info, [class*='arrow']").first()).toBeAttached();
});

test("the explanation renders the view's prose, as text", async ({ page }) => {
  await open(page);
  await page.fill("#fenInput", YUGO);
  await page.click("#loadFen");
  await expect(moves(page).first()).toHaveText("g4");
  await page.click("#explainBtn");
  const text = rowsOf(key("ExplainPlans", { fen: YUGO, withinCp: 50 }))[0].explanation;
  await expect(page.locator("#explanation p").first()).toContainText(text.split(/\n\s*\n/)[0].slice(0, 60));
});

test("an illegal FEN is refused in place and nothing is asked of the world", async ({ page }) => {
  await open(page);
  await expect(moves(page).first()).toBeVisible();
  const before = await page.evaluate(() => window.__calls.length);
  await page.fill("#fenInput", "8/8/8/8/8/8/8/8 w - - 0 1");
  await page.click("#loadFen");
  await expect(page.locator("#fenError")).toContainText("Not a legal position");
  expect(await page.evaluate(() => window.__calls.length)).toBe(before);
});

test("a finished game says so and does not call the engine", async ({ page }) => {
  await open(page);
  await expect(moves(page).first()).toBeVisible();
  const before = await page.evaluate(() => window.__calls.length);
  await page.fill("#fenInput", MATED);
  await page.click("#loadFen");
  await expect(page.locator("#who")).toHaveText("Checkmate — White wins");
  await expect(page.locator("#analysis")).toContainText("the game is over");
  expect(await page.evaluate(() => window.__calls.length)).toBe(before);
});

test("a failed view shows the error, loudly", async ({ page }) => {
  const k = key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 });
  await open(page, { [k]: { status: "FAILED", error: { message: "sandbox unavailable" } } });
  await expect(page.locator("#analysis .state.error")).toContainText("The engine did not answer: sandbox unavailable");
  await expect(page.locator("#explainBtn")).toBeDisabled();
});

test("an empty answer with warnings says what the warning was", async ({ page }) => {
  const k = key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 });
  await open(page, { [k]: { status: "SUCCEEDED", outcome: "EMPTY", data: [], warnings: [{ message: "candidateLines: source unavailable" }] } });
  await expect(page.locator("#analysis .state.error")).toContainText("No lines: candidateLines: source unavailable");
});

test("an answer for a position the board has left is dropped, not shown", async ({ page }) => {
  const k = key("BestMoves", { fen: START, withinCp: 50, maxLines: 5 });
  await open(page, {}, { [k]: 800 });
  // Load another position while the first answer is still in flight.
  await page.fill("#fenInput", YUGO);
  await page.click("#loadFen");
  await expect(moves(page).first()).toHaveText("g4");
  await page.waitForTimeout(1000);
  await expect(moves(page).first()).toHaveText("g4");
  await expect(page.locator("#who")).toHaveText("White to move");
});

test("the board takes a move at once while an explanation is still being written", async ({ page }) => {
  await open(page, {}, { [key("ExplainPlans", { fen: YUGO, withinCp: 50 })]: 800 });
  await page.fill("#fenInput", YUGO);
  await page.click("#loadFen");
  await expect(moves(page).first()).toHaveText("g4");
  await page.click("#explainBtn");
  await page.getByRole("button", { name: "Bc4", exact: true }).click();
  await expect(page.locator("#moves")).toContainText("Bc4");
  await page.waitForTimeout(1000);
  // The explanation belonged to the position before Bc4, so it must not appear under it.
  await expect(page.locator("#explanation p")).toHaveCount(0);
});

test("the How it works section opens from the footer link", async ({ page }) => {
  await open(page);
  await expect(page.locator("#how-it-works")).toBeHidden();
  await page.click("footer.how a");
  await expect(page.locator("#how-it-works")).toBeVisible();
  await expect(page.locator("#how-it-works pre").first()).toContainText("MATCH (p:Position {fen: $fen})");
});

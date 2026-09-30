/*
 * Drives the REAL page on a running appliance: real runtime, real views, real engine.
 * The credential is attached only to requests for the appliance's own origin — never to the
 * CDN the page also loads from.
 *
 *   APPLIANCE=http://127.0.0.1:11043 APPLIANCE_AUTH="Basic ..." node tests/live/drive.mjs
 */
import { chromium } from "@playwright/test";

const base = process.env.APPLIANCE ?? "http://127.0.0.1:11043";
const auth = process.env.APPLIANCE_AUTH;
if (!auth) throw new Error("APPLIANCE_AUTH is required (the Authorization header value)");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.route(`${base}/**`, (route) => route.continue({ headers: { ...route.request().headers(), authorization: auth } }));

const t0 = Date.now();
await page.goto(`${base}/apps/chess/chesscalator.html`);
await page.waitForSelector(".plan .cand button.mv", { timeout: 30000 });
console.log(`start position analysed in ${Date.now() - t0} ms`);
const firstMoves = await page.locator(".cand button.mv").allTextContents();
console.log("candidates:", firstMoves.join(", "), "| status:", await page.locator("#who").textContent(), await page.locator("#evalText").textContent());

// Play e2-e4 by dragging on the board, then let the engine answer as Black.
await page.selectOption("#engineSide", "b");
const sq = async (s) => (await page.locator(`rect[data-square="${s}"]`).boundingBox());
const a = await sq("e2"), b = await sq("e4");
await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForFunction(() => document.querySelector("#moves").textContent.includes("1. e4 "), null, { timeout: 30000 });
await page.waitForFunction(() => /1\. e4 \S+/.test(document.querySelector("#moves").textContent.trim()), null, { timeout: 30000 });
console.log("after 1.e4 and the engine's reply:", (await page.locator("#moves").textContent()).trim());

// Load the Yugoslav, then ask for the explanation.
await page.selectOption("#engineSide", "");
await page.fill("#fenInput", "r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 3 9");
await page.click("#loadFen");
await page.waitForFunction(() => [...document.querySelectorAll(".cand button.mv")].some((b) => b.textContent === "g4"), null, { timeout: 30000 });
const plans = await page.locator(".plan h3").allTextContents();
const moves = await page.locator(".cand button.mv").allTextContents();
console.log("yugoslav plans:", plans.join(" | "), "| moves:", moves.join(", "));
await page.locator(".cand button.mv").first().hover();
console.log("arrow on hover:", await page.locator(".arrow").count() > 0 || await page.locator("[class*=arrow]").count() > 0);
await page.click("#explainBtn");
await page.waitForSelector("#explanation p", { timeout: 60000 });
console.log("explanation:", (await page.locator("#explanation").textContent()).slice(0, 400), "...");

await page.locator(".cand button.mv").first().hover();
await page.screenshot({ path: "tests/live/last-run.png", fullPage: true });

// Bad FEN is refused in place.
await page.fill("#fenInput", "not a fen");
await page.click("#loadFen");
console.log("bad fen:", await page.locator("#fenError").textContent());

const badge = page.locator("#embabel-badge");
const bb = await badge.boundingBox();
console.log("badge:", (await badge.textContent()).trim(), "| href:", await badge.locator("a").getAttribute("href"), "| in viewport:", bb && bb.y + bb.height <= 1000 && bb.height > 0);
await page.goto(`${base}/apps/chess/chesscalator.html#how-it-works`);
console.log("how-it-works visible:", await page.locator("#how-it-works").isVisible());
console.log("console errors:", errors.length ? errors : "none");
await browser.close();

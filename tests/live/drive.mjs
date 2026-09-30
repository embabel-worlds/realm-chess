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
await page.waitForSelector(".cand button.mv", { timeout: 30000 });
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

// A shared link deep into the Exchange Ruy: the line keeps its book name past the book.
const EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1";
await page.selectOption("#engineSide", "");
await page.goto(`${base}/apps/chess/chesscalator.html#line=${encodeURIComponent(EXCHANGE)}&at=17`);
await page.waitForFunction(() => document.querySelectorAll(".cand button.mv").length > 0 && document.querySelectorAll("#imbalances li").length > 0, null, { timeout: 30000 });
console.log("opening at ply 17:", (await page.locator("#opening").textContent()).trim());
console.log("imbalances above the board:", await page.locator(".board-col #imbalances li").count());
await page.click("#back");
await page.waitForFunction(() => document.querySelector("#ply").textContent.startsWith("16"));
await page.keyboard.press("ArrowLeft");
await page.waitForFunction(() => document.querySelector("#ply").textContent.startsWith("15"));
await page.goBack();
await page.waitForFunction(() => document.querySelector("#ply").textContent.startsWith("16"), null, { timeout: 10000 });
console.log("button, arrow key and browser Back all step:", (await page.locator("#ply").textContent()).trim());
// Back to move 4 and play Ba4 instead of Bxc6: a new line, and its own name.
await page.click('#moves span.mv[data-ply="6"]');
await page.waitForFunction(() => document.querySelector("#ply").textContent.startsWith("6"));
await page.waitForSelector(".cand button.mv", { timeout: 30000 });
const ba4 = page.getByRole("button", { name: "Ba4", exact: true });
if (await ba4.count()) await ba4.click(); else { const a = await page.locator('rect[data-square="b5"]').boundingBox(), b = await page.locator('rect[data-square="a4"]').boundingBox(); await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
await page.waitForFunction(() => document.querySelector("#ply").textContent.trim() === "7 / 7", null, { timeout: 10000 });
await page.waitForFunction(() => document.querySelector("#opening").textContent.includes("Ruy Lopez"), null, { timeout: 30000 });
console.log("after 4.Ba4:", (await page.locator("#opening").textContent()).trim(), "| moves:", (await page.locator("#moves").textContent()).trim());
const t1 = Date.now();
await page.click("#plansBtn");
await page.waitForSelector(".plans .side .plan", { timeout: 120000 });
console.log(`plans in ${Date.now() - t1} ms, told:`, (await page.locator("#plans .meta").first().textContent()).trim());
await page.screenshot({ path: "tests/live/last-run.png", fullPage: false });

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

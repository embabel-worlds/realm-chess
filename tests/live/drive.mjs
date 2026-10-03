/*
 * Drives the REAL page on a running appliance: the captured app in the appliance's sandboxed
 * frame, its calls through the bridge to the realm's Wasm handlers, the real engine.
 *
 *   APPLIANCE=http://127.0.0.1:11043 APPLIANCE_AUTH="Basic ..." node tests/live/drive.mjs
 *
 * The app must be approved for the chess realm first. The credential is attached only to
 * requests for the appliance's own origin. The page lives in an iframe with an opaque origin,
 * so every locator goes through the frame. Writes docs/chesscalator.png.
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
await page.goto(`${base}/api/v1/apps/chess/chesscalator.html`);
const f = page.frameLocator("iframe");
const ms = () => `${Date.now() - t0} ms`;
await f.locator(".cand button.mv").first().waitFor({ timeout: 120000 });
console.log(`start position analysed in ${ms()}:`, (await f.locator(".cand button.mv").allTextContents()).join(", "));
console.log("status:", await f.locator("#who").textContent(), "|", await f.locator("#evalText").textContent());
console.log("masters:", await f.locator("#mastersNote").textContent());

// A line from the start, past the book: the Exchange Ruy, played move by move from the page.
const EXCHANGE = "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6";
for (const san of EXCHANGE.split(" ")) {
  const button = f.getByRole("button", { name: san, exact: true });
  const t = Date.now();
  if (await button.count()) await button.click();
  else {
    console.log(`${san} is not among the engine's or the masters' moves here; the line stops before it`);
    break;
  }
  await f.locator(".cand button.mv").first().waitFor({ timeout: 120000 });
  console.log(`${san.padEnd(5)} ${String(Date.now() - t).padStart(6)} ms  opening: ${(await f.locator("#opening").textContent()).trim()}`);
}
await f.locator(".tabbar [data-tab=theory]").click();
console.log("theory shown:", !(await f.locator("#theoryBox").isHidden()));
const t1 = Date.now();
await f.locator(".tabbar [data-tab=plans]").click();
await f.locator("#plansBtn").click();
await f.locator(".plans .side .plan, #plans .state.error").first().waitFor({ timeout: 130000 });
console.log(`plans in ${Date.now() - t1} ms:`, (await f.locator("#plans").textContent()).trim().slice(0, 300));
await f.locator(".tabbar [data-tab=moves]").click();
await page.screenshot({ path: "docs/chesscalator.png", fullPage: false });
console.log("console errors:", errors.length ? errors : "none");
await browser.close();

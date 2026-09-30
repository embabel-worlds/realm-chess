/*
 * The live plan battery: every position in positions.yml through explainPlans on a running
 * appliance, graded against the plans theory gives each side.
 *
 *   APPLIANCE=http://127.0.0.1:11043 APPLIANCE_AUTH="Basic ..." node tests/battery/run.mjs [id ...]
 *
 * It calls the verb directly rather than the PlansInPosition view, because the view's producer
 * caches a position for a week: after a change to the skill, the view would still answer with
 * what the old skill said.
 *
 * A plan counts as found when one of the side's returned plans mentions any of its `anyOf`
 * words; a `not` word in any plan of that side fails it. The grading is deliberately crude —
 * words, not meaning — so the report prints every plan in full for a person to read, and that
 * reading is the real test. The score is how you notice a regression between readings.
 */
import { Chess } from "chess.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.APPLIANCE ?? "http://127.0.0.1:11043";
const auth = process.env.APPLIANCE_AUTH;
const role = process.env.ROLE ?? "best";
if (!auth) throw new Error("APPLIANCE_AUTH is required (the Authorization header value)");

const only = new Set(process.argv.slice(2));
const positions = parse(readFileSync(join(here, "positions.yml"), "utf8"))
  .filter((p) => only.size === 0 || only.has(p.id))
  .map((p) => {
    if (p.fen) return p;
    const c = new Chess();
    for (const m of p.moves.split(/\s+/)) c.move(m);
    return { ...p, fen: c.fen() };
  });

async function plansFor(fen) {
  const t = Date.now();
  const res = await fetch(`${base}/api/v1/tools/explainPlans`, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ fens: [fen], role }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
  // A handler failure comes back as a 200 whose result is the script's error text.
  if (typeof body.result === "string") throw new Error(body.result.slice(0, 400));
  return { rows: body.result, ms: Date.now() - t };
}

/*
 * Two grades per expected plan. `found`: some plan of that side names it. `leads`: the side's
 * FIRST plan names it — the one a player would act on. A theory plan that only appears third
 * is a partial answer, and scoring it as a pass is how a weak reading hid behind a good score.
 */
function grade(p, rows) {
  const out = [];
  const textOf = (rs) => rs.map((r) => `${r.name} ${r.idea} ${r.moves}`.toLowerCase()).join(" \n ");
  // Whole words only: "f4" must not match inside "Bf4", which is a bishop move, not the pawn.
  const has = (text, w) => new RegExp(`(?<![a-z])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
  for (const side of ["white", "black"]) {
    const mine = rows.filter((r) => r.side === side).sort((a, b) => a.priority - b.priority);
    const all = textOf(mine), first = textOf(mine.slice(0, 1));
    (p.plans[side] ?? []).forEach((e, i) => {
      const hit = e.anyOf.find((w) => has(all, w));
      const bad = (e.not ?? []).find((w) => has(all, w));
      const leads = i === 0 && !bad && e.anyOf.some((w) => has(first, w));
      out.push({ side, plan: e.plan, found: !!hit && !bad, leads, matched: hit ?? null, forbidden: bad ?? null });
    });
  }
  return out;
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i]); }
  }));
  return results;
}

const results = await pool(positions, 3, async (p) => {
  try {
    const { rows, ms } = await plansFor(p.fen);
    const g = grade(p, rows);
    const lead = g.filter((x) => x.leads).length;
    console.log(`${g.every((x) => x.found) ? (lead === g.length ? "PASS" : "PART") : "MISS"}  ${p.id}  found ${g.filter((x) => x.found).length}/${g.length}, leads ${lead}/${g.length}  ${ms} ms`);
    return { p, rows, ms, grades: g };
  } catch (e) {
    console.log(`FAIL  ${p.id}  ${e.message}`);
    return { p, error: e.message, grades: [] };
  }
});

const found = results.flatMap((r) => r.grades).filter((g) => g.found).length;
const leading = results.flatMap((r) => r.grades).filter((g) => g.leads).length;
const total = results.reduce((n, r) => n + (r.error ? (r.p.plans.white?.length ?? 0) + (r.p.plans.black?.length ?? 0) : r.grades.length), 0);
const lines = [`# Plan battery — ${new Date().toISOString()}`, "", `Role: ${role}. Expected plans found anywhere: **${found} of ${total}**; as the side's first plan: **${leading} of ${total}**.`, ""];
for (const r of results) {
  lines.push(`## ${r.p.id} — ${r.p.opening}`, "", `\`${r.p.fen}\``, "", `Theory: ${r.p.source}`, "");
  if (r.error) { lines.push(`**Failed:** ${r.error}`, ""); continue; }
  for (const g of r.grades) lines.push(`- ${g.leads ? "✓✓" : g.found ? "✓ " : "✗ "} ${g.side}: ${g.plan}${g.matched ? ` (matched "${g.matched}")` : ""}${g.forbidden ? ` — but mentions "${g.forbidden}"` : ""}`);
  lines.push("", `Structure named: ${r.rows[0]?.structure ?? ""}`, "", `Summary: ${r.rows[0]?.summary ?? ""}`, "");
  for (const x of r.rows) lines.push(`- **${x.side} ${x.priority}. ${x.name}** — ${x.idea} *Moves:* ${x.moves}. *Uses:* ${(x.imbalances || "").split("\n").join(" / ")}. *Engine:* ${x.engineEvidence}`);
  lines.push("");
}
mkdirSync(join(here, "results"), { recursive: true });
const file = join(here, "results", `battery-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`);
writeFileSync(file, lines.join("\n"));
console.log(`\n${found} of ${total} expected plans found; ${leading} of ${total} as the first plan. Report: ${file}`);

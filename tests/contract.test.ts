import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/*
 * The public contract, held to the committed fixture tests/fixtures/public-contract.json: the ten
 * public handlers with their schemas, the graph types and joins, and the views. Run with
 * UPDATE_CONTRACT=1 to rewrite the fixture from the synthesized files when the contract changes on purpose.
 */

interface Entry { namespace: string; name: string; description?: string; inputSchema?: unknown; outputSchema?: unknown }
interface Join { anchorLabel: string; relationship: string; targetLabel: string; keyField: string; recordKeyField: string }
interface Fixture { handlers: Entry[]; types: unknown[]; joins: Join[]; views: unknown[] }

const FIXTURE = "tests/fixtures/public-contract.json";
const PUBLIC_HANDLERS = [
  "analysePosition", "explainLinePlans", "explainPlans", "mastersAtPosition", "openingLookup",
  "openingOfGameLine", "playerAtPosition", "positionImbalances", "ratedMoves", "theoryOfGameLine",
];

const sortKeys = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(sortKeys)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]))
      : v;

const ourManifest = JSON.parse(readFileSync("dist/manifest.json", "utf8")) as { entries: Entry[] };
const ourProducers = readdirSync("producers").map((f) => parse(readFileSync(`producers/${f}`, "utf8")) as { name: string; handler: string; joins: Join[] });

const current: Fixture = {
  handlers: PUBLIC_HANDLERS.map((n) => {
    const e = ourManifest.entries.find((x) => x.name === n);
    return { name: n, namespace: e?.namespace, description: e?.description, inputSchema: e?.inputSchema, outputSchema: e?.outputSchema } as Entry;
  }),
  types: parse(readFileSync("types/chess.yml", "utf8")) as unknown[],
  joins: ourProducers.flatMap((p) => p.joins ?? []).sort((a, b) => (JSON.stringify(sortKeys(a)) < JSON.stringify(sortKeys(b)) ? -1 : 1)),
  views: parse(readFileSync("views/chess.yml", "utf8")) as unknown[],
};

if (process.env.UPDATE_CONTRACT === "1") writeFileSync(FIXTURE, `${JSON.stringify(sortKeys(current), null, 2)}\n`);
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;

describe("handler signatures", () => {
  it("has the ten public handlers, by name", () => {
    expect(fixture.handlers.map((h) => h.name)).toEqual(PUBLIC_HANDLERS);
  });

  it("keeps each handler's namespace, description, input schema and output schema", () => {
    for (const h of fixture.handlers) {
      const mine = current.handlers.find((c) => c.name === h.name);
      expect(mine?.namespace, h.name).toBeDefined();
      expect(mine, h.name).toEqual(h);
    }
  });
});

describe("graph types and joins", () => {
  it("keeps every type's description and properties", () => {
    expect(current.types).toEqual(fixture.types);
  });

  it("keeps every join with its anchor, relationship, target and key fields", () => {
    expect(current.joins).toEqual(fixture.joins);
  });

  it("names its producers as the host requires", () => {
    for (const p of ourProducers) expect(p.name).toMatch(/^[a-z][a-z0-9._-]{0,63}$/);
  });
});

describe("views", () => {
  it("keeps every view's name, params and cypher", () => {
    expect(current.views).toEqual(fixture.views);
  });
});

describe("the public APIs", () => {
  const apis = parse(readFileSync("apis/apis.yml", "utf8")) as { name: string; auth: string; credential?: string; url: string }[];
  const credentials = parse(readFileSync("credentials.yml", "utf8")) as { id: string }[];

  it("read the wikibook with no credential, as the host reads a public API", () => {
    const wikibooks = apis.find((a) => a.name === "wikibooks")!;
    expect(wikibooks).toMatchObject({ auth: "none" });
    expect(wikibooks).not.toHaveProperty("credential");
    expect(credentials.map((c) => c.id)).toEqual(["lichess"]);
    const doc = JSON.parse(readFileSync(`apis/${wikibooks.url}`, "utf8"));
    expect(doc).not.toHaveProperty("security");
    expect(doc.components?.securitySchemes).toBeUndefined();
  });

  it("fix no header but an X- one, which is all the host lets a captured API fix", () => {
    for (const a of apis) {
      const text = readFileSync(`apis/${a.url}`, "utf8");
      const fixed = [...text.matchAll(/"in":\s*"header"[^}]*"name":\s*"([^"]+)"|"name":\s*"([^"]+)"[^}]*"in":\s*"header"/g)].map((m) => m[1] ?? m[2]);
      for (const h of fixed) expect(h, `${a.name} header ${h}`).toMatch(/^X-/i);
    }
  });
});

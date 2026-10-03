import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { baselineJson, baselineYaml } from "./baseline/rod";

/*
 * The public contract, compared with the Node realm at 86b5bb5 after normalising away what only
 * says how a file is laid out: the labels and their properties, the relationships the graph
 * offers, the views with their params and defaults, and the handlers with their schemas.
 *
 * The differences a captured realm is allowed are listed here, by name, and nowhere else:
 * - producers have internal lowercase names and carry the joins types used to carry;
 * - the `rows*` handlers serve those producers, `status` serves ChessStatus, and the `app*`
 *   handlers serve Chesscalator;
 * - the relationships still to be ported are not produced yet, listed in PENDING.
 */

interface NodeType { name: string; description: string; properties: Record<string, unknown>; virtualJoins?: { anchorLabel: string; relationship: string; keyField: string; recordKeyField: string }[] }
interface Entry { namespace: string; name: string; description?: string; inputSchema?: unknown; outputSchema?: unknown }
interface Join { anchorLabel: string; relationship: string; targetLabel: string; keyField: string; recordKeyField: string }

const rodTypes = baselineYaml<NodeType[]>("types/chess.yml");
const ourTypes = parse(readFileSync("types/chess.yml", "utf8")) as NodeType[];
const rodManifest = baselineJson<{ entries: Entry[] }>("dist/manifest.json");
const ourManifest = JSON.parse(readFileSync("dist/manifest.json", "utf8")) as { entries: Entry[] };
const ourProducers = readdirSync("producers").map((f) => parse(readFileSync(`producers/${f}`, "utf8")) as { name: string; handler: string; joins: Join[] });

/* Labels, properties and handlers that are additions, each with the ticket that brings it. */
const ADDED_LABELS = ["ChessStatus"];
const ADDED_PROPERTIES: Record<string, string[]> = { CandidateMove: ["analysisId", "nodes"], Plan: ["analysisId"] };
const ADDED_HANDLERS = [
  "rowsImbalances", "rowsOpeningOfPosition", "rowsOpeningOfLine", "rowsCandidates", "status", "rowsTheory", "rowsPositionPlans",
  "rowsLinePlans", "rowsMasterMoves", "rowsMasterGames", "rowsPlayerMoves", "rowsPlayerGames", "rowsRatedMoves",
  "appPosition", "appPractice", "appPlans",
];
const ADDED_RELATIONSHIPS = ["AssistantUser-HAS_CHESS_STATUS->ChessStatus"];

/* The Node realm's relationships the captured realm does not produce yet. Each port removes its own. */
const PENDING: string[] = [];

const sorted = <T>(xs: T[]) => [...xs].sort();

describe("types", () => {
  const rod = Object.fromEntries(rodTypes.map((t) => [t.name, t]));
  const ours = Object.fromEntries(ourTypes.map((t) => [t.name, t]));

  it("has the Node realm's labels, with only the listed additions", () => {
    expect(sorted(Object.keys(ours))).toEqual(sorted([...Object.keys(rod), ...ADDED_LABELS.filter((l) => l in ours)]));
  });

  it("gives every label the Node realm's description and properties, with only the listed additions", () => {
    for (const [name, t] of Object.entries(rod)) {
      expect(ours[name].description, name).toBe(t.description);
      const added = (ADDED_PROPERTIES[name] ?? []).filter((p) => p in ours[name].properties);
      const mine = Object.fromEntries(Object.entries(ours[name].properties).filter(([p]) => !added.includes(p)));
      expect(mine, name).toEqual(t.properties);
    }
  });
});

describe("relationships", () => {
  const key = (anchor: string, rel: string, target: string) => `${anchor}-${rel}->${target}`;
  const rodJoins = rodTypes.flatMap((t) => (t.virtualJoins ?? []).map((j) => ({ ...j, targetLabel: t.name })));
  const ourJoins = ourProducers.flatMap((p) => p.joins);

  it("offers each of the Node realm's relationships with its key fields, apart from those still pending", () => {
    for (const j of rodJoins) {
      const k = key(j.anchorLabel, j.relationship, j.targetLabel);
      const mine = ourJoins.find((o) => key(o.anchorLabel, o.relationship, o.targetLabel) === k);
      if (PENDING.includes(k)) {
        expect(mine, `${k} is listed as pending but is produced: take it off PENDING`).toBeUndefined();
        continue;
      }
      expect(mine, k).toBeDefined();
      expect({ keyField: mine!.keyField, recordKeyField: mine!.recordKeyField }, k).toEqual({ keyField: j.keyField, recordKeyField: j.recordKeyField });
    }
  });

  it("adds only the listed relationships", () => {
    const rod = new Set(rodJoins.map((j) => key(j.anchorLabel, j.relationship, j.targetLabel)));
    const added = ourJoins.map((j) => key(j.anchorLabel, j.relationship, j.targetLabel)).filter((k) => !rod.has(k));
    for (const k of added) expect(ADDED_RELATIONSHIPS, k).toContain(k);
  });

  it("names its producers as the host requires", () => {
    for (const p of ourProducers) expect(p.name).toMatch(/^[a-z][a-z0-9._-]{0,63}$/);
  });
});

describe("views", () => {
  type View = { name: string; params?: Record<string, { type: string; default?: unknown }>; cypher: string };
  const rod = baselineYaml<View[]>("views/chess.yml");
  const ours = parse(readFileSync("views/chess.yml", "utf8")) as View[];

  it("keeps the Node realm's views with their params, defaults and cypher", () => {
    for (const v of rod) {
      const mine = ours.find((o) => o.name === v.name);
      expect(mine, v.name).toBeDefined();
      expect(mine).toEqual(v);
    }
  });

  it("adds only ChessStatus, with no params", () => {
    const added = ours.filter((o) => !rod.some((v) => v.name === o.name));
    expect(added.map((v) => v.name)).toEqual(added.length ? ["ChessStatus"] : []);
    for (const v of added) expect(v.params ?? {}).toEqual({});
  });
});

describe("handlers", () => {
  const rod = Object.fromEntries(rodManifest.entries.map((e) => [e.name, e]));
  const ours = Object.fromEntries(ourManifest.entries.map((e) => [e.name, e]));

  it("keeps the Node realm's ten handlers with their names, descriptions and schemas", () => {
    expect(Object.keys(rod)).toHaveLength(10);
    for (const [name, e] of Object.entries(rod)) {
      expect(ours[name], name).toBeDefined();
      const pick = (x: Entry) => ({ namespace: x.namespace, description: x.description, input: x.inputSchema, output: x.outputSchema });
      expect(pick(ours[name]), name).toEqual(pick(e));
    }
  });

  it("adds only the listed producer handlers", () => {
    const added = Object.keys(ours).filter((n) => !(n in rod));
    for (const n of added) expect(ADDED_HANDLERS, n).toContain(n);
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

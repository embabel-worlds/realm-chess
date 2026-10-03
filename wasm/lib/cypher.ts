import type { ViewSpec } from "./views.ts";

/*
 * Runs one of the realm's views over rows the realm already has. The app calls handlers, not
 * views, and still has to show what each view would return, so the handler reads the view's own
 * Cypher and applies it: the filter, the columns with their conversions, the order and the limit.
 *
 * It reads the small part of Cypher the views use: one hop from a pinned anchor, an optional
 * WHERE of comparisons joined by AND and OR, a RETURN of property reads (optionally through
 * toInteger or toFloat) with aliases, ORDER BY over those aliases, and LIMIT. Anything else is
 * an error, so a new view that needs more fails its test instead of answering wrongly.
 *
 * Nulls behave as in Cypher: a comparison with null is not true, null sorts last going up and
 * first going down.
 */

export type Value = string | number | boolean | null;
export type Row = Record<string, unknown>;

type Expr =
  | { k: "prop"; v: string; p: string }
  | { k: "param"; name: string }
  | { k: "num"; n: number }
  | { k: "fn"; f: "toInteger" | "toFloat"; a: Expr }
  | { k: "cmp"; op: "=" | "<>" | "<" | "<=" | ">" | ">="; l: Expr; r: Expr }
  | { k: "null"; not: boolean; a: Expr }
  | { k: "and" | "or"; l: Expr; r: Expr };

export interface Query {
  /** The anchor's label, its pinned property and the parameter that pins it, when it has one. */
  anchor: { label: string; key?: string; param?: string };
  relationship: string;
  target: { variable: string; label: string };
  where?: Expr;
  columns: { alias: string; expr: Expr }[];
  order: { alias: string; desc: boolean }[];
  limit?: Expr;
}

const MATCH = /^MATCH \((\w+):(\w+)(?: \{(\w+): \$(\w+)\})?\)-\[:(\w+)\]->\((\w+):(\w+)\)$/;

function tokens(text: string): string[] {
  const out: string[] = [];
  const re = /\s*(<=|>=|<>|[(),.=<>]|\$\w+|\d+(?:\.\d+)?|\w+)/y;
  let at = 0;
  while (at < text.length) {
    if (/^\s*$/.test(text.slice(at))) break;
    re.lastIndex = at;
    const m = re.exec(text);
    if (!m) throw new Error(`Cannot read the view's Cypher at "${text.slice(at, at + 20)}"`);
    out.push(m[1]);
    at = re.lastIndex;
  }
  return out;
}

function expression(text: string): Expr {
  const t = tokens(text);
  let i = 0;
  const peek = (s?: string) => (s === undefined ? t[i] : t[i]?.toUpperCase() === s.toUpperCase());
  const take = (s?: string) => {
    if (s !== undefined && !peek(s)) throw new Error(`Expected ${s} in "${text}"`);
    return t[i++];
  };
  const or = (): Expr => {
    let l = and();
    while (peek("OR")) (take(), (l = { k: "or", l, r: and() }));
    return l;
  };
  const and = (): Expr => {
    let l = comparison();
    while (peek("AND")) (take(), (l = { k: "and", l, r: comparison() }));
    return l;
  };
  const comparison = (): Expr => {
    const l = atom();
    if (peek("IS")) {
      take();
      const not = peek("NOT") ? (take(), true) : false;
      take("NULL");
      return { k: "null", not, a: l };
    }
    const op = t[i];
    if (op === "=" || op === "<>" || op === "<" || op === "<=" || op === ">" || op === ">=") {
      take();
      return { k: "cmp", op, l, r: atom() };
    }
    return l;
  };
  const atom = (): Expr => {
    const s = take();
    if (s === undefined) throw new Error(`Unexpected end of "${text}"`);
    if (s === "(") {
      const e = or();
      take(")");
      return e;
    }
    if (s.startsWith("$")) return { k: "param", name: s.slice(1) };
    if (/^\d/.test(s)) return { k: "num", n: Number(s) };
    if (s === "toInteger" || s === "toFloat") {
      take("(");
      const a = or();
      take(")");
      return { k: "fn", f: s, a };
    }
    if (/^\w+$/.test(s) && peek(".")) {
      take(".");
      return { k: "prop", v: s, p: take() };
    }
    throw new Error(`Cannot read "${s}" in "${text}"`);
  };
  const e = or();
  if (i !== t.length) throw new Error(`Unexpected "${t[i]}" in "${text}"`);
  return e;
}

/** Splits on commas that are not inside parentheses. */
function list(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) (out.push(text.slice(start, i).trim()), (start = i + 1));
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

const parsed = new Map<string, Query>();

/** The view's Cypher, read once. */
export function parseView(cypher: string): Query {
  const hit = parsed.get(cypher);
  if (hit) return hit;
  const text = cypher.replace(/\s+/g, " ").trim();
  const m = text.match(/^(MATCH .*?\)) (?:WHERE (.*?) )?RETURN (.*?)(?: ORDER BY (.*?))?(?: LIMIT (\S+))?$/);
  if (!m) throw new Error(`Cannot read the view: ${text}`);
  const match = m[1].match(MATCH);
  if (!match) throw new Error(`Cannot read the view's MATCH: ${m[1]}`);
  const columns = list(m[3]).map((c) => {
    const a = c.match(/^(.*) AS (\w+)$/);
    if (!a) throw new Error(`A view column needs an alias: ${c}`);
    return { alias: a[2], expr: expression(a[1]) };
  });
  const order = m[4]
    ? list(m[4]).map((o) => {
      const a = o.match(/^(\w+)( DESC| ASC)?$/i);
      if (!a || !columns.some((c) => c.alias === a[1])) throw new Error(`A view orders by a column it returns: ${o}`);
      return { alias: a[1], desc: /desc/i.test(a[2] ?? "") };
    })
    : [];
  const q: Query = {
    anchor: { label: match[2], key: match[3], param: match[4] },
    relationship: match[5],
    target: { variable: match[6], label: match[7] },
    where: m[2] ? expression(m[2]) : undefined,
    columns,
    order,
    limit: m[5] ? expression(m[5]) : undefined,
  };
  parsed.set(cypher, q);
  return q;
}

function toNumber(v: unknown, integer: boolean): Value {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return integer ? Math.trunc(n) : n;
}

function compare(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return null;
}

function evaluate(e: Expr, row: Row, variable: string, params: Record<string, unknown>): unknown {
  switch (e.k) {
    case "prop":
      if (e.v !== variable) throw new Error(`The view reads ${e.v}, which is not its target`);
      return row[e.p] ?? null;
    case "param":
      if (!(e.name in params)) throw new Error(`The view needs the parameter ${e.name}`);
      return params[e.name];
    case "num":
      return e.n;
    case "fn":
      return toNumber(evaluate(e.a, row, variable, params), e.f === "toInteger");
    case "null": {
      const v = evaluate(e.a, row, variable, params);
      return e.not ? v !== null : v === null;
    }
    case "cmp": {
      const l = evaluate(e.l, row, variable, params);
      const r = evaluate(e.r, row, variable, params);
      if (l === null || r === null) return null;
      if (e.op === "=" || e.op === "<>") {
        const same = typeof l === typeof r && l === r;
        return e.op === "=" ? same : !same;
      }
      const c = compare(l, r);
      if (c === null) return null;
      return e.op === "<" ? c < 0 : e.op === "<=" ? c <= 0 : e.op === ">" ? c > 0 : c >= 0;
    }
    case "and": {
      const l = evaluate(e.l, row, variable, params);
      const r = evaluate(e.r, row, variable, params);
      return l === false || r === false ? false : l === true && r === true ? true : null;
    }
    case "or": {
      const l = evaluate(e.l, row, variable, params);
      const r = evaluate(e.r, row, variable, params);
      return l === true || r === true ? true : l === false && r === false ? false : null;
    }
  }
}

/** Ascending order with nulls last; a descending column is the exact reverse, nulls first. */
function order(a: unknown, b: unknown): number {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an || bn) return an && bn ? 0 : an ? 1 : -1;
  return compare(a, b) ?? 0;
}

/** The view's parameters: its declared defaults, then what the caller gave. */
export function paramsOf(view: ViewSpec, given: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, p] of Object.entries(view.params ?? {})) out[name] = name in given ? given[name] : p.default;
  for (const [name, v] of Object.entries(given)) if (!(name in out)) out[name] = v;
  return out;
}

/**
 * The rows the view returns, given the rows its relationship produced for the pinned anchor.
 * The caller hands over only the anchor's rows, as the graph would join them.
 */
export function runView(view: ViewSpec, given: Record<string, unknown>, rows: Row[]): Row[] {
  const q = parseView(view.cypher);
  const params = paramsOf(view, given);
  const v = q.target.variable;
  const kept = q.where ? rows.filter((r) => evaluate(q.where!, r, v, params) === true) : rows;
  const out = kept.map((r) => Object.fromEntries(q.columns.map((c) => [c.alias, evaluate(c.expr, r, v, params) ?? null])));
  if (q.order.length) {
    const indexed = out.map((r, i) => ({ r, i }));
    indexed.sort((x, y) => {
      for (const o of q.order) {
        const c = order(x.r[o.alias], y.r[o.alias]);
        if (c !== 0) return o.desc ? -c : c;
      }
      return x.i - y.i;
    });
    out.splice(0, out.length, ...indexed.map((x) => x.r));
  }
  if (q.limit) {
    const n = toNumber(evaluate(q.limit, {}, v, params), true);
    if (typeof n === "number") return out.slice(0, Math.max(0, n));
  }
  return out;
}

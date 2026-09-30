import * as path from "path";

/*
 * Stockfish 19, the lite single-threaded WebAssembly build, run under the sandbox's Node.
 *
 * Single-threaded because a threaded build needs SharedArrayBuffer workers; lite because its
 * small network loads in tens of milliseconds where the full build's is 99 MB. Measured on the
 * appliance: 60 ms to start, 1-3 s for five lines at depth 18.
 *
 * One engine per process, and one search at a time: the UCI conversation is a single stream,
 * so two overlapping searches would read each other's output. `queue` serialises them.
 */

export interface RawLine {
  multipv: number;
  depth: number;
  kind: "cp" | "mate";
  value: number;
  pv: string[];
}

interface Module {
  ccall: (name: string, ret: null, types: string[], args: string[], opts: { async: boolean }) => void;
  _isReady?: () => boolean;
}

let engine: Promise<Module> | null = null;
let output: string[] = [];
let queue: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* The engine files sit in dist/engine/, one level up from the bundled dist/api/<ns>.js. */
function start(): Promise<Module> {
  const js = path.join(__dirname, "..", "engine", "stockfish-19-lite-single.js");
  // A runtime require of a computed path, which the bundler leaves alone: the engine ships as
  // its own files beside the bundle, not inside it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const init = require(js);
  const module: any = {
    locateFile: (f: string) => (f.endsWith(".wasm") ? js.replace(/\.js$/, ".wasm") : js),
    listener: (line: string) => output.push(line),
  };
  return init()(module).then(async () => {
    while (module._isReady && !module._isReady()) await sleep(10);
    return module as Module;
  });
}

function send(m: Module, cmd: string) {
  m.ccall("command", null, ["string"], [cmd], { async: /^go\b/.test(cmd) });
}

async function until(re: RegExp, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (!output.some((l) => re.test(l))) {
    if (Date.now() > deadline) throw new Error(`Stockfish did not answer ${re} within ${timeoutMs} ms`);
    await sleep(5);
  }
}

/**
 * Searches one position and returns each principal variation at the deepest depth it reached.
 * Bound-only reports (`lowerbound`/`upperbound`) are skipped: they are the engine thinking
 * aloud mid-iteration, not a score it stands behind.
 */
export function search(fen: string, multiPv: number, depth: number): Promise<{ lines: RawLine[]; coldStart: boolean }> {
  const run = async () => {
    const coldStart = engine === null;
    if (!engine) engine = start();
    const m = await engine;
    output = [];
    send(m, "uci");
    await until(/^uciok/, 5000);
    send(m, `setoption name MultiPV value ${multiPv}`);
    send(m, "ucinewgame");
    send(m, "isready");
    await until(/^readyok/, 5000);
    output = [];
    send(m, `position fen ${fen}`);
    send(m, `go depth ${depth}`);
    await until(/^bestmove/, 45000);
    const last = new Map<number, RawLine>();
    for (const l of output) {
      if (/\b(lowerbound|upperbound)\b/.test(l)) continue;
      const g = l.match(/\bdepth (\d+)\b.*\bmultipv (\d+)\b.*\bscore (cp|mate) (-?\d+)\b.*\bpv (.+)$/);
      if (g) {
        last.set(Number(g[2]), {
          depth: Number(g[1]), multipv: Number(g[2]), kind: g[3] as "cp" | "mate", value: Number(g[4]),
          pv: g[5].trim().split(/\s+/),
        });
      }
    }
    return { lines: [...last.values()].sort((a, b) => a.multipv - b.multipv), coldStart };
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

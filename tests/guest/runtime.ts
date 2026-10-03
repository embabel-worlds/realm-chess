import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/*
 * Runs the realm's handlers the way the appliance does: wasm/handlers.ts bundled and compiled
 * with Javy by the appliance's own build script, then dispatched one request per fresh instance
 * over the same stdin and stdout frames. Host calls (the SQLite and engine dependencies, the
 * gateway) are answered here, synchronously, by whatever the test hands in.
 *
 * The build script ships with the appliance's tooling, not with this realm. Point
 * EMBABEL_WASM_TOOLING at the folder holding build-handlers-wasm.mjs and shim.js.
 */

export const TOOLING = process.env.EMBABEL_WASM_TOOLING;
export const hasTooling = !!TOOLING && existsSync(join(TOOLING, "build-handlers-wasm.mjs"));

const ROOT = resolve(__dirname, "..", "..");

export type HostCall = (tool: string, args: unknown) => unknown;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

const built = new Map<string, WebAssembly.Module>();

/**
 * Compiles the realm's wasm/ folder, with `entry` standing in for wasm/handlers.ts when given
 * (a test-only entry that reaches the realm's lib files), and any file under wasm/ replaced by
 * `overrides`, keyed by its path inside wasm/. Cached by content.
 */
export function buildGuest(entry?: string, overrides: Record<string, string> = {}): WebAssembly.Module {
  if (!hasTooling) throw new Error("EMBABEL_WASM_TOOLING is not set to the appliance's wasm-realm tooling folder");
  const hash = createHash("sha256");
  for (const f of filesUnder(join(ROOT, "wasm"))) hash.update(f).update(readFileSync(f));
  for (const [path, text] of Object.entries(overrides)) hash.update(path).update(text);
  hash.update(entry ?? "").update(readFileSync(join(TOOLING!, "shim.js"))).update(readFileSync(join(TOOLING!, "build-handlers-wasm.mjs")));
  const key = hash.digest("hex");
  const hit = built.get(key);
  if (hit) return hit;
  const cacheDir = join(tmpdir(), "realm-chess-guest");
  const cacheFile = join(cacheDir, `${key}.wasm`);
  if (!existsSync(cacheFile)) {
    const work = mkdtempSync(join(tmpdir(), "realm-chess-guest-"));
    cpSync(join(ROOT, "wasm"), join(work, "wasm"), { recursive: true });
    if (entry !== undefined) writeFileSync(join(work, "wasm", "handlers.ts"), entry);
    for (const [path, text] of Object.entries(overrides)) writeFileSync(join(work, "wasm", path), text);
    mkdirSync(cacheDir, { recursive: true });
    const run = spawnSync(process.execPath, [
      join(TOOLING!, "build-handlers-wasm.mjs"), "--handlers", join(work, "wasm", "handlers.ts"), "--out", cacheFile,
    ], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(`guest build failed:\n${run.stdout}\n${run.stderr}`);
  }
  const module = new WebAssembly.Module(readFileSync(cacheFile));
  built.set(key, module);
  return module;
}

const CALL = "\u0000embabel:call\u0000";
const RESULT = "\u0000embabel:result\u0000";

export interface Dispatch {
  result?: unknown;
  error?: string;
  logs: string[];
  calls: { tool: string; args: unknown }[];
}

export interface DispatchOptions {
  host?: HostCall;
  /** The guest's clock, in epoch milliseconds. A test moves it to stand for time spent. */
  clock?: () => number;
}

class Exit {
  constructor(readonly code: number) {}
}

/**
 * One dispatch: a fresh instance, the request on stdin, host calls answered by `host` as they
 * come. A host call that throws goes back as a refusal, with its `code` when it has one.
 */
export function dispatch(module: WebAssembly.Module, verb: string, args: unknown, options: DispatchOptions = {}): Dispatch {
  const host: HostCall = options.host ?? (() => {
    throw new Error("no host calls in this test");
  });
  const clock = options.clock ?? Date.now;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let stdin = encoder.encode(`${JSON.stringify({ verb, args })}\n`);
  let pending = "";
  const out: Dispatch = { logs: [], calls: [] };
  let memory!: WebAssembly.Memory;
  const view = () => new DataView(memory.buffer);
  const bytes = () => new Uint8Array(memory.buffer);

  const line = (text: string) => {
    if (text.startsWith(CALL)) {
      const { tool, args: callArgs } = JSON.parse(text.slice(CALL.length));
      out.calls.push({ tool, args: callArgs });
      let reply: unknown;
      try {
        reply = { result: host(tool, callArgs) ?? null };
      } catch (e) {
        const code = (e as { code?: string }).code;
        reply = { error: (e as Error).message, ...(code ? { code } : {}) };
      }
      const more = encoder.encode(`${JSON.stringify(reply)}\n`);
      const joined = new Uint8Array(stdin.length + more.length);
      joined.set(stdin);
      joined.set(more, stdin.length);
      stdin = joined;
    } else if (text.startsWith(RESULT)) {
      const frame = JSON.parse(text.slice(RESULT.length));
      if ("error" in frame) out.error = frame.error;
      else out.result = frame.result;
    } else {
      out.logs.push(text);
    }
  };

  const wasi = {
    fd_write(fd: number, iovs: number, count: number, written: number) {
      let total = 0;
      for (let i = 0; i < count; i++) {
        const ptr = view().getUint32(iovs + i * 8, true);
        const len = view().getUint32(iovs + i * 8 + 4, true);
        const chunk = bytes().slice(ptr, ptr + len);
        total += len;
        if (fd === 1) {
          pending += decoder.decode(chunk, { stream: true });
          let nl: number;
          while ((nl = pending.indexOf("\n")) >= 0) {
            const text = pending.slice(0, nl);
            pending = pending.slice(nl + 1);
            line(text);
          }
        } else {
          out.logs.push(decoder.decode(chunk));
        }
      }
      view().setUint32(written, total, true);
      return 0;
    },
    fd_read(fd: number, iovs: number, count: number, read: number) {
      let total = 0;
      if (fd === 0) {
        for (let i = 0; i < count && stdin.length > 0; i++) {
          const ptr = view().getUint32(iovs + i * 8, true);
          const len = view().getUint32(iovs + i * 8 + 4, true);
          const n = Math.min(len, stdin.length);
          bytes().set(stdin.subarray(0, n), ptr);
          stdin = stdin.slice(n);
          total += n;
        }
      }
      view().setUint32(read, total, true);
      return 0;
    },
    environ_sizes_get(countPtr: number, sizePtr: number) {
      view().setUint32(countPtr, 0, true);
      view().setUint32(sizePtr, 0, true);
      return 0;
    },
    environ_get: () => 0,
    clock_time_get(_id: number, _precision: bigint, time: number) {
      view().setBigUint64(time, BigInt(Math.trunc(clock())) * 1_000_000n, true);
      return 0;
    },
    fd_close: () => 0,
    fd_fdstat_get(_fd: number, stat: number) {
      bytes().fill(0, stat, stat + 24);
      view().setUint8(stat, 2);
      return 0;
    },
    fd_seek: () => 70,
    proc_exit(code: number) {
      throw new Exit(code);
    },
  };

  const instance = new WebAssembly.Instance(module, { wasi_snapshot_preview1: wasi });
  memory = instance.exports.memory as WebAssembly.Memory;
  try {
    (instance.exports._start as () => void)();
  } catch (e) {
    if (!(e instanceof Exit) || e.code !== 0) throw e;
  }
  if (pending) line(pending);
  return out;
}

/** Dispatches and returns the result, or throws the handler's error. */
export function call(module: WebAssembly.Module, verb: string, args: unknown, options?: DispatchOptions): unknown {
  const d = dispatch(module, verb, args, options);
  if (d.error !== undefined) throw new Error(d.error);
  return d.result;
}

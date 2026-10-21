import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ENGINE_MODULE } from "../../wasm/lib/config";
import type { Analyse } from "./host";

const ROOT = resolve(__dirname, "..", "..");

/*
 * The stockfish module the realm declares, which it carries at modules/<sha256>.wasm, or
 * STOCKFISH_WASM. The SIMD build of the same engine (vendor/stockfish) also loads; it gives the
 * same lines at the same budget, only faster.
 */
const SIMD_SHA256 = "de1517a78b37ea79925b78124a6afb4e8eb20afa3695523131548883fddaed0a";
function stockfishPath(): string | undefined {
  const candidates = [process.env.STOCKFISH_WASM, resolve(ROOT, "modules", `${ENGINE_MODULE.sha256}.wasm`)];
  return candidates.find((p): p is string => !!p && existsSync(p));
}

export const STOCKFISH = stockfishPath();

let stockfishModule: WebAssembly.Module | undefined;

/** The real engine, loaded as the host loads it: no imports, and the declared hash checked. */
export function realEngine(): Analyse {
  if (!STOCKFISH) throw new Error("no stockfish module: set STOCKFISH_WASM");
  if (!stockfishModule) {
    const bytes = readFileSync(STOCKFISH);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== ENGINE_MODULE.sha256 && digest !== SIMD_SHA256) throw new Error(`${STOCKFISH} has sha256 ${digest}, not a stockfish 19.0.0 build`);
    stockfishModule = new WebAssembly.Module(bytes);
  }
  const instance = new WebAssembly.Instance(stockfishModule, {});
  // biome-ignore lint: the module's exports are untyped
  const e = instance.exports as Record<string, any>;
  e._initialize?.();
  return (fen, nodes, maxDepth, multiPv) => {
    const input = new TextEncoder().encode(fen);
    const ptr = e.embabel_alloc(input.length);
    new Uint8Array(e.memory.buffer, ptr, input.length).set(input);
    const packed = BigInt.asUintN(64, e.analyse(ptr, input.length, nodes, maxDepth, multiPv));
    e.embabel_free(ptr, input.length);
    const rptr = Number(packed >> 32n);
    const rlen = Number(packed & 0xffffffffn);
    const json = new TextDecoder().decode(new Uint8Array(e.memory.buffer, rptr, rlen));
    e.embabel_free(rptr, rlen);
    return json;
  };
}

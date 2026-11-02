# Stockfish, as this realm carries it

The realm carries Stockfish 19 twice in `modules/`, as two builds of the same engine. Each is a
WebAssembly module: one thread, no clock, no filesystem, and no imports. The declared scalar file
has a readable name. The SIMD file is named by its sha256.

| File in `modules/` | Build | Used for |
|---|---|---|
| `stockfish-19.0.0.wasm` | scalar, no SIMD | the realm's `engine` dependency; it runs on any host |
| `de1517a78b37ea79925b78124a6afb4e8eb20afa3695523131548883fddaed0a.wasm` | 128-bit SIMD | a host that runs modules on a machine with Wasm SIMD; an interpreter without SIMD will not mount it |

The realm declares the scalar build as its `engine` dependency, and a host that loads the realm
puts that file into its module store under its digest. The SIMD build is the same engine and the
same `analyse` method, carried so a host can take it from here. This folder is the corresponding
source of both under the GNU General Public License, version 3 (`COPYING`).

## What the modules are built from

| Input | Pin |
|---|---|
| Stockfish | `official-stockfish/Stockfish`, tag `sf_19`, commit `edb0d9db6731067ec50ce619ff372b463bc4dd5d` |
| `patches/0001-stockfish-js-19.0.0.patch` | the `src/` changes of `nmrugg/stockfish.js` v19.0.0 against that commit |
| `patches/0002-embabel-library.patch` | no clock, no stdio and no filesystem; the library reports the depth it finished and the nodes it searched |
| `embabel/embabel_api.cpp`, `embabel/wasi_stubs.c` | the module's three exports (`embabel_alloc`, `embabel_free`, `analyse`) and the WASI stubs that leave it with no imports |
| network | `nn-61e7af4bb97d.nnue`, sha256 `61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b`, from `https://tests.stockfishchess.org/api/nn/` |
| compiler | Emscripten `emcc` 6.0.10 |

## Rebuilding them

With Emscripten 6.0.10 on the path:

```sh
sh vendor/stockfish/build.sh
```

The script clones Stockfish at the pinned commit into `vendor/stockfish/build/`, applies the two
patches, downloads the network into `vendor/stockfish/net/` and checks its digest, embeds it, and
links two modules into `vendor/stockfish/dist/`:

| Module | sha256 |
|---|---|
| `stockfish-lite.wasm` | `b6e43bfbb09335610d64c93e343a2e42b03ebdf80aafa54db42a4dcc1f168056` |
| `stockfish-lite-simd.wasm` | `de1517a78b37ea79925b78124a6afb4e8eb20afa3695523131548883fddaed0a` |

Both builds compile every source with the same flags (`COMMON` in `build.sh`) and link with the same
memory settings (`LINK`). The memory is 64 MiB to start and grows to at most 128 MiB, with 4 MiB of
stack.

The only difference is the extra flags passed to the SIMD build:

| Build | Extra compile and link flags |
|---|---|
| scalar, `stockfish-lite.wasm` | none: `-DIS_64BIT -DUSE_POPCNT` from `COMMON` and nothing else, so the engine uses its plain C++ paths |
| SIMD, `stockfish-lite-simd.wasm` | `-msimd128 -msse -msse2 -mssse3 -msse4.1 -DUSE_SSE2 -DUSE_SSSE3 -DUSE_SSE41` |

`-msimd128` lets Emscripten emit Wasm SIMD instructions. The `-msse*` flags make Emscripten
translate the SSE intrinsics in Stockfish's network code into those instructions, and the `USE_SSE*`
defines tell Stockfish to take those code paths.

To move both builds into the realm, verify their digests against the table above first:

```sh
cp vendor/stockfish/dist/stockfish-lite.wasm modules/stockfish-19.0.0.wasm
cp vendor/stockfish/dist/stockfish-lite-simd.wasm modules/de1517a78b37ea79925b78124a6afb4e8eb20afa3695523131548883fddaed0a.wasm
```

The two files in `modules/` were built with emcc 6.0.10. A rebuild on another machine has not been
checked for identical bytes, so compare the digests the script prints with the table above.

## The `analyse` method

`analyse(fen, nodes, maxDepth, multiPv)` searches the position until it has visited `nodes` nodes
or finished `maxDepth`, whichever comes first, and answers JSON text: the depth it finished, the
nodes it searched, and up to `multiPv` lines, best first, each with its first move in SAN, its score in
centipawns or moves to mate, and its moves in UCI notation.

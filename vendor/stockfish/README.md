# Stockfish, as this realm carries it

`modules/b6e43bfbb09335610d64c93e343a2e42b03ebdf80aafa54db42a4dcc1f168056.wasm` is Stockfish 19
built as a pure-compute WebAssembly module: one thread, no SIMD, no clock, no filesystem, and no
imports. The realm declares it as its `engine` dependency, and a host that loads the realm puts the
file into its module store under that digest. This folder is its corresponding source under the
GNU General Public License, version 3 (`COPYING`).

## What the module is built from

| Input | Pin |
|---|---|
| Stockfish | `official-stockfish/Stockfish`, tag `sf_19`, commit `edb0d9db6731067ec50ce619ff372b463bc4dd5d` |
| `patches/0001-stockfish-js-19.0.0.patch` | the `src/` changes of `nmrugg/stockfish.js` v19.0.0 against that commit |
| `patches/0002-embabel-library.patch` | no clock, no stdio and no filesystem; the library reports the depth it finished and the nodes it searched |
| `embabel/embabel_api.cpp`, `embabel/wasi_stubs.c` | the module's three exports (`embabel_alloc`, `embabel_free`, `analyse`) and the WASI stubs that leave it with no imports |
| network | `nn-61e7af4bb97d.nnue`, sha256 `61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b`, from `https://tests.stockfishchess.org/api/nn/` |
| compiler | Emscripten `emcc` 6.0.10 |

## Rebuilding it

With Emscripten 6.0.10 on the path:

```sh
sh vendor/stockfish/build.sh
```

The script clones Stockfish at the pinned commit into `vendor/stockfish/build/`, applies the two
patches, downloads the network into `vendor/stockfish/net/` and checks its digest, embeds it, and
links two modules into `vendor/stockfish/dist/`:

| Module | sha256 |
|---|---|
| `stockfish-lite.wasm` | `b6e43bfbb09335610d64c93e343a2e42b03ebdf80aafa54db42a4dcc1f168056`, the one this realm carries |
| `stockfish-lite-simd.wasm` | `de1517a78b37ea79925b78124a6afb4e8eb20afa3695523131548883fddaed0a`, the same engine with 128-bit SIMD |

The memory is 64 MiB to start and grows to at most 128 MiB.

## The `analyse` method

`analyse(fen, nodes, maxDepth, multiPv)` searches the position until it has visited `nodes` nodes
or finished `maxDepth`, whichever comes first, and answers JSON text: the depth it finished, the
nodes it searched, and up to `multiPv` lines, best first, each with its first move in SAN, its score in
centipawns or moves to mate, and its moves in UCI notation.

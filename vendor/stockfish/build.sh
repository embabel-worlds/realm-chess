#!/bin/sh
# Builds stockfish-lite.wasm (scalar) and stockfish-lite-simd.wasm from pinned upstream Stockfish.
#
# Pinned inputs:
#   upstream  official-stockfish/Stockfish tag sf_19, commit edb0d9db6731067ec50ce619ff372b463bc4dd5d
#   patches   patches/0001-stockfish-js-19.0.0.patch  (nmrugg/stockfish.js v19.0.0 src/ minus upstream)
#             patches/0002-embabel-library.patch     (ours: no clock, no stdio, no filesystem, library hooks)
#   network   nn-61e7af4bb97d.nnue, sha256 61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b
#   emcc      6.0.10
set -eu

ROOT=$(cd "$(dirname "$0")" && pwd)
BUILD="$ROOT/build"
SRC="$BUILD/stockfish"
UPSTREAM_COMMIT=edb0d9db6731067ec50ce619ff372b463bc4dd5d
NET=nn-61e7af4bb97d.nnue
NET_SHA=61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b
EMCC_VERSION=6.0.10

emcc --version | head -1 | grep -q "$EMCC_VERSION" || { echo "need emcc $EMCC_VERSION" >&2; exit 1; }

mkdir -p "$BUILD" "$ROOT/dist"
if [ ! -d "$SRC/.git" ]; then
  git clone --quiet --depth 1 --branch sf_19 https://github.com/official-stockfish/Stockfish "$SRC"
fi
git -C "$SRC" checkout --quiet --force "$UPSTREAM_COMMIT"
git -C "$SRC" clean --quiet -fdx
test "$(git -C "$SRC" rev-parse HEAD)" = "$UPSTREAM_COMMIT"
for p in "$ROOT"/patches/*.patch; do
  git -C "$SRC" apply --directory=src -p2 "$p"
done

# The network, embedded as a C string like stockfish.js does it.
if [ ! -f "$ROOT/net/$NET" ]; then
  mkdir -p "$ROOT/net"
  curl -sSL -o "$ROOT/net/$NET" "https://tests.stockfishchess.org/api/nn/$NET"
fi
echo "$NET_SHA  $ROOT/net/$NET" | shasum -a 256 -c - >/dev/null
mkdir -p "$SRC/src/emscripten"
node -e '
const fs = require("fs"); const d = fs.readFileSync(process.argv[1]);
let s = "extern const unsigned char gEmbeddedNNUEData[] = \"";
for (let i = 0; i < d.length; i++) { s += "\\x" + d[i].toString(16).padStart(2, "0"); if ((i + 1) % 64 === 0) s += "\"\n\""; }
s += "\";\nextern const unsigned int gEmbeddedNNUESize = " + d.length + ";\n";
s += "extern const unsigned char* const gEmbeddedNNUEEnd = &gEmbeddedNNUEData[" + d.length + "];\n";
fs.writeFileSync(process.argv[2], s);
' "$ROOT/net/$NET" "$SRC/src/emscripten/wasm_embedded_lite_network.h"

cp "$ROOT/embabel/embabel_api.cpp" "$ROOT/embabel/wasi_stubs.c" "$SRC/src/"

SOURCES="attacks.cpp benchmark.cpp bitboard.cpp evaluate.cpp misc.cpp movegen.cpp movepick.cpp
  position.cpp search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp tune.cpp
  nnue/nnue_accumulator.cpp nnue/nnue_misc.cpp nnue/network.cpp
  nnue/features/half_ka_v2_hm.cpp nnue/features/full_threats.cpp nnue/features/pp_3wide.cpp
  nnue/features/p_hm.cpp engine.cpp score.cpp memory.cpp embabel_api.cpp"

COMMON="-O3 -std=c++17 -fno-exceptions -DNDEBUG -DIS_64BIT -DUSE_POPCNT -DUSE_SLOPPY_ATOMICS
  -DNNUE_EMBEDDING_OFF -DNO_TABLEBASES -D__NO_SYZYGY__ -DUSE_LITE_NET -D__EMSCRIPTEN_SINGLE_THREADED__
  -DEMBABEL_LIBRARY -D__ENGINE_VERSION__=\"19-embabel\" -Wno-deprecated-declarations"

# 64 MiB to start, 128 MiB declared maximum, 4 MiB of wasm stack for the recursive search.
LINK="-sSTANDALONE_WASM=1 --no-entry -sFILESYSTEM=0 -sINITIAL_MEMORY=64MB -sALLOW_MEMORY_GROWTH=1
  -sMAXIMUM_MEMORY=128MB -sSTACK_SIZE=4MB -sEXPORTED_FUNCTIONS=_embabel_alloc,_embabel_free,_analyse
  -sERROR_ON_UNDEFINED_SYMBOLS=1"

build() {
  name=$1; shift
  obj="$BUILD/obj-$name"
  mkdir -p "$obj"
  # One em++ per source, in parallel, then one link.
  extra="$*"
  (cd "$SRC/src" && printf '%s\n' $SOURCES | xargs -P 8 -I{} sh -c \
    'em++ $0 $1 -c "$2" -o "$3/$(echo "$2" | tr / _).o"' "$COMMON" "$extra" {} "$obj")
  (cd "$SRC/src" && emcc -O3 -c wasi_stubs.c -o "$obj/wasi_stubs.o")
  em++ $COMMON "$@" "$obj"/*.o $LINK -o "$ROOT/dist/$name"
  shasum -a 256 "$ROOT/dist/$name"
}

build stockfish-lite.wasm
build stockfish-lite-simd.wasm -msimd128 -msse -msse2 -mssse3 -msse4.1 -DUSE_SSE2 -DUSE_SSSE3 -DUSE_SSE41

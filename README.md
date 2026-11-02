# shinar-chess

This repository is the chess realm built for shinar's demo. A realm is a package of functions,
types and apps that a host loads and runs. Shinar is that host, and Brick is the desktop app you
use to look at it. This realm gives you a chessboard app, the Stockfish 19 engine, and the plans a
position calls for.

The realm is called `chess` and is marked `experimental`. Its functions are written in TypeScript,
declared in `realm.ts`, and compiled to WebAssembly when shinar loads them. Stockfish comes with the
realm as a WebAssembly module in `modules/`, so nothing has to be installed for the engine and no
docker is needed. `realm.ts` declares that local file and its SHA-256 digest. It also declares SQLite
from the operator's default registry with its digest. The operator must allow both modules.
Shinar must support dependency sources in `realm.ts` before it can load this revision.

This page tells you how to run it. [docs/REALM.md](docs/REALM.md) explains how the realm works, and
[vendor/stockfish/README.md](vendor/stockfish/README.md) explains how the engine is built.

## This is a demo realm

The repository is private, and its name does not start with `realm-` or `pack-`. Me and the worlds
console list only repositories with those prefixes, so neither of them will ever offer this realm.
You load it into shinar yourself, as described below.

## What you need

- **Access to the embabel-worlds GitHub organisation.** Three private repositories are needed:
  shinar, embabel-ts and this one. Shinar reads `realm.ts` with the types in embabel-ts, so it
  cannot load this realm without a checkout of it (shinar's limitation L302). Your git must be able
  to clone `https://github.com/embabel-worlds/...` without asking for a password, for example
  through `gh auth setup-git`.
- **A shinar checkout.** These steps were checked on macOS.
- **mise** (<https://mise.jdx.dev>). Shinar's `mise.toml` pins the tools it needs: JDK 25, Node
  26.11.1, Javy 9.1.0 and esbuild 0.28.2. `mise install` in the shinar checkout installs them all.
- **The Javy plugin.** `scripts/brick-dev.sh` downloads it the first time it runs, with
  `scripts/fetch-javy-plugin.sh`. You can run that script yourself first.
- **Network access to registry.npmjs.org.** The realm imports zod, and shinar downloads the exact
  package version that `package-lock.json` pins, then checks it against its sha512. If you have no
  network, copy the tarballs into the packages folder first (see "Without the network" below).
- **The wasmtime library, optional but recommended.** `scripts/fetch-wasmtime.sh` downloads it.
  With it, Stockfish runs on wasmtime and analysis is about twice as fast. Without it, Stockfish
  falls back to endive, shinar's own WebAssembly runtime, and Brick's launcher prints a line saying
  so. The realm still works, because the engine it uses is the build with no SIMD. The SIMD build
  in `modules/` runs only on wasmtime: endive will not mount it.

## Run it in Brick

From the folder that holds your checkouts, clone shinar and embabel-ts, and put embabel-ts at the
commit shinar's tests were written against:

```sh
git clone https://github.com/embabel-worlds/shinar
git clone https://github.com/embabel-worlds/embabel-ts
git -C embabel-ts checkout 213cae84f28d74a255132ad7c419ac3f859fded0
```

Then, inside the shinar checkout:

```sh
cd shinar
mise install
scripts/fetch-javy-plugin.sh
scripts/fetch-wasmtime.sh
scripts/clone-fixture-realms.sh --tier demo --only shinar-chess
scripts/fetch-packages.sh --realm .shinar-cache/realms/shinar-chess-<commit12>
export SHINAR_EMBABEL_TS="$PWD/../embabel-ts"
export SHINAR_PACKAGES="$PWD/.shinar-cache/packages"
mise exec -- scripts/brick-dev.sh --realms demo
```

What each step does:

| Step | What it does |
|---|---|
| `scripts/clone-fixture-realms.sh --tier demo --only shinar-chess` | Clones this repository at the exact commit shinar's `fixtures/realms.lock.yml` pins, into `.shinar-cache/realms/shinar-chess-<commit12>`, and makes the clone read-only. `<commit12>` in the next line is the first 12 characters of that commit, which the script prints as `cloned shinar-chess <commit12> ...`. |
| `scripts/fetch-packages.sh --realm ...` | Downloads the npm packages the realm's lock pins (zod and what it needs) into `.shinar-cache/packages`. `brick-dev.sh` runs this for you too, so this step only makes a missing network show up early. |
| `SHINAR_EMBABEL_TS` | The embabel-ts checkout shinar reads `realm.ts` with. Without it, the launcher prints `chess: not callable, it ships a realm.ts and SHINAR_EMBABEL_TS is not set`. |
| `SHINAR_PACKAGES` | Where shinar finds the package tarballs. The launcher uses `.shinar-cache/packages` when it is not set. |
| `scripts/brick-dev.sh --realms demo` | Starts shinar's sidecar with the demo realms, waits until it has loaded them, prints one line per realm, and opens Brick. Ctrl-C, or closing Brick, stops both. |

The demo also loads code, astrology, movie, doom, pulse and bearer. Any whose clone is missing is
named with the command that clones it. Astrology and movie need docker; chess does not. To fetch
every demo realm at once, run `scripts/clone-fixture-realms.sh --tier all` (it takes a while).

## What you should see

The launcher prints `chess: loaded` among the other realms. In Brick, open **Realm studio**, pick
`chess` and open its **Functions** tab. If a function's Call button is still off, the sidecar is
building the realm's functions; it turns on when they are ready.

**positionImbalances.** Call it with the Exchange Ruy Lopez after 9.Rxd1:

```json
{ "fens": ["r1b1kbnr/1pp3pp/p4p2/2p5/4P3/1N6/PPP2PPP/RNBR2K1 b kq - 0 9"] }
```

The run completes with one record. Its `facts` read, among other lines, "Material: the sides are
level.", "Minor pieces: Black has the bishop pair.", that Black has doubled pawns on the c-file, and
that White has a kingside pawn majority.

**analysePosition.** Call it with the scholar's mate position, White to move:

```json
{ "fens": ["r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"], "multiPv": 1, "depth": 8 }
```

The run completes with one line: `san` is `Qxf7#`, `mate` is 1, and there is no `scoreCp`, because a
mate has no centipawn score.

**Chesscalator.** On the **Apps** tab, open `chesscalator.html`. Brick asks you to approve the page
first. Once approved, it shows the board, the starting position's imbalances and the engine's lines.

The calls that need Lichess, the opening theory wikibook or a model end refused unless the sidecar
is given those, and that is expected.

### How long the calls take

Measured on an Apple M5 Max from Brick's launcher, timing each call from dispatch until the run
ended. The engine always searches the realm's own budget, 30,000 nodes, so a faster runtime finishes
sooner but does not search deeper.

| Call | Stockfish on wasmtime | Stockfish on endive (no wasmtime library) |
|---|---|---|
| positionImbalances, Exchange Ruy, first call | 3.6 s | 5.0 s |
| positionImbalances, same position again | 2.3 s | 2.7 s |
| analysePosition, scholar's mate, depth 8 | 5.9 s | 8.8 s |
| analysePosition, starting position, default budget (depth 10, e4) | 10.0 s | 17.1 s |
| analysePosition, a middlegame, default budget (depth 8) | 8.7 s | 15.9 s |

In both columns the realm's own TypeScript runs on endive, which is the launcher's default and most
of the time above. Shinar can run that part on wasmtime as well (its decision D258), where
positionImbalances takes well under a second, but `brick-dev.sh` does not turn that on.

## Add the realm by hand

Brick can add a realm from a git address at a fixed commit. A sidecar holds only one realm called
`chess`, so start Brick without the demo set first:

```sh
export SHINAR_EMBABEL_TS="$PWD/../embabel-ts"
export SHINAR_PACKAGES="$PWD/.shinar-cache/packages"
scripts/fetch-packages.sh --realm .shinar-cache/realms/shinar-chess-<commit12>
mise exec -- scripts/brick-dev.sh
```

Then, in Brick's **Realm studio**, press **Add realm** and fill in:

| Field | Value |
|---|---|
| Git URL | `https://github.com/embabel-worlds/shinar-chess.git` |
| Branch | `main` |
| Commit | the commit to load, for example the one shinar's `fixtures/realms.lock.yml` pins for `shinar-chess` |

Press **Add**. The sidecar clones exactly that commit into a folder named after it, loads the realm
and lists `chess`. A clone of that commit already in the cache, such as the one the demo uses, is
checked and used instead of cloning again. The commit may be the full sha or its first 12 or more characters, as long as no
other commit on the branch starts with them. Anything that is not hexadecimal is refused with "the
commit must be 12 to 40 hexadecimal characters". Leave Commit empty to load the head of the branch.

## Without the network

`scripts/fetch-packages.sh --check --realm .shinar-cache/realms/shinar-chess-<commit12>` lists the
tarballs the realm needs, each named `<name>-<version>.tgz`. Copy those files into
`.shinar-cache/packages` from a machine that has them, and the run above needs no registry.

## When something goes wrong

| What you see | What to do |
|---|---|
| `unavailable: private shinar-chess` from the clone script | Your git cannot reach the private repository over https. Check `git ls-remote https://github.com/embabel-worlds/shinar-chess.git`. |
| `chess: not callable, it ships a realm.ts and SHINAR_EMBABEL_TS is not set` | Export `SHINAR_EMBABEL_TS` in the same shell, then start the launcher again. |
| `realm shinar-chess is not in the cache` | Run the clone script line above. |
| `more than 64M of swap is in use` | The launcher will not start Java while the machine swaps. Close something, or set `SHINAR_SWAP_LIMIT_MB` if the swap is left over and memory is free. |
| `no wasmtime library at ..., so the modules marked native run on endive` | Run `scripts/fetch-wasmtime.sh`, or carry on: the realm works, just slower. |
| A warning on the realm that `modules/de1517a7....wasm` is not stored | Expected. That is the SIMD build, which the realm carries but does not declare as its engine. |

## Licence

GPL-3.0, like Stockfish. `vendor/stockfish/` holds the engine's source, patches and build script
beside the two modules.

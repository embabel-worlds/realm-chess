# The captured chess realm: notes for review

## What changed

The realm is now a captured realm. `realm.ts` declares it, and synth writes the declaration files
from it (`realm.yml`, `credentials.yml`, `apis/apis.yml`, `producers/`, `types/`, `views/`,
`dependencies/`, `dist/manifest.json`, `apps/chesscalator.html.app.json`). The handlers are
TypeScript in `wasm/handlers.ts`, built to Wasm by the appliance at admission and run in its
sandbox. There is no Docker image and no Node server.

- **Engine.** Stockfish 19 lite is the `stockfish` 19.0.0 registry module, called through
  `analyse(fen, nodes, maxDepth, multiPv)`. A search is bounded by 3,500,000 nodes and depth 18.
- **Your code, kept.** `imbalances.ts`, `lines.ts` and the opening logic moved to `wasm/lib/`
  unchanged apart from imports and one speed change: `mateInOne` reads the plain move list,
  which has the same SAN in the same order and costs a fraction as much inside the guest. Your tests run under Node and again inside the built guest. Your
  plan prompt and parser are byte for byte yours, checked by a test. Your ten handlers keep their
  names, descriptions and schemas, checked against 86b5bb5's manifest.
- **Producers.** A captured producer sends a list of keys and wants rows back, so `rows*` handlers
  sit in front of yours, with paging. Producer names became lowercase (`candidate-lines`);
  labels, relationships and views are yours.
- **Keeping.** Your caches became SQLite tables with your TTLs (`db/schema.sql`), and the opening
  book became migrations (`db/0001`, `db/0002`).
- **Plans** go through `ai_complete` with the chess-plans skill, behind the owner's model grant,
  and are keyed to the lines they describe (`analysisId`).
- **ChessStatus** is new: the one place an empty column can be explained.
- **Chesscalator** is a captured app: it calls `chess.appPosition`, `chess.appPractice` and
  `chess.appPlans` through the frame's single `realm.call`, and carries its board, chess.js,
  sprites and styles as assets. The player look-up is on.

`docs/PARITY.md` lists every feature beside what it does now.

## Why

A captured realm installs from a folder or the Store and runs in the appliance's own sandbox, so
the realm needs no container and no server of its own. The appliance admits exactly the code it
captured, and the owner grants what it may reach: the model, Lichess, the wikibook. The node
budget replaces `go depth 18` with no clock because a search bounded by work gives the same lines
every time, and fits the 30 second dispatch.

## How to build

```bash
npm install
npx playwright install chromium-headless-shell
EMBABEL_WASM_TOOLING=<appliance checkout>/tooling/wasm-realm npm run check
```

`npm run check` typechecks, vendors chess.js into the guest, writes the book, builds the app's
assets, synthesizes, runs the unit tests (inside the guest too when `EMBABEL_WASM_TOOLING` is set)
and runs the page. It needs Bun for synth. The real engine tests find a `wasm-stockfish` checkout
beside this one, or `STOCKFISH_WASM`. After it, `git status` is clean: everything generated is
reproducible. Never edit a generated file; edit `realm.ts` and run `npm run synth`.

## What needs the published SDK

`@embabel/realm-types` is a `file:` dependency on an SDK checkout. The realm uses SDK features that
are not released yet: captured `views`, `skills`, `apps` and `maturity`, `capabilities`, string
argument and return types on dependency methods, `ndjson` API operations, migrations on a SQLite
dependency, synth refusing an output folder it did not write, the typed `ai_complete` call on the
handler context, and handler output types that refuse null (every verb in `wasm/handlers.ts` is
typed with them, so `npm run typecheck` catches a result the host would refuse). Switch `package.json` to the
published version when it ships; nothing else changes.

## Host follow-ups

- **Background deepening** uses the scheduled background class and the engine's batch call,
  both in review on the host. On a host without the batch call the tick searches one position a
  round, checking its 12 s budget before each search; on one without the background class it
  competes with pages for slots. The first round of a batch trusts the calibration: a host that
  runs a batch one search after another on a runtime much slower than the calibration could take
  a first round past the budget, though it stays inside the deadline unless a search takes more
  than about 15 s. `db/0006-deepen.sql` keeps its first header, since the appliance has applied
  it and the host checks each applied migration's hash; `0007` replaces its queue.

- **Handlers on the native runtime.** On the appliance's interpreter the handlers are far too slow
  (imbalances alone took 26.9 s). Running realm handlers on the native Wasm runtime is in progress;
  the app's timings and the measured depth are taken after it lands.
- **Wikibooks with no credential.** The wikibook API is declared `auth: none`, with no
  credential and no security scheme in its document. The realm sends no fixed headers: the host's
  transport sets the User-Agent Wikimedia asks for, and a captured API may only fix `X-` headers.
- **Coded API refusals.** A refused call reaches the guest without its HTTP status, so ChessStatus
  can say Lichess refused but not whether the token is missing or Lichess said no.
- **A raced cold plan.** When two dispatches make the same plan at once, the second keeps its
  answer but its stored row is refused, since it read before writing. Replaying an upsert keyed by
  the row it read would keep it.
- **The app's frame.** The level, tab and player are kept through `realm.prefs`, per app and per
  reader; a bridge without it keeps nothing. The owner page's hash reaches the frame as
  `realm.hash` and a `hashchange` just after load, and opens the game it names (`line=`/`fen=`,
  a bare FEN, or bare SAN moves). The page's history entries use the frame's own address with
  the new hash, since a bare `#...` resolves against the owner page. The app cannot yet push a
  hash back out to the owner page, so a link to a position reached in the app is not shareable.
  Chrome refuses `data:` URLs in an SVG `<use>`, so the sprites are placed in the document by id.
- **Admission and macOS.** A folder copied from macOS carries `._` files, which admission refuses;
  copy without them (or the appliance could ignore them).

## What is not done yet

- The live checks on an appliance: `tests/live/views.mjs` (every view against the recorded rows),
  `tests/live/drive.mjs` (the app in the frame; writes `docs/chesscalator.png`), and the battery
  three times on a fixed model for the parity reading in `docs/PARITY.md`.
- Recording the Lichess fixtures from live Lichess: they are synthetic and fixed.

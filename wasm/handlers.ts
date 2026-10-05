import type { Handlers } from "./generated/realm.ts";
import { appPlans, appPosition, appPractice } from "./handlers/app.ts";
import { deepen, markDeepened, status } from "./handlers/background.ts";
import { analysePosition, rowsCandidates } from "./handlers/engine.ts";
import { mastersAtPosition, playerAtPosition, ratedMoves, rowsMasterGames, rowsMasterMoves, rowsPlayerGames, rowsPlayerMoves, rowsRatedMoves } from "./handlers/lichess.ts";
import { explainLinePlans, explainPlans, rowsLinePlans, rowsPositionPlans } from "./handlers/plans.ts";
import { openingLookup, openingOfGameLine, positionImbalances, rowsImbalances, rowsOpeningOfLine, rowsOpeningOfPosition, rowsTheory, theoryOfGameLine } from "./handlers/position.ts";

/*
 * The realm's verbs, gathered from one module per concern under wasm/handlers/. The ten public
 * verbs answer the questions a reader asks. The `rows*` verbs serve the graph's producers: they
 * take the keys the host sends, answer `{ rows, next }` or a plain list, and keep what they
 * compute. `deepen` and `markDeepened` are the scheduled ticks, `status` says what the realm could
 * not do, and the three `app*` verbs serve Chesscalator.
 *
 * This file is the guest's entry: the appliance compiles it, and everything it imports, into one
 * script, and registers each `name: name` member of the object below as a verb. The build reads
 * only written-out members, so each one is spelled out rather than shortened. The `satisfies`
 * check holds every verb to the type synth generated for it from realm.ts.
 */
export default {
  positionImbalances: positionImbalances,
  openingLookup: openingLookup,
  openingOfGameLine: openingOfGameLine,
  analysePosition: analysePosition,
  mastersAtPosition: mastersAtPosition,
  playerAtPosition: playerAtPosition,
  ratedMoves: ratedMoves,
  theoryOfGameLine: theoryOfGameLine,
  explainPlans: explainPlans,
  explainLinePlans: explainLinePlans,
  rowsImbalances: rowsImbalances,
  rowsOpeningOfPosition: rowsOpeningOfPosition,
  rowsOpeningOfLine: rowsOpeningOfLine,
  rowsCandidates: rowsCandidates,
  status: status,
  rowsTheory: rowsTheory,
  rowsPositionPlans: rowsPositionPlans,
  rowsLinePlans: rowsLinePlans,
  rowsMasterMoves: rowsMasterMoves,
  rowsMasterGames: rowsMasterGames,
  rowsPlayerMoves: rowsPlayerMoves,
  rowsPlayerGames: rowsPlayerGames,
  rowsRatedMoves: rowsRatedMoves,
  appPosition: appPosition,
  appPractice: appPractice,
  appPlans: appPlans,
  deepen: deepen,
  markDeepened: markDeepened,
} satisfies Handlers;

/* Every handler the realm declares, gathered from the concern modules. */
import { appHandlers } from "./app.ts";
import { backgroundHandlers } from "./background.ts";
import { engineHandlers } from "./engine.ts";
import { lichessHandlers } from "./lichess.ts";
import { plansHandlers } from "./plans.ts";
import { positionHandlers } from "./position.ts";
import { theoryHandlers } from "./theory.ts";

export const handlers = {
  ...engineHandlers,
  ...positionHandlers,
  ...theoryHandlers,
  ...lichessHandlers,
  ...plansHandlers,
  ...backgroundHandlers,
  ...appHandlers,
};

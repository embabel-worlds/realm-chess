/* Every handler the realm declares, gathered from the concern modules and the files not yet split into them. */
import { appHandlers } from "../app-handlers.ts";
import { producerHandlers } from "../handlers.ts";
import { publicHandlers } from "../rod-handlers.ts";
import { engineHandlers } from "./engine.ts";
import { positionHandlers } from "./position.ts";
import { theoryHandlers } from "./theory.ts";

export const handlers = {
  ...engineHandlers,
  ...positionHandlers,
  ...theoryHandlers,
  ...publicHandlers,
  ...producerHandlers,
  ...appHandlers,
};

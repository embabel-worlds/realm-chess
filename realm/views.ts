import type { CapturedViewSpec } from "@embabel/realm-types";
import { VIEWS } from "../wasm/lib/views.ts";

/* The thirteen views and ChessStatus. The text lives beside the guest code, which runs it for the app. */
export const views: CapturedViewSpec[] = VIEWS;

/* Unit tests only: the Playwright page specs are *.spec.mjs and run under `npm run test:app`.
 * Most tests dispatch into the built guest, which takes seconds when the files run in parallel. */
export default { test: { include: ["tests/**/*.test.ts"], testTimeout: 30_000 } };

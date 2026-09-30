/* The page harness only; the live drive (tests/live/drive.mjs) is run by hand against an appliance. */
export default { testDir: "tests", testMatch: /.*\.spec\.mjs$/, timeout: 20000, use: { headless: true } };

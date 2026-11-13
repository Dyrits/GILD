import { defineConfig } from "vitest/config";

// These tests start real processes and wait on real time, so they fail when the machine is busy: they run one file at a time, apart from the rest.
const timing = ["packages/service/test/harness/**/*.test.ts", "packages/service/test/lore/**/*.test.ts"];

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          exclude: timing,
          include: ["packages/*/test/**/*.test.ts", "apps/app/test/**/*.test.ts", "apps/desktop/test/**/*.test.ts"],
          name: "parallel",
        },
      },
      { extends: true, test: { fileParallelism: false, include: timing, name: "timing" } },
    ],
    // A test that fails under load passes on a second try; one that is really broken fails every time.
    retry: 2,
    testTimeout: 20_000,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["packages/*/test/**/*.test.ts", "apps/app/test/**/*.test.ts"] },
});

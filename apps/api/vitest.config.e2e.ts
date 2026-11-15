// Purpose: Configure API end-to-end tests to use Vitest and TypeScript path aliases.
// Used by: The API package's end-to-end test script.
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: "./",
    include: ["**/*.e2e-spec.ts"],
  },
});

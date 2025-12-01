import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, "src/lib"),
      $modules: path.resolve(__dirname, "src/modules"),
      // Provide a mock module for SvelteKit private env imports in tests
      "$env/dynamic/private": path.resolve(__dirname, "src/test-utils/mock-env-dynamic-private.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Keep the generic pattern but explicitly add __tests__ folders
    include: [
      "src/**/*.test.{ts,js}",
      "src/**/__tests__/**/*.test.{ts,js}",
      // Also accept alternatives for direct file targeting from CLI (relative paths)
      "./src/**/__tests__/**/*.test.{ts,js}",
      // Include the specific integration test so running a single file path succeeds
      "src/__tests__/integration/api/book-isbn.test.ts",
    ],
  },
});

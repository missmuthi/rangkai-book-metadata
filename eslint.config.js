import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import svelteParser from "svelte-eslint-parser";
import * as tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules",
      ".svelte-kit",
      "build",
      "dist",
      "*.cjs",
      "vite.config.ts",
      "vitest.config.ts",
      "svelte.config.js",
      "tailwind.config.ts",
      "postcss.config.js",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2022,
        extraFileExtensions: [".svelte"],
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],
      "no-inner-declarations": "off",
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsParser,
      },
    },
    rules: {
      "no-inner-declarations": "off",
    },
  },
  {
    files: [
      "API_TESTS.ts",
      "SMART_PREFETCH_DEMO.ts",
      "USAGE_EXAMPLES.ts",
      "diagnostic.js",
      "test-ai-integration.js",
      "test-ai-live.js",
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/lib/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
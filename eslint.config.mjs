// Purpose: Apply strict TypeScript and recommended JavaScript lint rules across the workspaces.
// Used by: The root lint script, in addition to each app's existing lint configuration.
import eslint from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/dist/**",
    "**/out/**",
    "**/*.tsbuildinfo",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,cjs,mjs,ts,tsx}"],
    plugins: { jsdoc },
    rules: {
      // Require documentation on exported APIs without imposing it on private helpers.
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            ClassExpression: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true,
          },
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/(?:#[\\da-fA-F]{3}|#[\\da-fA-F]{4}|#[\\da-fA-F]{6}|#[\\da-fA-F]{8})\\b/]",
          message: "Use a semantic design token instead of a raw hex color.",
        },
      ],
    },
  },
  // Workspace-specific TypeScript checks run through each package's own tsc command.
  prettier,
]);

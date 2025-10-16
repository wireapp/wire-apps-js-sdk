import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module"
      },
      globals: {
        ...globals.node
      },
      ecmaVersion: "latest"
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    ignores: [
      "build/**",
      "node_modules/**",
      "src/sample/**",
      "*.js"
    ],
    rules: {
      "id-length": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/typedef": "off",
      "no-dupe-class-members": "off",
      "no-unsanitized/property": "off",
      "prefer-promise-reject-errors": "off",
      "valid-jsdoc": "off",
      "jsx-a11y/media-has-caption": "off"
    }
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*", "**/mocks/**/*"],
    rules: {
      "no-magic-numbers": "off",
      "id-length": "off"
    }
  }
]

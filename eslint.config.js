import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  js.configs.recommended,
  
  {
    ignores: [
      "build/**",
      "node_modules/**",
      "src/sample/**",
      "src/generated/**"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
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
    rules: {
      "indent": ["error", 2, { "SwitchCase": 1 }],

      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "args": "all",
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrors": "all",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ],

      // Add this specific rule for parameter properties
      "@typescript-eslint/no-unused-private-class-members": "warn",

      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "off",
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

  // Test overrides
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*", "**/mocks/**/*"],
    rules: {
      "no-magic-numbers": "off",
      "id-length": "off"
    }
  }
]

import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "sitio/dist/", "node_modules/", "coverage/"] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-fallthrough": "off",
      "no-cond-assign": ["error", "except-parens"],
    },
  },
  {
    files: ["src/navegador.js", "src/plugins/dom.js", "sitio/nativas.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
  { files: ["sitio/nativas.js"], languageOptions: { sourceType: "script" } },
];

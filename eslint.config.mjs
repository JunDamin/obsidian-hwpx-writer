import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      // Disable rules NOT in the community-review bot's required list
      // (keeps our local scan aligned with what the bot actually enforces).
      "obsidianmd/prefer-active-doc": "off",
      "obsidianmd/prefer-active-window-timers": "off",
      "obsidianmd/no-unsupported-api": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        args: "none",
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "main.js", "tests/**"],
  },
];

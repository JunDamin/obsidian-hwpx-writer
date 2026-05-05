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
      "@typescript-eslint/require-await": "warn",
      // HWPX is the file format brand name; the user explicitly preserves
      // its uppercase capitalization in the export button (commit 36ee965).
      // The `acronyms` option REPLACES the default list, so we restate the
      // defaults plus the project-specific additions.
      "obsidianmd/ui/sentence-case": ["error", {
        enforceCamelCaseLower: true,
        acronyms: [
          // Project-specific
          "HWPX", "HWP", "WASM", "OWPML",
          // Mirrored from eslint-plugin-obsidianmd's DEFAULT_ACRONYMS
          "API", "HTTP", "HTTPS", "URL", "DNS", "TCP", "IP", "SSH", "TLS",
          "SSL", "FTP", "SFTP", "SMTP", "JSON", "XML", "HTML", "CSS", "PDF",
          "CSV", "YAML", "SQL", "PNG", "JPG", "JPEG", "GIF", "SVG", "2FA",
          "MFA", "OAuth", "JWT", "LDAP", "SAML", "SDK", "IDE", "CLI", "GUI",
          "CRUD", "SOAP", "CPU", "GPU", "RAM", "SSD", "USB", "UI", "OK",
          "RSS", "S3", "ID", "UUID", "GUID", "SHA", "MD5", "ASCII", "UTF-8",
          "UTF-16", "DOM", "CDN", "FAQ", "AI", "ML", "LLM",
        ],
      }],
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "main.js", "tests/**"],
  },
];

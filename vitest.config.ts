import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: that one loads the pre-bundled
// TanStack Start/Nitro plugins, which the pure lib/gym tests don't need.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});

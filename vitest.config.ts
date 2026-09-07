import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["game-sources/**", "node_modules/**", "dist/**", "output/**"],
  },
});

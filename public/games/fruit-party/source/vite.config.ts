import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  base: "./",
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("../../../../output/fruit-party", import.meta.url)),
    emptyOutDir: false,
    target: "es2022",
    sourcemap: true,
  },
});

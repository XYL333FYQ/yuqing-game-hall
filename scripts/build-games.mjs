import { readdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const gamesRoot = path.join(root, "public", "games");
for (const entry of await readdir(gamesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name === "fruit-party") {
    await import("./build-fruit-party.mjs");
    continue;
  }
  const config = path.join(gamesRoot, entry.name, "source", "vite.config.ts");
  try { await access(config); } catch {
    continue;
  }
  await build({ configFile: config });
}

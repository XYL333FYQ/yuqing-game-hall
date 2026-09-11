import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distRoot = path.join(projectRoot, "dist");
const explicitNonRuntimePaths = [
  "games/der-koloss/.env.example",
  "games/der-koloss/.vercelignore",
  "games/der-koloss/AGENTS.md",
  "games/der-koloss/cinematic.html",
  "games/der-koloss/js/cinematic-director.js",
  "games/der-koloss/llms.txt",
  "games/der-koloss/README.md",
  "games/der-koloss/RENDERING.md",
  "games/der-koloss/vercel.json",
  "games/hexgl/README.md",
  "games/littlejs-arcade/CLAUDE.md",
  "games/littlejs-arcade/README.md",
  "games/littlejs-arcade/reference.md",
  "games/pvp-arena/IDEAS.md",
  "games/pvp-arena/README.md",
  "games/pvp-arena/sources",
];

let removed = 0;
for (const relativePath of explicitNonRuntimePaths) {
  if (await remove(path.join(distRoot, relativePath))) removed += 1;
}
removed += await removeNamedMetadata(distRoot);
console.log(`Cloudflare Pages 成品清理完成：移除 ${removed} 个开发或工具路径，运行资源与许可文件保持不变。`);

async function removeNamedMetadata(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return 0;
    throw error;
  }
  let count = 0;
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if ([".claude", ".github", ".gitignore"].includes(entry.name)) {
      if (await remove(target)) count += 1;
    } else if (entry.isDirectory()) {
      count += await removeNamedMetadata(target);
    }
  }
  return count;
}

async function remove(target) {
  try {
    await rm(target, { recursive: true, force: false });
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

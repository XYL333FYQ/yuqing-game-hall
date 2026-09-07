import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectGameManifests } from "./generate-game-catalog.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const requiredFiles = [
  "public/games/_shared/yuqing-bridge.js",
  "public/games/der-koloss/index.html",
  "public/games/der-koloss/LICENSE",
  "public/games/sanctuarys-end/sanctuary.html",
  "public/games/sanctuarys-end/LICENSE",
  "public/games/littlejs-arcade/index.html",
  "public/games/littlejs-arcade/LICENSE",
  "public/games/littlejs-arcade/templates/engineLoader.js",
  "public/games/littlejs-arcade/templates/menus.js",
  "public/games/littlejs-arcade/templates/gameFx.js",
  "public/games/littlejs-arcade/templates/textureGenerator.js",
  "public/games/littlejs-arcade/templates/cards.js",
  "public/games/pvp-arena/client/index.html",
  "public/games/pvp-arena/socket.io-disabled.js",
  "public/games/pvp-arena/MIT-LICENSE.txt",
  "public/games/pvp-arena/COPYING",
  "public/games/hexgl/index.html",
  "public/games/hexgl/LICENSE",
  "public/games/hexgl/audio/LICENSE",
];

const failures = [];
for (const relativePath of requiredFiles) {
  try {
    await access(path.join(root, relativePath), constants.R_OK);
  } catch {
    failures.push(`缺少运行文件：${relativePath}`);
  }
}

const forbiddenSong = path.join(root, "public/games/der-koloss/assets/audio/beauty-of-annihilation.mp3");
try {
  await access(forbiddenSong, constants.F_OK);
  failures.push("Der Koloss 运行包重新出现了未授权商业歌曲。");
} catch {
  // Expected: the file must remain absent from distributable assets.
}

const catalogPath = path.join(root, "public/games/littlejs-arcade/games.js");
try {
  const catalog = await readFile(catalogPath, "utf8");
  const executableCatalog = catalog.replace(/^\s*\/\/.*$/gm, "");
  if (/\burl\s*:\s*["']https?:\/\//i.test(executableCatalog)) {
    failures.push("LittleJS 正式目录重新出现了跨站 iframe 游戏条目。");
  }
} catch {
  failures.push("无法读取 LittleJS 游戏目录。");
}

try {
  const manifests = await collectGameManifests();
  const iframeEntries = manifests.filter(({ manifest }) => manifest.launch.kind === "iframe");
  for (const { manifest } of iframeEntries) {
    if (manifest.launch.kind !== "iframe") continue;
    const entry = manifest.launch.entry;
    if (!entry.startsWith(`/games/${manifest.id}/`) || !entry.endsWith(".html") || entry.includes("..")) {
      failures.push(`Manifest 的 iframe 入口不够明确或不安全：${manifest.id} → ${entry}`);
      continue;
    }
    try {
      await access(path.join(root, "public", entry.slice(1)), constants.R_OK);
    } catch {
      failures.push(`Manifest 指向的 iframe 文件不存在：${manifest.id} → ${entry}`);
    }
  }
  console.log(`已根据 ${manifests.length} 份 Manifest 检查 ${iframeEntries.length} 个 iframe 入口。`);
} catch (error) {
  failures.push(`无法读取游戏 Manifest：${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`游戏运行包检查通过：${requiredFiles.length} 个关键文件。`);
}

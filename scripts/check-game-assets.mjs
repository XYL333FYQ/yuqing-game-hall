import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectGameManifests } from "./generate-game-catalog.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const requiredFiles = [
  "public/games/_shared/peerjs.min.js",
  "public/games/_shared/gobang-config.js",
  "public/games/_shared/card-room/config.js",
  "public/games/_shared/card-room/js/socket.io.min.js",
  "public/games/_shared/card-room/js/layer/layer.js",
  "public/games/_shared/card-room/js/layer/theme/default/layer.css",
  "public/games/_shared/card-room/images/poker.svg",
  "public/games/_shared/card-room/images/dizhu.svg",
  "public/games/_shared/card-room/LICENSE",
  "public/games/doudizhu/js/game.js",
  "public/games/doudizhu/js/net.js",
  "public/games/doudizhu/LICENSE",
  "public/games/gobang/LICENSE",
  "public/games/_shared/game-chinese.js",
  "public/games/_shared/game-help.js",
  "public/games/_shared/expansion-LICENSE",

  "public/games/_shared/yuqing-bridge.js",
  "public/games/der-koloss/index.html",
  "public/games/der-koloss/LICENSE",
  "public/games/sanctuarys-end/sanctuary.html",
  "public/games/sanctuarys-end/LICENSE",
  "public/games/littlejs-arcade/index.html",
  "public/games/littlejs-arcade/LICENSE",
  "public/games/littlejs-arcade/dist/littlejs.js",
  "public/games/littlejs-arcade/dist/littlejs.release.js",
  "public/games/littlejs-arcade/dist/littlejs.min.js",
  "public/games/littlejs-arcade/dist/box2d.wasm.js",
  "public/games/littlejs-arcade/dist/box2d.wasm.wasm",
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
  const iframeEntries = manifests.filter(({ manifest }) => manifest.platform.launch.kind === "iframe");
  for (const { manifest } of iframeEntries) {
    if (manifest.platform.launch.kind !== "iframe") continue;
    const entry = manifest.platform.launch.entry;
    if (!entry.startsWith(`/games/${manifest.id}/`) || !entry.endsWith(".html") || entry.includes("..")) {
      failures.push(`Manifest 的 iframe 入口不够明确或不安全：${manifest.id} → ${entry}`);
      continue;
    }
    try {
      await access(path.join(root, "public", entry.slice(1)), constants.R_OK);
    } catch {
      failures.push(`Manifest 指向的 iframe 文件不存在：${manifest.id} → ${entry}`);
    }
    for (const art of [manifest.presentation.art.cover, manifest.presentation.art.hero]) {
      if (!art?.startsWith("/games/")) continue;
      if (art.includes("..")) {
        failures.push(`Manifest 图片路径不安全：${manifest.id} → ${art}`);
        continue;
      }
      try {
        await access(path.join(root, "public", art.slice(1)), constants.R_OK);
      } catch {
        failures.push(`Manifest 图片不存在：${manifest.id} → ${art}`);
      }
    }
  }
  console.log(`已根据 ${manifests.length} 份 Manifest 检查 ${iframeEntries.length} 个 iframe 入口。`);
} catch (error) {
  failures.push(`无法读取游戏 Manifest：${error instanceof Error ? error.message : String(error)}`);
}

// Checking the actual runtime inventory catches missing maps/audio as well as
// entry files. A SPA fallback can otherwise return HTML with status 200.
for (const batch of ["expansion", "classics"]) {
try {
  const sources = JSON.parse(await readFile(path.join(root, `games/${batch}/SOURCES.json`), "utf8"));
  const inventory = JSON.parse(await readFile(path.join(root, `games/${batch}/runtime-assets.json`), "utf8"));
  for (const { id } of sources) {
    const files = inventory[id];
    if (!Array.isArray(files) || !files.includes("index.html")) {
      failures.push(`游戏缺少完整运行资源清单：${id}`);
      continue;
    }
    for (const name of [...files, "LICENSE", "SOURCE.md", "source.zip", "cover.png"]) {
      if (name.includes("..") || path.isAbsolute(name)) {
        failures.push(`游戏资源路径不安全：${id} → ${name}`);
        continue;
      }
      try {
        await access(path.join(root, "public/games", id, name), constants.R_OK);
      } catch {
        failures.push(`游戏运行资源不存在：${id} → ${name}`);
      }
    }
  }
  console.log(`已按完整资源清单检查 ${batch} 的 ${sources.length} 款新增游戏。`);
} catch (error) {
  failures.push(`${batch} 新增游戏资源清单检查失败：${error instanceof Error ? error.message : String(error)}`);
}
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`游戏运行包检查通过：${requiredFiles.length} 个关键文件。`);
}

import { lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectGameManifests } from "./generate-game-catalog.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  const [id, ...options] = process.argv.slice(2);
  if (!id || options.length > 1 || options.some(option => option !== "--external")) {
    throw new Error("用法：node scripts/new-game.mjs <id> [--external]");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("id 只能使用小写字母、数字和单个连字符，不能以连字符开头或结尾");
  }

  // Protect existing runtime directories as well as manifests in every catalog root.
  for (const root of ["public/games", "external-games", "game-sources/rejected"]) {
    if (await exists(path.join(projectRoot, root, id))) throw new Error(`游戏目录已存在：${root}/${id}`);
  }
  const entries = await collectGameManifests();
  if (entries.some(({ manifest }) => manifest.id === id)) throw new Error(`游戏 id 重复：${id}`);
  const order = Math.max(0, ...entries.map(({ manifest }) => manifest.order)) + 1;
  if (!Number.isSafeInteger(order)) throw new Error("无法分配安全的下一个 order，请检查现有 game.json");

  const external = options.includes("--external");
  // Empty text, TODO enum values and null booleans intentionally fail the existing validator.
  // Do not insert apparently valid sample gameplay, licensing or online claims.
  const manifest = {
    schemaVersion: 3,
    id,
    order,
    discovery: {
      genres: ["TODO:discovery.genres"],
      online: "TODO:discovery.online",
      audiences: ["TODO:discovery.audiences"],
    },
    theme: { accent: "TODO:theme.accent", dark: "TODO:theme.dark" },
    presentation: {
      title: "",
      mark: "",
      category: "",
      tagline: "",
      description: "",
      tags: [""],
      play: {
        modes: "",
        players: "",
        controls: "",
        inputs: ["TODO:presentation.play.inputs"],
        devices: ["TODO:presentation.play.devices"],
        vision: null,
      },
      highlights: [""],
      art: {},
      availability: { state: external ? "external" : "playable", label: "" },
      actionLabel: "",
    },
    platform: {
      hosting: external ? "server" : "static",
      technology: "",
      license: "",
      sourceUrl: "TODO:platform.sourceUrl",
      localization: "",
      fit: "",
      highlights: [""],
      cautions: [""],
      launch: external
        ? { kind: "external", url: "TODO:platform.launch.url" }
        : { kind: "iframe", entry: `/games/${id}/index.html` },
    },
    capabilities: ["TODO:capabilities"],
    permissions: ["TODO:permissions"],
  };

  const root = external ? "external-games" : "public/games";
  const directory = path.join(projectRoot, root, id);
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory); // No recursive creation here: an existing game must never be overwritten.
  await writeFile(path.join(directory, "game.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  console.log(`已创建 ${root}/${id}/game.json（schemaVersion=3，order=${order}）。`);
  console.log('请逐项填写 TODO、空字符串和 null；tags/highlights/cautions/capabilities/permissions 无适用项时填写 []。未完成前目录校验和构建会失败。');
  console.log("分类与联机词表：src/platform/game-taxonomy.json；完整步骤：docs/adding-a-game.md。");
  console.log("填写后运行 corepack pnpm games:catalog，根据具体字段错误继续修正。");
}

main().catch(error => {
  console.error(`新增游戏失败：${error.message}`);
  process.exitCode = 1;
});

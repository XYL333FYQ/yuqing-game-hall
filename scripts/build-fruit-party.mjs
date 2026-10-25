import { cp, mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
// 果切源码与 public 发布目录分离，不参与平台 Vite 构建。
const sourceRoot = path.join(projectRoot, "games", "fruit-party", "src");
// 果切是独立游戏包。中间构建目录不属于平台产物，也不应污染项目工作区。
const stagingRoot = await mkdtemp(path.join(tmpdir(), "yuqing-fruit-party-"));
const publicRoot = path.join(projectRoot, "public", "games", "fruit-party");
const TEXT_FILE = /\.(?:html|js|css|json)$/;

/** 递归复制构建产物；文本文件仅换行不同（Windows autocrlf）时跳过，避免工作区无谓变脏。 */
async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyTree(source, target);
      continue;
    }
    if (TEXT_FILE.test(entry.name)) {
      const [next, current] = await Promise.all([readFile(source, "utf8"), readFile(target, "utf8").catch(() => undefined)]);
      if (current !== undefined && current.replace(/\r\n/g, "\n") === next.replace(/\r\n/g, "\n")) continue;
    }
    await cp(source, target);
  }
}

try {
  await build({
    root: sourceRoot,
    configFile: false,
    base: "./",
    publicDir: path.join(sourceRoot, "public"),
    build: {
      outDir: stagingRoot,
      emptyOutDir: true,
      target: "es2022",
      sourcemap: false,
    },
  });

  await mkdir(publicRoot, { recursive: true });
  const publicAssets = path.join(publicRoot, "assets");
  await mkdir(publicAssets, { recursive: true });
  // 只清理本次构建不再产出的旧 bundle（带哈希的文件名）；同名文件由 copyTree 按内容决定是否覆盖。
  const freshAssets = new Set(await readdir(path.join(stagingRoot, "assets")));
  for (const entry of await readdir(publicAssets)) {
    if (freshAssets.has(entry)) continue;
    if (/^index-.*\.(?:css|js|js\.map)$/.test(entry) || /^smiley-sans-oblique-.*\.woff2$/.test(entry)) {
      await rm(path.join(publicAssets, entry), { force: true });
    }
  }
  await copyTree(stagingRoot, publicRoot);
  // 保留游戏已有的材质、字体、音频等资源；构建只更新 bundle。
  const sourceAssets = path.join(sourceRoot, "assets");
  try {
    await cp(sourceAssets, path.join(publicRoot, "assets"), { recursive: true, force: false, errorOnExist: false });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  console.log("果切派对独立静态入口已生成：public/games/fruit-party/index.html");
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}

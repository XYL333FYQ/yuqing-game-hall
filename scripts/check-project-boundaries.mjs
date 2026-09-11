import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const failures = [];

for (const relativePath of [
  "games/fruit-party/src/index.html",
  "public/games/fruit-party/index.html",
  "server-games/fruit-party/src/server.ts",
  "server-games/sanctuarys-end/server.js",
  "external-games/openfront/game.json",
  "external-games/scribble/game.json",
  "external-games/suroi/game.json",
  "external-games/tosios/game.json",
]) {
  if (!(await exists(relativePath))) failures.push(`缺少架构边界中的必要文件：${relativePath}`);
}

for (const relativePath of [
  "public/games/fruit-party/source",
  "public/games/fruit-party/wrangler.jsonc",
  "public/games/sanctuarys-end/Server",
  "worker/index.ts",
  "wrangler.jsonc",
]) {
  if (await exists(relativePath)) failures.push(`不应出现在当前层级：${relativePath}`);
}

const publicRoot = path.join(projectRoot, "public");
for (const file of await listFiles(publicRoot)) {
  if (/\.(?:ts|tsx|map|coffee)$/i.test(file)) {
    failures.push(`公开运行目录含有开发源码或 source map：${relative(file)}`);
  }
}

const portalSourceRoot = path.join(projectRoot, "src");
for (const file of await listFiles(portalSourceRoot)) {
  if (!/\.ts$/i.test(file)) continue;
  const source = await readFile(file, "utf8");
  if (/from\s+["'][^"']*(?:^|[\\/])(?:games|server-games|external-games)[\\/]/m.test(source)
    || /import\(\s*["'][^"']*(?:^|[\\/])(?:games|server-games|external-games)[\\/]/m.test(source)) {
    failures.push(`平台源码直接导入了游戏、VPS 或外部目录代码：${relative(file)}`);
  }
}

for (const file of await listFiles(path.join(projectRoot, "server-games"))) {
  if (path.basename(file).toLowerCase() === "game.json") {
    failures.push(`第三方游戏 Manifest 不能混入 VPS 服务目录：${relative(file)}`);
  }
  if (path.basename(file).toLowerCase() === "dockerfile") {
    const source = await readFile(file, "utf8");
    if (/^\s*(?:COPY|ADD)\s+.*(?:public|external-games|game-sources)/mi.test(source)) {
      failures.push(`VPS Dockerfile 不能复制静态站点、第三方目录或上游源码：${relative(file)}`);
    }
  }
}

const dockerIgnore = await readFile(path.join(projectRoot, ".dockerignore"), "utf8");
for (const rule of ["public/", "dist/", "external-games/", "game-sources/"]) {
  if (!dockerIgnore.split(/\r?\n/).includes(rule)) {
    failures.push(`.dockerignore 必须排除不会进入 VPS 的目录：${rule}`);
  }
}

const nginxConfig = await readFile(path.join(projectRoot, "server-games/nginx.example.conf"), "utf8");
if (/^\s*(?:root|alias|try_files)\b/mi.test(nginxConfig)) {
  failures.push("VPS Nginx 示例只能代理 API/WSS，不能提供静态文件。");
}

const router = await readFile(path.join(projectRoot, "src/portal/router.ts"), "utf8");
if (!router.includes("/^\\/play\\/") || !router.includes("/^\\/library\\/")) {
  failures.push("平台路由必须保留 /library/<id> 与 /play/<id> 两个命名空间。");
}
if (router.includes("/^\\/games\\/")) {
  failures.push("平台路由不能占用 /games；该命名空间只属于静态游戏运行包。");
}

if (process.argv.includes("--dist")) {
  const distRoot = path.join(projectRoot, "dist");
  if (!(await exists("dist/index.html"))) failures.push("dist/index.html 不存在，无法检查 Cloudflare Pages 成品。");
  for (const file of await listFiles(distRoot)) {
    const rel = relative(file);
    if (rel.startsWith("dist/server-games/") || rel.startsWith("dist/external-games/") || rel.startsWith("dist/game-sources/")) {
      failures.push(`VPS、外部目录源码或上游源码进入了静态成品：${rel}`);
    }
    if (/\.(?:ts|tsx|map|coffee)$/i.test(rel)) {
      failures.push(`开发源码或 source map 进入了 Cloudflare Pages 成品：${rel}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`项目边界检查通过${process.argv.includes("--dist") ? "（包含 Cloudflare Pages 成品）" : ""}。`);
}

async function exists(relativePath) {
  try {
    await access(path.join(projectRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function relative(file) {
  return path.relative(projectRoot, file).replaceAll("\\", "/");
}

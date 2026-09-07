import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestRoots = [
  "games",
  "public/games",
  "server-games",
  "game-sources/rejected",
];

export async function collectGameManifests() {
  const files = [];
  for (const relativeRoot of manifestRoots) {
    await findManifests(path.join(projectRoot, relativeRoot), files);
  }

  const manifests = [];
  for (const absolutePath of files.sort()) {
    const source = path.relative(projectRoot, absolutePath).replaceAll("\\", "/");
    let manifest;
    try {
      manifest = JSON.parse(await readFile(absolutePath, "utf8"));
    } catch (error) {
      throw new Error(`${source} 不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
    }
    validateManifest(manifest, source);
    manifests.push({ manifest, source });
  }

  const ids = new Set();
  const orders = new Set();
  for (const { manifest, source } of manifests) {
    if (ids.has(manifest.id)) throw new Error(`游戏 id 重复：${manifest.id}（${source}）`);
    if (orders.has(manifest.order)) throw new Error(`游戏 order 重复：${manifest.order}（${source}）`);
    ids.add(manifest.id);
    orders.add(manifest.order);
  }
  return manifests.sort((a, b) => a.manifest.order - b.manifest.order);
}

async function findManifests(directory, output) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) await findManifests(absolutePath, output);
    else if (entry.isFile() && entry.name === "game.json") output.push(absolutePath);
  }
}

function validateManifest(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(source, "根节点必须是对象");
  if (value.schemaVersion !== 1) fail(source, "schemaVersion 当前必须是 1");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id ?? "")) fail(source, "id 只能使用小写字母、数字和连字符");
  if (!Number.isInteger(value.order) || value.order < 1) fail(source, "order 必须是大于 0 的整数");
  for (const key of ["name", "originalName", "mark", "category", "description", "hostingLabel", "technology", "license", "sourceUrl", "localization", "fit"]) {
    if (typeof value[key] !== "string" || value[key].trim() === "") fail(source, `${key} 必须是非空字符串`);
  }
  if (!["static", "hybrid", "server", "restricted"].includes(value.hosting)) fail(source, "hosting 值无效");
  if (!value.theme || !isColor(value.theme.accent) || !isColor(value.theme.dark)) fail(source, "theme.accent 与 theme.dark 必须是十六进制颜色");
  for (const key of ["tags", "highlights", "cautions"]) requireStringArray(value[key], source, key);
  if (!value.play || typeof value.play !== "object") fail(source, "缺少 play 配置");
  for (const key of ["modes", "players", "controls"]) {
    if (typeof value.play?.[key] !== "string" || value.play[key].trim() === "") fail(source, `play.${key} 必须是非空字符串`);
  }
  requireEnumArray(value.play?.inputs, source, "play.inputs", ["keyboard", "mouse", "touch", "gamepad", "vision"]);
  requireEnumArray(value.play?.devices, source, "play.devices", ["desktop", "mobile"]);
  if (typeof value.play?.vision !== "boolean") fail(source, "play.vision 必须是布尔值");
  if (value.capabilities !== undefined) requireEnumArray(value.capabilities, source, "capabilities", ["audio", "multiplayer", "vision", "fullscreen", "gamepad", "storage"]);
  if (value.permissions !== undefined) requireEnumArray(value.permissions, source, "permissions", ["camera", "microphone", "fullscreen", "autoplay", "gamepad"]);
  if (!isHttpsUrl(value.sourceUrl)) fail(source, "sourceUrl 必须是 HTTPS 地址");
  if (value.cover !== undefined) requireSafeAssetPath(value.cover, source, "cover");
  if (value.screenshots !== undefined) {
    requireStringArray(value.screenshots, source, "screenshots");
    for (const screenshot of value.screenshots) requireSafeAssetPath(screenshot, source, "screenshots");
  }
  validateLaunch(value, source);
}

function validateLaunch(value, source) {
  const launch = value.launch;
  if (!launch || typeof launch !== "object") fail(source, "缺少 launch 配置");
  if (launch.kind === "native") fail(source, "native 启动方式已移除，请使用 iframe 或 external");
  if (launch.kind === "iframe") {
    if (typeof launch.entry !== "string" || !launch.entry.startsWith(`/games/${value.id}/`) || !launch.entry.endsWith(".html") || launch.entry.includes("..")) {
      fail(source, "iframe entry 必须是该游戏目录下明确的 .html 文件");
    }
    if (launch.upstreamUrl !== undefined && !isHttpUrl(launch.upstreamUrl)) fail(source, "launch.upstreamUrl 必须是 HTTP(S) 地址");
    return;
  }
  if (launch.kind === "external") {
    if (!isHttpsUrl(launch.url)) fail(source, "external url 必须是 HTTPS 地址");
    if (value.hosting !== "server") fail(source, "当前 external 游戏必须明确标记为 server");
    return;
  }
  if (launch.kind === "none") {
    if (value.hosting !== "restricted") fail(source, "none 启动方式只用于 restricted 项目");
    return;
  }
  fail(source, "launch.kind 值无效");
}

function requireStringArray(value, source, key) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) fail(source, `${key} 必须是字符串数组`);
}

function requireEnumArray(value, source, key, allowed) {
  requireStringArray(value, source, key);
  if (value.some((item) => !allowed.includes(item))) fail(source, `${key} 含有不支持的值`);
}

function requireSafeAssetPath(value, source, key) {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("..")) fail(source, `${key} 必须是站内绝对资源路径`);
}

function isColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\//i.test(value);
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function fail(source, message) {
  throw new Error(`${source}: ${message}`);
}

export async function generateGameCatalog() {
  const entries = await collectGameManifests();
  if (entries.length === 0) throw new Error("没有找到任何 game.json。");
  const manifestList = entries.map(({ manifest }) => manifest);
  const sources = entries.map(({ source }) => `// - ${source}`).join("\n");
  const output = `// 此文件由 scripts/generate-game-catalog.mjs 生成，请修改对应 game.json。\n${sources}\nimport type { GameManifest } from "../platform/game-manifest";\n\nexport const GAME_MANIFESTS = ${JSON.stringify(manifestList, null, 2)} as const satisfies readonly GameManifest[];\n`;
  const outputPath = path.join(projectRoot, "src/generated/gameCatalog.ts");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  await writeWorkerRegistry(entries);
  console.log(`游戏目录已生成：${entries.length} 款，来源为 ${entries.length} 份 game.json。`);
}

async function writeWorkerRegistry(entries) {
  const output = `// 此文件由 scripts/generate-game-catalog.mjs 生成。\ninterface Env { ASSETS: Fetcher }\n\nexport default {\n  async fetch(request: Request, env: Env): Promise<Response> {\n    const url = new URL(request.url);\n    if (url.pathname === "/api/health") return Response.json({ ok: true, service: "yuqing-game-hall" });\n    if (url.pathname.startsWith("/api/")) return Response.json({ error: "当前平台没有内置游戏后端。" }, { status: 404 });\n    return env.ASSETS.fetch(request);\n  },\n};\n`;
  await mkdir(path.join(projectRoot, "worker"), { recursive: true });
  await writeFile(path.join(projectRoot, "worker/generated-game-registry.ts"), output, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateGameCatalog();
}

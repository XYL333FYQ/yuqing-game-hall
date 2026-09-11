import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestRoots = [
  "public/games",
  "external-games",
  "game-sources/rejected",
];
const FORBIDDEN_PUBLIC_TERMS = /静态版|部署|架构|技术栈|技术结构|WebSocket|Cloudflare|服务器|许可证|源码|中文化|适配|接入/i;

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
  if (value.schemaVersion !== 2) fail(source, "schemaVersion 当前必须是 2");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id ?? "")) fail(source, "id 只能使用小写字母、数字和连字符");
  if (!Number.isInteger(value.order) || value.order < 1) fail(source, "order 必须是大于 0 的整数");
  if (!value.theme || !isColor(value.theme.accent) || !isColor(value.theme.dark)) fail(source, "theme.accent 与 theme.dark 必须是十六进制颜色");
  if (!value.discovery || typeof value.discovery !== "object") fail(source, "缺少 discovery 配置");
  requireEnumArray(value.discovery.audiences, source, "discovery.audiences", ["single", "duo", "multi"]);
  if (value.discovery.popularRank !== undefined && (!Number.isInteger(value.discovery.popularRank) || value.discovery.popularRank < 1)) {
    fail(source, "discovery.popularRank 必须是大于 0 的整数");
  }
  if (value.discovery.featuredRank !== undefined && (!Number.isInteger(value.discovery.featuredRank) || value.discovery.featuredRank < 1)) {
    fail(source, "discovery.featuredRank 必须是大于 0 的整数");
  }
  const presentation = value.presentation;
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) fail(source, "缺少 presentation 配置");
  for (const key of ["title", "mark", "category", "tagline", "description", "actionLabel"]) {
    if (typeof presentation[key] !== "string" || presentation[key].trim() === "") fail(source, `presentation.${key} 必须是非空字符串`);
  }
  if (presentation.originalTitle !== undefined && (typeof presentation.originalTitle !== "string" || presentation.originalTitle.trim() === "")) {
    fail(source, "presentation.originalTitle 必须是非空字符串");
  }
  requireStringArray(presentation.tags, source, "presentation.tags");
  requireStringArray(presentation.highlights, source, "presentation.highlights");
  const publicCopy = [
    presentation.title,
    presentation.originalTitle ?? "",
    presentation.mark,
    presentation.category,
    presentation.tagline,
    presentation.description,
    presentation.actionLabel,
    ...presentation.tags,
    ...presentation.highlights,
  ];
  if (publicCopy.some((text) => FORBIDDEN_PUBLIC_TERMS.test(text))) fail(source, "presentation 不能包含平台实现、部署或许可说明");
  if (!presentation.play || typeof presentation.play !== "object") fail(source, "缺少 presentation.play 配置");
  for (const key of ["modes", "players", "controls"]) {
    if (typeof presentation.play?.[key] !== "string" || presentation.play[key].trim() === "") fail(source, `presentation.play.${key} 必须是非空字符串`);
  }
  requireEnumArray(presentation.play?.inputs, source, "presentation.play.inputs", ["keyboard", "mouse", "touch", "gamepad", "vision"]);
  requireEnumArray(presentation.play?.devices, source, "presentation.play.devices", ["desktop", "mobile"]);
  if (typeof presentation.play?.vision !== "boolean") fail(source, "presentation.play.vision 必须是布尔值");
  if (!presentation.art || typeof presentation.art !== "object") fail(source, "缺少 presentation.art 配置");
  for (const key of ["icon", "cover", "hero"]) {
    if (presentation.art[key] !== undefined) requireSafeAssetPath(presentation.art[key], source, `presentation.art.${key}`);
  }
  if (presentation.art.screenshots !== undefined) {
    requireStringArray(presentation.art.screenshots, source, "presentation.art.screenshots");
    for (const screenshot of presentation.art.screenshots) requireSafeAssetPath(screenshot, source, "presentation.art.screenshots");
  }
  if (!presentation.availability || !["playable", "external", "unavailable"].includes(presentation.availability.state) || typeof presentation.availability.label !== "string" || presentation.availability.label.trim() === "") {
    fail(source, "presentation.availability 必须包含有效的 state 和 label");
  }
  const platform = value.platform;
  if (!platform || typeof platform !== "object" || Array.isArray(platform)) fail(source, "缺少 platform 配置");
  if (!["static", "hybrid", "server", "restricted"].includes(platform.hosting)) fail(source, "platform.hosting 值无效");
  for (const key of ["technology", "license", "sourceUrl", "localization", "fit"]) {
    if (typeof platform[key] !== "string" || platform[key].trim() === "") fail(source, `platform.${key} 必须是非空字符串`);
  }
  for (const key of ["highlights", "cautions"]) requireStringArray(platform[key], source, `platform.${key}`);
  if (!isHttpsUrl(platform.sourceUrl)) fail(source, "platform.sourceUrl 必须是 HTTPS 地址");
  if (!platform.launch || typeof platform.launch !== "object") fail(source, "缺少 platform.launch 配置");
  if (presentation.availability.state === "playable" && platform.launch.kind === "none") fail(source, "可玩的游戏不能使用 none 启动方式");
  if (presentation.availability.state === "external" && platform.launch.kind !== "external") fail(source, "external 状态必须使用 external 启动方式");
  if (presentation.availability.state === "unavailable" && platform.launch.kind !== "none") fail(source, "unavailable 状态必须使用 none 启动方式");
  if (value.capabilities !== undefined) requireEnumArray(value.capabilities, source, "capabilities", ["audio", "multiplayer", "vision", "fullscreen", "gamepad", "storage"]);
  if (value.permissions !== undefined) requireEnumArray(value.permissions, source, "permissions", ["camera", "microphone", "fullscreen", "autoplay", "gamepad"]);
  validateLaunch(platform.launch, value, source);
}

function validateLaunch(launch, value, source) {
  if (!launch || typeof launch !== "object") fail(source, "缺少 launch 配置");
  if (launch.kind === "native") fail(source, "native 启动方式已移除，请使用 iframe 或 external");
  if (launch.kind === "iframe") {
    if (typeof launch.entry !== "string" || !launch.entry.startsWith(`/games/${value.id}/`) || !launch.entry.endsWith(".html") || launch.entry.includes("..")) {
      fail(source, "iframe entry 必须是该游戏目录下明确的 .html 文件");
    }
    if (launch.startUrl !== undefined) {
      if (typeof launch.startUrl !== "string" || !launch.startUrl.startsWith("/") || launch.startUrl.includes("..")) {
        fail(source, "iframe startUrl 必须是站内启动地址");
      }
      let startUrl;
      try {
        startUrl = new URL(launch.startUrl, "https://yuqing.invalid");
      } catch {
        fail(source, "iframe startUrl 不是有效地址");
      }
      if (startUrl.origin !== "https://yuqing.invalid" || startUrl.pathname !== launch.entry) {
        fail(source, "iframe startUrl 必须仍指向 entry 声明的 HTML 文件");
      }
    }
    if (launch.upstreamUrl !== undefined && !isHttpUrl(launch.upstreamUrl)) fail(source, "launch.upstreamUrl 必须是 HTTP(S) 地址");
    return;
  }
  if (launch.kind === "external") {
    if (!isHttpsUrl(launch.url)) fail(source, "external url 必须是 HTTPS 地址");
    if (value.platform.hosting !== "server") fail(source, "当前 external 游戏必须明确标记为 server");
    return;
  }
  if (launch.kind === "none") {
    if (value.platform.hosting !== "restricted") fail(source, "none 启动方式只用于 restricted 项目");
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
  console.log(`游戏目录已生成：${entries.length} 款，来源为 ${entries.length} 份 game.json。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateGameCatalog();
}

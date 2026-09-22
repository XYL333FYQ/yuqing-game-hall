// 校验仓库里的源码与配置文本文件都是严格 UTF-8。
//
// 为什么需要这个检查：本项目在 Windows 上开发，只要有一个环节用系统 ANSI 代码页（GBK）
// 读写文件，中文就会在「UTF-8 → 按 GBK 解码 → 再按 GBK 写回」的链条里变成双重编码乱码。
// 这种损坏不会让任何测试失败，`node --check` 也照样通过，只会在别人打开文件时才暴露。
// 曾经真的发生过：server-games/webrtc-gateway/server.js 整份变成 GBK，其中 4 行错误信息
// 还丢了「。」和「–」这些字节。
//
// 检查方式是不依赖任何库的严格 UTF-8 校验（逐字节验证多字节序列），
// 而不是用 Buffer.toString('utf8') —— 后者会把非法字节替换成 U+FFFD，容易看漏。
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

// 不检查：依赖、Git 数据、构建产物、上游源码归档、外部下载。
// `upstream` 是第三方源码归档（约 1.9 GB），里面有 2 个带 BOM 的第三方文件，
// 不属于本项目维护范围，因此整体跳过；本项目自己的代码全部在检查范围内。
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  ".wrangler",
  ".vite",
  ".workbuddy-ai",
  ".claude",
  ".omc",
  ".codex-remote-attachments",
  ".playwright-cli",
  "output",
  "references",
  "upstream",
]);

const BINARY_EXTENSIONS = new Set([
  ".mp3", ".ogg", ".mp4", ".webm", ".wav", ".xm", ".flac", ".m4a",
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".bmp", ".tiff", ".svgz",
  ".gltf", ".glb", ".bin", ".ktx2", ".hdr", ".task", ".wasm", ".obj", ".fbx",
  ".woff2", ".woff", ".ttf", ".otf", ".eot",
  ".zip", ".gz", ".tar", ".7z", ".rar", ".pdf", ".psd", ".ai",
  ".db", ".sqlite", ".sqlite3", ".exe", ".dll", ".so", ".dylib", ".node",
  ".class", ".pyc", ".o", ".a", ".lib", ".jar",
]);

/** 逐字节严格校验，不使用会替换非法序列的 Buffer.toString。 */
function isStrictUtf8(buffer) {
  let index = 0;
  while (index < buffer.length) {
    const byte = buffer[index];
    if (byte <= 0x7f) {
      index += 1;
      continue;
    }
    let continuation;
    if (byte >= 0xc2 && byte <= 0xdf) continuation = 1;
    else if (byte >= 0xe0 && byte <= 0xef) continuation = 2;
    else if (byte >= 0xf0 && byte <= 0xf4) continuation = 3;
    else return false;
    if (index + continuation >= buffer.length) return false;
    for (let offset = 1; offset <= continuation; offset += 1) {
      const next = buffer[index + offset];
      if (next < 0x80 || next > 0xbf) return false;
    }
    index += continuation + 1;
  }
  return true;
}

const failures = [];
const bomFiles = [];
let scanned = 0;
let skipped = 0;

function walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    if (BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      skipped += 1;
      continue;
    }
    let buffer;
    try {
      buffer = readFileSync(full);
    } catch {
      continue;
    }
    // 含 NUL 字节的按二进制处理（没有扩展名的可执行文件、字体等）。
    if (buffer.includes(0)) {
      skipped += 1;
      continue;
    }
    scanned += 1;
    const relative = path.relative(projectRoot, full).replaceAll("\\", "/");
    if (!isStrictUtf8(buffer)) {
      failures.push(`${relative}（不是严格 UTF-8，${statSync(full).size} 字节）`);
      continue;
    }
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) bomFiles.push(relative);
  }
}

walk(projectRoot);

if (failures.length > 0) {
  console.error("以下文本文件不是严格 UTF-8，请整体重写而不是局部修补乱码：");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error("提示：在 Windows 上不要用系统 ANSI（GBK）代码页读写这些文件；");
  console.error("     可以用 Node 显式写入：writeFileSync(file, text, { encoding: 'utf8' })。");
  process.exitCode = 1;
} else {
  console.log(`文本编码检查通过：${scanned} 个文件均为严格 UTF-8（跳过 ${skipped} 个二进制文件）。`);
  if (bomFiles.length > 0) {
    console.log(`注意：以下 ${bomFiles.length} 个文件带 UTF-8 BOM，属于合法但可能干扰个别工具：`);
    for (const file of bomFiles) console.log(`  · ${file}`);
  }
}

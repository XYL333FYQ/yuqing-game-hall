import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

const MAX_WORKER_GZIP_BYTES = 3 * 1024 * 1024;
const workerDirectory = path.resolve(process.argv[2] ?? "output/wrangler-check");
const countedExtensions = new Set([".js", ".mjs", ".cjs", ".wasm", ".bin"]);

if (!fs.existsSync(workerDirectory)) {
  throw new Error(`Worker 构建目录不存在：${workerDirectory}`);
}

const files = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.isFile() && countedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(target);
    }
  }
};

visit(workerDirectory);
files.sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  throw new Error(`未在 ${workerDirectory} 中找到 Worker 脚本。`);
}

const parts = [];
for (const file of files) {
  parts.push(Buffer.from(`\n/* ${path.relative(workerDirectory, file)} */\n`));
  parts.push(fs.readFileSync(file));
}

const rawBytes = parts.reduce((total, part) => total + part.length, 0);
const gzipBytes = gzipSync(Buffer.concat(parts), { level: 9 }).length;

if (gzipBytes > MAX_WORKER_GZIP_BYTES) {
  throw new Error(
    `Worker 压缩包 ${(gzipBytes / 1024 / 1024).toFixed(2)} MiB，超过 Cloudflare 免费版 3 MiB 上限。`,
  );
}

console.log(
  `Cloudflare Worker 检查通过：原始 ${(rawBytes / 1024).toFixed(2)} KiB，gzip ${(gzipBytes / 1024).toFixed(2)} KiB。`,
);

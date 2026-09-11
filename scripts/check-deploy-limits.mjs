import fs from "node:fs";
import path from "node:path";

const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_ASSET_COUNT = 20_000;
const distDirectory = path.resolve("dist");

if (!fs.existsSync(distDirectory)) {
  throw new Error("dist 不存在，请先完成构建。");
}

const files = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.isFile()) files.push(target);
  }
};

visit(distDirectory);
const oversized = files
  .map((file) => ({ file, size: fs.statSync(file).size }))
  .filter(({ size }) => size > MAX_ASSET_BYTES);

if (files.length > MAX_ASSET_COUNT) {
  throw new Error(`静态文件数量 ${files.length} 超过 Cloudflare Pages 免费版上限 ${MAX_ASSET_COUNT}。`);
}
if (oversized.length > 0) {
  const details = oversized
    .map(({ file, size }) => `${path.relative(distDirectory, file)}: ${(size / 1024 / 1024).toFixed(2)} MiB`)
    .join("\n");
  throw new Error(`以下文件超过 Cloudflare Pages 单文件 25 MiB 限制：\n${details}`);
}

const largest = files
  .map((file) => ({ file, size: fs.statSync(file).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 5);

console.log(`Cloudflare Pages 静态资源检查通过：${files.length} 个文件。`);
for (const { file, size } of largest) {
  console.log(`  ${(size / 1024 / 1024).toFixed(2)} MiB  ${path.relative(distDirectory, file)}`);
}

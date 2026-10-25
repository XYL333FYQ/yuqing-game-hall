import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function resolveFile(relative) {
  if (typeof relative !== "string" || !relative.trim() || /[\r\n]/.test(relative) || path.isAbsolute(relative)) {
    throw new Error(`无效的共享文件路径：${relative}`);
  }
  const absolute = path.resolve(projectRoot, relative);
  const fromRoot = path.relative(projectRoot, absolute);
  if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) {
    throw new Error(`共享文件路径必须位于项目内：${relative}`);
  }
  return absolute;
}

async function readCopy(file) {
  try {
    return await readFile(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--check")) throw new Error("用法：node scripts/sync-shared.mjs [--check]");
  const check = args.includes("--check");
  const config = JSON.parse(await readFile(path.join(projectRoot, "shared-sync.json"), "utf8"));
  if (!Array.isArray(config.files) || !config.files.length) throw new Error("shared-sync.json 必须包含非空 files 映射数组");

  const mappings = config.files.map(({ source, target }) => ({
    source, target, sourceFile: resolveFile(source), targetFile: resolveFile(target),
  }));
  const sources = new Set(mappings.map(item => item.sourceFile));
  const targets = new Set();
  for (const item of mappings) {
    if (sources.has(item.targetFile) || targets.has(item.targetFile)) {
      throw new Error(`共享副本不能覆盖源文件或重复目标：${item.target}`);
    }
    targets.add(item.targetFile);
  }

  const stale = [];
  for (const { source, target, sourceFile, targetFile } of mappings) {
    const body = await readFile(sourceFile);
    // Only the generated header is new text; preserve every source byte, including mixed EOLs.
    const firstLF = body.indexOf(10);
    const eol = firstLF > 0 && body[firstLF - 1] === 13 ? "\r\n" : "\n";
    const expected = Buffer.concat([
      Buffer.from(`// 此文件由 shared-sync.json 同步生成，请修改 ${source}${eol}`), body,
    ]);
    const actual = await readCopy(targetFile);
    if (actual?.equals(expected)) continue;
    if (check) {
      stale.push(target);
    } else {
      await mkdir(path.dirname(targetFile), { recursive: true });
      await writeFile(targetFile, expected);
      console.log(`已同步：${source} -> ${target}`);
    }
  }

  if (stale.length) {
    console.error(`共享副本不一致（${stale.length}）：\n${stale.map(file => `  ${file}`).join("\n")}`);
    console.error("请运行 node scripts/sync-shared.mjs 后再检查。");
    process.exitCode = 1;
  } else {
    console.log(`共享代码${check ? "检查" : "同步"}通过：${mappings.length} 个映射。`);
  }
}

main().catch(error => {
  console.error(`共享代码同步失败：${error.message}`);
  process.exitCode = 1;
});

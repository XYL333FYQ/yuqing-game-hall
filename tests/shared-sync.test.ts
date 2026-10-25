import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), "yuqing-shared-sync-"));
  mkdirSync(path.join(fixtureRoot, "scripts"));
  copyFileSync(new URL("../scripts/sync-shared.mjs", import.meta.url), path.join(fixtureRoot, "scripts/sync-shared.mjs"));
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function write(relative: string, content: string) {
  const file = path.join(fixtureRoot, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function configure(files: { source: string; target: string }[]) {
  write("shared-sync.json", JSON.stringify({ files }));
}

function run(...args: string[]) {
  // Resolve the config relative to the script, even when invoked from another directory.
  const result = spawnSync(process.execPath, [path.join(fixtureRoot, "scripts/sync-shared.mjs"), ...args], {
    cwd: tmpdir(), encoding: "utf8",
  });
  expect(result.error).toBeUndefined();
  return result;
}

it("syncs arbitrary mappings with one header and byte-identical source bodies", () => {
  configure([
    { source: "source/alpha.js", target: "release/deep/alpha.js" },
    { source: "source/beta.js", target: "release/beta.js" },
  ]);
  write("source/alpha.js", "// 中文\r\nconst alpha = 1;\n\r\n");
  write("source/beta.js", "const beta = 2;\n");
  const source = readFileSync(path.join(fixtureRoot, "source/alpha.js"));
  expect(run().status).toBe(0);
  expect(run().status).toBe(0);
  expect(readFileSync(path.join(fixtureRoot, "release/deep/alpha.js"))).toEqual(Buffer.concat([
    Buffer.from("// 此文件由 shared-sync.json 同步生成，请修改 source/alpha.js\r\n"), source,
  ]));
  expect(readFileSync(path.join(fixtureRoot, "release/beta.js"), "utf8")).toBe(
    "// 此文件由 shared-sync.json 同步生成，请修改 source/beta.js\nconst beta = 2;\n",
  );
  expect(readFileSync(path.join(fixtureRoot, "source/alpha.js"))).toEqual(source);
  expect(run("--check").status).toBe(0);
});

it("check reports every stale or missing copy without writing anything", () => {
  configure([
    { source: "source/alpha.js", target: "release/alpha.js" },
    { source: "source/beta.js", target: "release/beta.js" },
  ]);
  write("source/alpha.js", "const alpha = 1;\n");
  write("source/beta.js", "const beta = 2;\n");
  write("release/alpha.js", "stale\n");
  const result = run("--check");
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).toContain("release/alpha.js");
  expect(result.stdout + result.stderr).toContain("release/beta.js");
  expect(readFileSync(path.join(fixtureRoot, "release/alpha.js"), "utf8")).toBe("stale\n");
  expect(() => readFileSync(path.join(fixtureRoot, "release/beta.js"))).toThrow();
  expect(run().status).toBe(0);
  write("source/alpha.js", "const alpha = 3;\n");
  expect(run("--check").status).toBe(1);
  expect(run().status).toBe(0);
  expect(run("--check").status).toBe(0);
});

it("supports multiple copies of a source with no final newline", () => {
  configure([
    { source: "source/shared.js", target: "web/shared.js" },
    { source: "source/shared.js", target: "worker/shared.js" },
  ]);
  write("source/shared.js", "const shared = 1;");
  expect(run().status).toBe(0);
  expect(readFileSync(path.join(fixtureRoot, "web/shared.js"), "utf8")).toBe(
    "// 此文件由 shared-sync.json 同步生成，请修改 source/shared.js\nconst shared = 1;",
  );
  expect(readFileSync(path.join(fixtureRoot, "worker/shared.js")))
    .toEqual(readFileSync(path.join(fixtureRoot, "web/shared.js")));
  expect(run("--check").status).toBe(0);
});

it("build rejects drift before asset preparation can silently regenerate it", () => {
  configure([{ source: "source/shared.js", target: "release/shared.js" }]);
  write("source/shared.js", "const shared = 1;\n");
  write("release/shared.js", "stale\n");
  const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  write("package.json", JSON.stringify({
    private: true,
    scripts: {
      prebuild: scripts.prebuild,
      "prepare:games": "node scripts/sync-shared.mjs",
      build: "node -e \"process.exit(0)\"",
    },
  }));
  const result = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm run build"], { cwd: fixtureRoot, encoding: "utf8" })
    : spawnSync("npm", ["run", "build"], { cwd: fixtureRoot, encoding: "utf8" });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).toContain("release/shared.js");
  expect(readFileSync(path.join(fixtureRoot, "release/shared.js"), "utf8")).toBe("stale\n");
});

it.each([
  [{ source: "source/shared.js", target: "source/shared.js" }],
  [{ source: "source/shared.js", target: "../outside.js" }],
  [
    { source: "source/shared.js", target: "release/shared.js" },
    { source: "source/shared.js", target: "release/shared.js" },
  ],
  [
    { source: "source/shared.js", target: "release/shared.js" },
    { source: "release/shared.js", target: "release/other.js" },
  ],
])("rejects unsafe mappings before overwriting any file: %j", (...files) => {
  configure(files);
  write("source/shared.js", "const shared = 1;\n");
  write("release/shared.js", "original copy\n");
  expect(run().status).toBe(1);
  expect(readFileSync(path.join(fixtureRoot, "source/shared.js"), "utf8")).toBe("const shared = 1;\n");
  expect(readFileSync(path.join(fixtureRoot, "release/shared.js"), "utf8")).toBe("original copy\n");
});

import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), "yuqing-encoding-"));
  mkdirSync(path.join(fixtureRoot, "scripts"));
  copyFileSync(
    new URL("../scripts/check-text-encoding.mjs", import.meta.url),
    path.join(fixtureRoot, "scripts/check-text-encoding.mjs"),
  );
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function writeFixture(relative: string, bytes: number[] | string) {
  const file = path.join(fixtureRoot, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof bytes === "string" ? bytes : Buffer.from(bytes));
}

function checkEncoding() {
  const result = spawnSync(process.execPath, [path.join(fixtureRoot, "scripts/check-text-encoding.mjs")], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
  expect(result.error).toBeUndefined();
  return result;
}

describe("text encoding CLI", () => {
  it.each([
    ["overlong three-byte encoding", [0xe0, 0x80, 0x80]],
    ["overlong four-byte encoding", [0xf0, 0x80, 0x80, 0x80]],
    ["UTF-16 surrogate", [0xed, 0xa0, 0x80]],
    ["code point above U+10FFFF", [0xf4, 0x90, 0x80, 0x80]],
    ["truncated sequence", [0xe4, 0xb8]],
    ["isolated continuation byte", [0x80]],
  ])("rejects %s", (_name, bytes) => {
    writeFixture("source.txt", bytes);

    const result = checkEncoding();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("source.txt");
  });

  it("accepts Unicode scalar boundaries and normal multilingual text", () => {
    writeFixture("source.txt", [
      0xc2, 0x80, // U+0080
      0xdf, 0xbf, // U+07FF
      0xe0, 0xa0, 0x80, // U+0800
      0xed, 0x9f, 0xbf, // U+D7FF
      0xee, 0x80, 0x80, // U+E000
      0xef, 0xbf, 0xbf, // U+FFFF
      0xf0, 0x90, 0x80, 0x80, // U+10000
      0xf4, 0x8f, 0xbf, 0xbf, // U+10FFFF
    ]);
    writeFixture("multilingual.txt", "ASCII 中文 日本語 🎮\n");

    const result = checkEncoding();

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("allows UTF-8 BOM and reports its file", () => {
    writeFixture("bom.txt", [0xef, 0xbb, 0xbf, 0x61]);

    const result = checkEncoding();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("BOM");
    expect(result.stdout).toContain("bom.txt");
  });

  it("skips binary files and nested dependency or output directories", () => {
    writeFixture("asset.png", [0xff]);
    writeFixture("binary.txt", [0x00, 0xff]);
    writeFixture("nested/node_modules/package/invalid.txt", [0xff]);
    writeFixture("nested/output/invalid.txt", [0xff]);

    const result = checkEncoding();

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});

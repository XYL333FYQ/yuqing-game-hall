import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";

let fixtureRoot: string | undefined;
afterEach(async () => {
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
  fixtureRoot = undefined;
});

it("does not rewrite an unchanged catalog and still updates changed manifests", async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "yuqing-catalog-test-"));
  await mkdir(path.join(fixtureRoot, "scripts"));
  await mkdir(path.join(fixtureRoot, "public/games/doudizhu"), { recursive: true });
  const scriptPath = path.join(fixtureRoot, "scripts/generate-game-catalog.mjs");
  const manifestPath = path.join(fixtureRoot, "public/games/doudizhu/game.json");
  await copyFile(new URL("../scripts/generate-game-catalog.mjs", import.meta.url), scriptPath);
  const manifest = JSON.parse(await readFile(new URL("../public/games/doudizhu/game.json", import.meta.url), "utf8"));
  await writeFile(manifestPath, JSON.stringify(manifest));
  const generate = () => execFileSync(process.execPath, [scriptPath], { cwd: fixtureRoot, stdio: "pipe" });
  generate();
  const output = path.join(fixtureRoot, "src/generated/gameCatalog.ts");
  await utimes(output, new Date("2020-01-01"), new Date("2020-01-01"));
  const previous = await stat(output);
  generate();
  expect((await stat(output)).mtimeMs).toBe(previous.mtimeMs);

  manifest.presentation.tagline = "邀请好友，开启新的一局";
  await writeFile(manifestPath, JSON.stringify(manifest));
  generate();
  expect(await readFile(output, "utf8")).toContain(manifest.presentation.tagline);
  expect((await stat(output)).mtimeMs).not.toBe(previous.mtimeMs);
});

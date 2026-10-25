import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), "yuqing-new-game-"));
  mkdirSync(path.join(fixtureRoot, "scripts"));
  mkdirSync(path.join(fixtureRoot, "src/platform"), { recursive: true });
  for (const script of ["new-game.mjs", "generate-game-catalog.mjs"]) {
    copyFileSync(new URL(`../scripts/${script}`, import.meta.url), path.join(fixtureRoot, "scripts", script));
  }
  copyFileSync(new URL("../src/platform/game-taxonomy.json", import.meta.url), path.join(fixtureRoot, "src/platform/game-taxonomy.json"));
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function run(script: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [path.join(fixtureRoot, "scripts", script), ...args], {
    cwd: tmpdir(), encoding: "utf8", timeout: 10_000,
  });
  expect(result.error).toBeUndefined();
  return result;
}

function writeManifest(relative: string, manifest: any) {
  const file = path.join(fixtureRoot, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
}

function fillTemplate(manifest: any, external = false) {
  manifest.theme.accent = "#123456";
  manifest.theme.dark = "#012345";
  manifest.discovery.genres = ["puzzle"];
  manifest.discovery.online = external ? "public" : "none";
  manifest.discovery.audiences = external ? ["multi"] : ["single"];
  Object.assign(manifest.presentation, {
    title: "星图", mark: "星", category: "连线挑战", tagline: "连接星点，解开谜题。",
    description: "移动星点完成每关的图案。", tags: ["连线"], highlights: ["逐关挑战"], actionLabel: "开始游戏",
  });
  Object.assign(manifest.presentation.play, {
    modes: "闯关", players: external ? "多人对局" : "1 人", controls: "鼠标点击",
    inputs: ["mouse"], devices: ["desktop"], vision: false,
  });
  manifest.presentation.availability.label = external ? "在线体验" : "可直接游玩";
  Object.assign(manifest.platform, {
    technology: "JavaScript", license: "MIT", sourceUrl: "https://example.com/project",
    localization: "中文界面", fit: "独立运行", highlights: ["独立入口"], cautions: [],
  });
  if (external) manifest.platform.launch.url = "https://example.com/play";
  manifest.capabilities = external ? ["multiplayer"] : [];
  manifest.permissions = [];
  return manifest;
}

it.each([false, true])("creates a complete template rejected until human choices are filled (external=%s)", external => {
  const root = external ? "external-games" : "public/games";
  const relative = `${root}/star-map/game.json`;
  const result = run("new-game.mjs", "star-map", ...(external ? ["--external"] : []));
  expect(result.status).toBe(0);
  const file = path.join(fixtureRoot, relative);
  const template = JSON.parse(readFileSync(file, "utf8"));
  expect(template.schemaVersion).toBe(3);
  expect(template.id).toBe("star-map");
  expect(template.order).toBe(1);
  expect(template.platform.hosting).toBe(external ? "server" : "static");
  expect(template.platform.launch.kind).toBe(external ? "external" : "iframe");
  expect(template.presentation.availability.state).toBe(external ? "external" : "playable");
  if (!external) expect(template.platform.launch.entry).toBe("/games/star-map/index.html");
  expect(readdirSync(path.dirname(file))).toEqual(["game.json"]);
  expect(existsSync(path.join(fixtureRoot, external ? "public/games/star-map" : "external-games/star-map"))).toBe(false);

  const rejected = run("generate-game-catalog.mjs");
  expect(rejected.status).not.toBe(0);
  expect(rejected.stderr).toContain(relative);
  expect(rejected.stderr).toContain("theme.accent");
  expect(rejected.stderr).not.toContain("presentation 不能包含");
  expect(existsSync(path.join(fixtureRoot, "src/generated/gameCatalog.ts"))).toBe(false);

  writeManifest(relative, fillTemplate(template, external));
  const accepted = run("generate-game-catalog.mjs");
  expect(accepted.status).toBe(0);
  expect(readFileSync(path.join(fixtureRoot, "src/generated/gameCatalog.ts"), "utf8")).toContain('"id": "star-map"');
});

it("keeps every human-required placeholder invalid with a field-specific diagnostic", () => {
  expect(run("new-game.mjs", "star-map", "--external").status).toBe(0);
  const relative = "external-games/star-map/game.json";
  const template = JSON.parse(readFileSync(path.join(fixtureRoot, relative), "utf8"));
  const filled = fillTemplate(structuredClone(template), true);
  const pendingPaths = [
    "theme.accent", "theme.dark", "discovery.genres", "discovery.online", "discovery.audiences",
    "presentation.title", "presentation.mark", "presentation.category", "presentation.tagline", "presentation.description",
    "presentation.tags", "presentation.highlights", "presentation.actionLabel", "presentation.availability.label",
    "presentation.play.modes", "presentation.play.players", "presentation.play.controls",
    "presentation.play.inputs", "presentation.play.devices", "presentation.play.vision",
    "platform.technology", "platform.license", "platform.sourceUrl", "platform.localization", "platform.fit",
    "platform.highlights", "platform.cautions", "platform.launch.url", "capabilities", "permissions",
  ];
  for (const key of pendingPaths) {
    expect(template).toHaveProperty(key);
    const parts = key.split(".");
    const field = parts.pop()!;
    const draft = structuredClone(filled);
    const parent = parts.reduce((value, part) => value[part], draft);
    parent[field] = parts.reduce((value, part) => value[part], template)[field];
    writeManifest(relative, draft);
    const result = run("generate-game-catalog.mjs");
    expect(result.status, key).not.toBe(0);
    // Availability validation reports its containing object; launch URL validation names the kind.
    const diagnostic = key === "presentation.availability.label" ? "presentation.availability"
      : key === "platform.launch.url" ? "external url" : key;
    expect(result.stderr, key).toContain(diagnostic);
    expect(result.stderr, key).not.toContain("presentation 不能包含");
  }
}, 15_000);

it("takes the next order and detects duplicate ids across every catalog root", () => {
  const seed = JSON.parse(readFileSync(new URL("../public/games/doudizhu/game.json", import.meta.url), "utf8"));
  for (const [root, id, order] of [
    ["public/games", "first", 7], ["external-games", "second", 30], ["game-sources/rejected", "third", 60],
  ] as const) {
    writeManifest(`${root}/${id}/game.json`, { ...seed, id, order, platform: { ...seed.platform, launch: { kind: "iframe", entry: `/games/${id}/index.html` } } });
  }
  expect(run("new-game.mjs", "next").status).toBe(0);
  const next = JSON.parse(readFileSync(path.join(fixtureRoot, "public/games/next/game.json"), "utf8"));
  expect(next.order).toBe(61);
  // Complete the draft so duplicate detection is tested against an otherwise valid catalog.
  writeManifest("public/games/next/game.json", fillTemplate(next));
  for (const id of ["first", "second", "third", "next"]) {
    const result = run("new-game.mjs", id, "--external");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(id);
    expect(result.stderr).toMatch(/已存在|重复/);
  }
  expect(existsSync(path.join(fixtureRoot, "external-games/first"))).toBe(false);
});

it("refuses an existing directory without a manifest and never overwrites its files", () => {
  const directory = path.join(fixtureRoot, "public/games/occupied");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "index.html"), "existing game");
  expect(run("new-game.mjs", "occupied").status).not.toBe(0);
  expect(readFileSync(path.join(directory, "index.html"), "utf8")).toBe("existing game");
  expect(existsSync(path.join(directory, "game.json"))).toBe(false);
});

it.each([[], ["Upper"], ["../escape"], ["-leading"], ["trailing-"], ["double--dash"], ["a_b"], ["demo", "--unknown"], ["demo", "extra"]])(
  "rejects invalid ids or arguments without creating game files: %j", (...args) => {
    const result = run("new-game.mjs", ...args);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/id|用法/);
    expect(existsSync(path.join(fixtureRoot, "public"))).toBe(false);
    expect(existsSync(path.join(fixtureRoot, "external-games"))).toBe(false);
  },
);

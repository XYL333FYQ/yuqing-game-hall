import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import taxonomy from "../src/platform/game-taxonomy.json";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestRoots = ["public/games", "external-games", "game-sources/rejected"];
const GENRE_IDS = Object.keys(taxonomy.genres);
const ONLINE_MODE_IDS = Object.keys(taxonomy.onlineModes);
/** 与结构化字段重复、禁止写进 tags 的词；人数用 discovery.audiences，联机用 discovery.online。 */
const FORBIDDEN_TAG_WORDS = ["单人", "双人", "多人", "联机", "好友联机", "本地双人"];
const PLAYER_COUNT_TAG = /^\d+(?:\s*[–-]\s*\d+)?\s*人$/;

type RawManifest = Record<string, any>;

async function findManifests(directory: string, output: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await findManifests(absolute, output);
    else if (entry.isFile() && entry.name === "game.json") output.push(absolute);
  }
}

async function collectManifests(): Promise<Array<{ manifest: RawManifest; source: string }>> {
  const files: string[] = [];
  for (const relativeRoot of manifestRoots) {
    await findManifests(path.join(projectRoot, relativeRoot), files);
  }
  const entries = [];
  for (const absolutePath of files.sort()) {
    const source = path.relative(projectRoot, absolutePath).replaceAll("\\", "/");
    entries.push({ manifest: JSON.parse(await readFile(absolutePath, "utf8")) as RawManifest, source });
  }
  return entries;
}

describe("游戏目录一致性", () => {
  it("遍历全部 game.json，逐条断言含义规则", async () => {
    const entries = await collectManifests();
    expect(entries.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const { manifest, source } of entries) {
      if (manifest.schemaVersion !== 3) violations.push(`${source}: schemaVersion 必须是 3`);
      const genres = manifest.discovery?.genres;
      if (!Array.isArray(genres) || genres.length < 1 || genres.length > 2) {
        violations.push(`${source}: discovery.genres 必须是 1~2 个分类 id`);
      } else if (genres.some((genre: string) => !GENRE_IDS.includes(genre))) {
        violations.push(`${source}: discovery.genres 含词表外 id：${genres.join("、")}`);
      }
      const online = manifest.discovery?.online;
      if (!ONLINE_MODE_IDS.includes(online)) {
        violations.push(`${source}: discovery.online 必须是词表 id（${ONLINE_MODE_IDS.join("、")}）`);
      } else {
        const hasMultiplayer = Array.isArray(manifest.capabilities) && manifest.capabilities.includes("multiplayer");
        if (online !== "none" && !hasMultiplayer) violations.push(`${source}: discovery.online 为 "${online}" 但 capabilities 不含 "multiplayer"`);
        if (online === "none" && hasMultiplayer) violations.push(`${source}: capabilities 含 "multiplayer" 但 discovery.online 为 "none"`);
        if (manifest.discovery?.audiences?.includes("multi") && online === "none") violations.push(`${source}: audiences 含 "multi" 但 discovery.online 为 "none"`);
        if (manifest.platform?.hosting === "server" && online === "none") violations.push(`${source}: hosting 为 "server" 但 discovery.online 为 "none"`);
      }
      for (const tag of manifest.presentation?.tags ?? []) {
        if (FORBIDDEN_TAG_WORDS.includes(tag) || PLAYER_COUNT_TAG.test(tag)) {
          violations.push(`${source}: tags 中的 "${tag}" 与结构化字段重复，人数用 audiences、联机用 discovery.online 表达`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("audiences 含 multi 或 hosting 为 server 的游戏，capabilities 必须含 multiplayer", async () => {
    const entries = await collectManifests();
    const missing = entries
      .filter(({ manifest }) => manifest.discovery.audiences.includes("multi") || manifest.platform.hosting === "server")
      .filter(({ manifest }) => !(manifest.capabilities ?? []).includes("multiplayer"))
      .map(({ manifest }) => manifest.id);
    expect(missing).toEqual([]);
  });

  it("已知联机游戏标注了正确的联机方式，可玩的联机游戏共 11 款", async () => {
    const entries = await collectManifests();
    const onlineById = new Map(entries.map(({ manifest }) => [manifest.id as string, manifest]));
    const friendRoom = ["gobang", "mahjong", "guandan", "doudizhu", "fruit-party", "der-koloss", "pvp-arena"];
    const publicMatch = ["tosios", "suroi", "scribble", "openfront", "kaetram"];
    for (const id of friendRoom) expect(onlineById.get(id)?.discovery.online, id).toBe("friend-room");
    for (const id of publicMatch) expect(onlineById.get(id)?.discovery.online, id).toBe("public");
    const playableOnline = entries
      .filter(({ manifest }) => manifest.discovery.online !== "none" && manifest.platform.launch.kind !== "none")
      .map(({ manifest }) => manifest.id);
    expect(playableOnline).toHaveLength(11);
    expect(playableOnline).toEqual(expect.arrayContaining([...friendRoom, "tosios", "suroi", "scribble", "openfront"]));
  });
});

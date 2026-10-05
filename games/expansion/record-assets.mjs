// Run after deliberately updating an imported runtime, then review the diff.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const games = JSON.parse(await readFile(new URL('./SOURCES.json', import.meta.url), 'utf8'));
const excluded = new Set(['source.zip', 'cover.png', 'SOURCE.md', 'LICENSE', 'game.json']);
const inventory = {};
for (const { id } of games) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid game id: ${id}`);
  const directory = path.join(root, 'public/games', id);
  const files = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && !excluded.has(entry.name)) files.push(path.relative(directory, full).replaceAll('\\', '/'));
    }
  }
  await visit(directory);
  inventory[id] = files.sort();
}
await writeFile(new URL('./runtime-assets.json', import.meta.url), JSON.stringify(inventory, null, 2) + '\n');
console.log(`Recorded runtime assets for ${games.length} games. Review changes before accepting.`);

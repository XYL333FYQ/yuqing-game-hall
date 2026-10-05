// Rebuild only the four TypeScript runtimes which need source-level fixes.
// Other imported games retain their upstream runtime, with readable local edits.
import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../../', import.meta.url));
const id = process.argv[2];
const sources = JSON.parse(await readFile(new URL('./SOURCES.json', import.meta.url), 'utf8'));
const game = sources.find(game => game.id === id);
const patches = {
  'casual-crusade': { source: '/src/pile.ts', modify: code => code.replace(/\s*super\(0, 0, 0, 0\);/, '') },
  'norman-necromancer': { source: '/src/engine.ts', file: 'norman-engine.ts' },
  'backcountry': { source: '/src/actions.ts', file: 'backcountry-actions.ts' },
  'thirteenth-floor': { source: '/src/index.ts', file: 'thirteenth-floor-index.ts' },
};
const patch = patches[id];
if (!game || !patch) throw new Error('支持：casual-crusade、norman-necromancer、backcountry、thirteenth-floor');
const root = path.resolve(process.argv[3] || path.join(project, 'game-sources/upstream/expansion', game.folder));
const outDir = path.join(project, 'public/games', id);
const oldHtml = await readFile(path.join(outDir, 'index.html'), 'utf8');
const patched = patch.file ? await readFile(new URL('./overrides/' + patch.file, import.meta.url), 'utf8') : undefined;
const library = id === 'casual-crusade' || id === 'backcountry';
await build({
  root, configFile: false, publicDir: false, base: './', logLevel: 'warn',
  resolve: { alias: { '@': path.join(root, 'src') } },
  plugins: [{ name: 'yuqing-source-adaptation', enforce: 'pre', transform(code, filename) {
    if (filename.replaceAll('\\', '/').endsWith(patch.source)) return patched ?? patch.modify(code);
  } }],
  build: { outDir, emptyOutDir: false, minify: false, sourcemap: false,
    ...(library ? { lib: { entry: path.join(root, 'src/index.ts'), name: 'Game', formats: ['iife'], fileName: () => 'app.js' } } : {}),
  },
});
if (!library) {
  const generated = await readFile(path.join(outDir, 'index.html'), 'utf8');
  const script = generated.match(/src="([^"]+\.js)"/)[1];
  await writeFile(path.join(outDir, 'index.html'), oldHtml.replace(/src="\.\/assets\/[^\"]+\.js"/, `src="${script}"`));
}
console.log(`${id} 已重新构建；检查运行后重新生成 source.zip 和资源清单。`);

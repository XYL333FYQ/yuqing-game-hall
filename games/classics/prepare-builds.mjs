// Optional maintenance build, never run by normal hall CI.
import { readFile, writeFile, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const upstream = path.join(root, 'game-sources/upstream/classics');
function npm(cwd, args) {
  const result = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d','/s','/c', 'npm.cmd', ...args] : args, {cwd,stdio:'inherit'});
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed`);
}
const mines = path.join(upstream,'minesweeper');
const i18n = path.join(mines,'src/i18n.js');
let source = await readFile(i18n,'utf8');
source = source.replace("return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'", "return 'zh'");
await writeFile(i18n,source);
npm(mines,['ci','--ignore-scripts','--no-audit','--no-fund']);
npm(mines,['test']);
npm(mines,['run','build']);
const lock = path.join(upstream,'breaklock');
// Upstream includes obsolete node-sass. The recorded lock replaces it with
// Dart Sass; all modifications stay in the isolated upstream build directory.
for (const name of ['package.json','package-lock.json']) await cp(new URL(`./build-inputs/breaklock/${name}`,import.meta.url),path.join(lock,name));
npm(lock,['ci','--ignore-scripts','--no-audit','--no-fund']);
npm(lock,['run','build']);

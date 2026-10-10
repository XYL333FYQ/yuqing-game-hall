// Maintenance import only. Normal hall builds use the committed static runtimes.
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceFile = new URL('./SOURCES.json', import.meta.url);
const games = JSON.parse(await readFile(sourceFile, 'utf8'));
const inventory = {};
const read = async file => (await readFile(file, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const put = (file, text) => writeFile(file, text, 'utf8');
function replace(text, from, to) {
  if (!text.includes(from)) throw new Error(`Missing adaptation anchor: ${from}`);
  return text.replaceAll(from, to);
}
async function edit(file, from, to) { await put(file, replace(await read(file), from, to)); }
async function listFiles(directory, prefix = '') {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${item.name}`;
    if (item.isDirectory()) files.push(...await listFiles(path.join(directory, item.name), `${relative}/`));
    else files.push(relative);
  }
  return files.sort();
}

for (const [index, game] of games.entries()) {
  const upstream = path.join(root, 'game-sources/upstream/classics', game.folder);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim();
  if (game.commit && game.commit !== commit) throw new Error(`${game.id}: upstream differs from pinned commit`);
  game.commit = commit;
  const destination = path.join(root, 'public/games', game.id);
  await mkdir(destination, { recursive: true });
  const copy = (name, output = name, base = upstream) => cp(path.join(base, name), path.join(destination, output), { recursive: true });
  const file = name => path.join(destination, name);

  if (game.recipe === 'tower') {
    await copy('css', 'css', path.join(upstream, 'src'));
    await copy('js', 'js', path.join(upstream, 'src'));
    await copy('td.html', 'index.html', path.join(upstream, 'src'));
    await edit(file('index.html'), '_TD.init("td-board", true)', '_TD.init("td-board", false)');
  }
  if (game.recipe === '2048') {
    await copy('index.html'); await copy('js'); await copy('meta'); await copy('favicon.ico');
    await mkdir(file('style'), { recursive: true });
    await copy('style/main.css');
    let html = await read(file('index.html'));
    html = replace(html, 'Join the numbers and get to the <strong>2048 tile!</strong>', '合并相同数字，向 <strong>2048</strong> 挑战！');
    for (const [from, to] of [['New Game', '新游戏'], ['Keep going', '继续挑战'], ['Try again', '再来一局']]) html = replace(html, from, to);
    html = html.replace(/<p class="game-explanation">[\s\S]*?<\/p>/, '<p class="game-explanation"><strong>玩法：</strong>用方向键或手指滑动棋盘，相同数字碰到一起就会合并。尽量保持最大数字在角落。</p>');
    html = html.replace(/<p>\s*<strong class="important">Note:<\/strong>[\s\S]*?<\/p>/, '<p>本页为原作的中文版本，棋盘与最高分保存在当前浏览器。</p>');
    html = html.replace('Created by', '原作者').replace('Based on', '玩法源于').replace('and conceptually similar to', '也参考了');
    await put(file('index.html'), html);
    await edit(file('js/html_actuator.js'), '"You win!" : "Game over!"', '"达成 2048！" : "本局结束！"');
    await edit(file('js/local_storage_manager.js'), '"bestScore"', '"yuqing:classic-2048:bestScore"');
    await edit(file('js/local_storage_manager.js'), '"gameState"', '"yuqing:classic-2048:gameState"');
    let css = await read(file('style/main.css'));
    css = replace(css, '@import url(fonts/clear-sans.css);', '');
    css = replace(css, '"Score"', '"分数"'); css = replace(css, '"Best"', '"最高"');
    await put(file('style/main.css'), css);
  }
  if (game.recipe === 'tetris') {
    for (const name of ['index.html', 'stats.js', 'texture.jpg']) await copy(name);
    let html = await read(file('index.html'));
    html = replace(html, 'Press Space to Play.', '按空格开始游戏');
    html = replace(html, '<p>score ', '<p>分数 '); html = replace(html, '<p>rows ', '<p>消行 ');
    html = replace(html, 'href="javascript:play();"', 'href="#" onclick="play(); return false;"');
    html = html.replace('Sorry, this example cannot be run because your browser does not support the &lt;canvas&gt; element', '浏览器需要支持 Canvas 才能游玩。');
    await put(file('index.html'), html);
  }
  if (game.recipe === 'breakout') {
    for (const name of ['index.html', 'breakout.css', 'breakout.js', 'game.js', 'levels.js', 'images']) await copy(name);
    await copy('sound/breakout'); await copy('sound/license.txt');
    let html = await read(file('index.html'));
    for (const [from, to] of [['next level', '下一关'], ['previous level', '上一关'], ['>level:', '>关卡：'], ['>sound<', '>音效<'], ['<b>space</b> to start', '<b>空格</b> 开始或发球'], ['<b>left/right</b> to move paddle', '<b>左右方向键</b> 移动挡板'], ['<b>up/down</b> to change level', '<b>上下方向键</b> 切换关卡'], ['<b>touch here</b> to start', '<b>轻触这里</b> 开始'], ['<b>drag</b> paddle to move', '<b>拖动</b> 挡板接球']]) html = replace(html, from, to);
    html = replace(html, '<script src="breakout.js">', '<script src="modern-audio.js"></script>\n  <script src="breakout.js">');
    html = html.replace('Sorry, this example cannot be run because your browser does not support the &lt;canvas&gt; element', '浏览器需要支持 Canvas 才能游玩。');
    await put(file('index.html'), html);
    let js = await read(file('breakout.js'));
    for (const [from, to] of [["'ready...'", "'准备'"], ["'set..'", "'瞄准'"], ["'go!'", "'发球！'"], ['HIGH SCORE: ', '最高分：'], ["'/sound/", "'sound/"]]) js = replace(js, from, to);
    for (const key of ['sound','level','highscore']) js = js.replaceAll(`.storage.${key}`, `.storage["yuqing:classic-breakout:${key}"]`);
    await put(file('breakout.js'), js);
    await put(file('modern-audio.js'), `// MIT adaptation: use native HTML audio instead of obsolete Flash loading.\nGame.loadSounds = function (cfg) {\n  var sounds = {};\n  Object.keys(cfg.sounds).forEach(function (id) { var audio = new Audio(cfg.sounds[id]); audio.preload = 'auto'; audio.volume = 0.5; sounds[id] = audio; });\n  window.soundManager = { play: function (id) { var audio = sounds[id]; if (audio) { audio.currentTime = 0; audio.play().catch(function () {}); } } };\n};\n`);
    await put(file('hall.css'), '@media(max-width:640px){#breakout{width:calc(100% - 16px);height:auto;aspect-ratio:4/3}#canvas{width:100%;height:100%}#instructions{top:-65%;width:18em}}\n');
  }
  if (game.recipe === 'sokoban') {
    await copy('game.html', 'index.html'); await copy('images'); await copy('js');
    let html = await read(file('index.html'));
    html = replace(html, 'body{\n\t\t\toverflow:hidden;', 'body{\n\t\t\toverflow:auto;');
    html = replace(html, 'if(p1.x>curMap.length)', 'if(p1.x>=curMap.length)');
    html = replace(html, 'if(p1.y>curMap[0].length)', 'if(p1.y>=curMap[0].length)');
    html = replace(html, 'function doKeyDown(event){', 'function doKeyDown(event){\n      if ([37,38,39,40,65,68,83,87].includes(event.keyCode)) event.preventDefault();');
    await put(file('index.html'), html);
  }
  if (game.recipe === 'xiangqi') {
    const base = path.join(upstream, 'JavaScript');
    for (const name of ['index.htm','book.js','position.js','search.js','board.js','cchess.js']) {
      const decoded = new TextDecoder('gbk', {fatal:true}).decode(await readFile(path.join(base,name))).replace(/\r\n/g,'\n');
      await put(file(name === 'index.htm' ? 'index.html' : name), decoded);
    }
    await copy('images','images',base);
    let html = await read(file('index.html'));
    html = replace(html, 'charset=gbk', 'charset=utf-8');
    html = replace(html, 'background: url(../background.gif);', 'background: #f0e8d7; color:#302415; font-family:system-ui,sans-serif;');
    html = replace(html, 'src="cchess.js"></script>', 'src="cchess.js"></script>\n<script src="hall-audio.js"></script>');
    html = replace(html, 'class="checkbox" checked onclick="board.setSound(checked)"', 'class="checkbox" id="chkSound" checked onclick="board.setSound(checked)"');
    await put(file('index.html'), html);
    await edit(file('board.js'), 'style.left = SQ_X(sq);', 'style.left = SQ_X(sq) + "px";');
    await edit(file('board.js'), 'style.top = SQ_Y(sq);', 'style.top = SQ_Y(sq) + "px";');
    await cp(new URL('./overrides/xiangqi-audio.js',import.meta.url),file('hall-audio.js'));
    await put(file('hall.css'),'#container{touch-action:manipulation}#container img{-webkit-user-drag:none}input,select{font-family:system-ui,sans-serif}\n');
  }
  if (game.recipe === 'othello') {
    await copy('othello.html', 'index.html'); await copy('othello.js'); await copy('othello.css');
    await put(file('index.html'), (await read(file('index.html'))).replace(/<link[^>]*href="https:\/\/s1\.ax1x\.com[^>]*>/, '<link rel="icon" href="data:,">'));
    let css = await read(file('othello.css'));
    css = css.replace(/@font-face\s*\{[^}]+\}/g, '');
    css = css.replace(/background-image:\s*url\(https:\/\/s1\.ax1x\.com[^)]+\);/, 'background-image: linear-gradient(135deg,#204f3c,#36745a);');
    css += '\n/* Use local system fonts instead of remote commercial typefaces. */\nbody,button,input,select{font-family:"Microsoft YaHei",system-ui,sans-serif}\n';
    await put(file('othello.css'), css);
  }
  if (game.recipe === 'breaklock') {
    // Pinned build prerequisites are documented in README.md; output is Chinese.
    await copy('index.html', 'index.html', path.join(upstream, 'public/zh'));
    await copy('app.js', 'app.js', path.join(upstream, 'public/zh'));
    await copy('app.css', 'app.css', path.join(upstream, 'public/zh'));
    for (const entry of await readdir(path.join(upstream, 'public/assets'))) {
      if (entry !== 'fonts') await copy(`assets/${entry}`, `assets/${entry}`, path.join(upstream, 'public'));
    }
    let html = await read(file('index.html'));
    html = replace(html, '<base href="/breaklock/" />', '<base href="./" />');
    html = html.replace(/<script type="text\/javascript">\s*const isRoot[\s\S]*?<\/script>/, '');
    html = html.replace(/<link rel="manifest"[^>]*>/, '');
    html = html.replace(/\/\/ Set up service worker[\s\S]*?\/\/ Easter Egg/, '// Easter Egg');
    html = replace(html, 'zh/app.js', 'app.js'); html = replace(html, 'zh/app.css', 'app.css');
    html = replace(html, 'Loading...', '正在加载…');
    await put(file('index.html'), html);
    let css = await read(file('app.css'));
    css = css.replace(/@font-face\s*\{[^}]+\}/g, '');
    await put(file('app.css'), css);
    // The hall publishes one language; hide the selector instead of dead locale links.
    await put(file('hall.css'), '.lang-button,.lang-selector{display:none!important}\n');
  }
  if (game.recipe === 'minesweeper') {
    await copy('dist', '.', upstream);
    await mkdir(file('licenses'),{recursive:true});
    for (const name of ['react','react-dom','workbox-window','workbox-core']) await copy(`node_modules/${name}/LICENSE`,`licenses/${name}.txt`);
  }
  if (game.recipe === 'asteroids') {
    for (const name of ['index.html', 'game.js', 'jquery-1.4.1.min.js', 'ipad.js']) await copy(name);
    await cp(new URL('./vendor/JQUERY-1.4.1-MIT.txt',import.meta.url),file('JQUERY-LICENSE.txt'));
    let html = await read(file('index.html'));
    html = replace(html, '<script src="vector_battle_regular.typeface.js"></script>', '');
    for (const [from, to] of [['THRUST', '推进'], ['>LEFT<', '>左转<'], ['>RIGHT<', '>右转<'], ['>FIRE<', '>开火<']]) html = replace(html, from, to);
    await put(file('index.html'), html);
    let js = await read(file('game.js'));
    js = js.replace(/renderText: function\(text, size, x, y\) \{[\s\S]*?\n  \},\n\n  context:/, 'renderText: function(text, size, x, y) {\n    this.context.save();\n    this.context.font = size + "px system-ui, sans-serif";\n    this.context.fillText(text, x, y);\n    this.context.restore();\n  },\n\n  context:');
    js = replace(js, 'Text.face = vector_battle;', 'Text.face = null;');
    js = replace(js, "'Touch Screen to Start' : 'Press Space to Start'", "'轻触屏幕开始' : '按空格开始' ");
    js = replace(js, "'GAME OVER'", "'本局结束'"); js = replace(js, "'PAUSED'", "'已暂停'");
    js = js.replace(/SFX = \{[\s\S]*?SFX\.muted = true;/, `// Synthesized effects avoid distributing the upstream third-party recordings.\nvar effectsContext;\nfunction effect(frequency, duration) {\n  if (SFX.muted) return;\n  var AudioContext = window.AudioContext || window.webkitAudioContext;\n  if (!AudioContext) return;\n  effectsContext = effectsContext || new AudioContext();\n  effectsContext.resume().catch(function () {});\n  var osc = effectsContext.createOscillator(), gain = effectsContext.createGain();\n  osc.type = 'sawtooth'; osc.frequency.setValueAtTime(frequency, effectsContext.currentTime);\n  osc.frequency.exponentialRampToValueAtTime(40, effectsContext.currentTime + duration);\n  gain.gain.setValueAtTime(0.05, effectsContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, effectsContext.currentTime + duration);\n  osc.connect(gain); gain.connect(effectsContext.destination); osc.start(); osc.stop(effectsContext.currentTime + duration);\n}\nSFX = { muted: true, laser: function () { effect(600, 0.1); }, explosion: function () { effect(130, 0.2); } };`);
    await put(file('game.js'), js);
    await put(file('hall.css'), 'body{margin:0;background:#050914;color:#f5f5f5;font-family:system-ui,sans-serif}#game-container{margin:24px auto;width:min(800px,100%)}#canvas{max-width:100%;display:block;border:1px solid #26334b}\n');
  }

  await copy(game.licenseFile, 'LICENSE');
  let html = await read(file('index.html'));
  html = html.replace(/<html(?:\s+[^>]*)?>/, '<html lang="zh-CN">');
  if (!/charset=/i.test(html)) html = html.replace('<head>', '<head>\n<meta charset="utf-8">');
  if (!/name="viewport"/i.test(html)) html = html.replace('<head>', '<head>\n<meta name="viewport" content="width=device-width,initial-scale=1">');
  if (!/rel=["'](?:shortcut )?icon["']/i.test(html)) html = html.replace('</head>', '<link rel="icon" href="data:,"></head>');
  html = /<title>/.test(html) ? html.replace(/<title>[^<]*<\/title>/, `<title>${game.title} · 雨晴游戏厅</title>`) : html.replace('<head>', `<head><title>${game.title} · 雨晴游戏厅</title>`);
  const help = `<script src="../_shared/game-help.js" data-title="${game.title}" data-controls="${game.controls}" data-tip="${game.tip}"></script>`;
  html = html.replace('</body>', `${help}\n</body>`);
  if (['breaklock', 'asteroids', 'xiangqi', 'breakout'].includes(game.recipe)) html = html.replace('</head>', '<link rel="stylesheet" href="hall.css"></head>');
  await put(file('index.html'), html);
  const order = 36 + index;
  const manifest = {
    schemaVersion: 2, id: game.id, order,
    discovery: { audiences: game.audiences ?? ['single'] },
    theme: { accent: game.accent, dark: '#20292e' },
    presentation: {
      title: game.title, originalTitle: game.original, mark: game.mark, category: game.category,
      tagline: game.tagline, description: game.description, tags: [...game.tags, '中文'],
      play: { modes: game.modes ?? (game.audiences ? '同屏双人' : '单人挑战'), players: game.players ?? (game.audiences ? '2 人' : '1 人'), controls: game.controls, inputs: game.inputs, devices: game.devices, vision: false },
      highlights: game.highlights, art: { cover: `/games/${game.id}/cover.png`, hero: `/games/${game.id}/cover.png` },
      availability: { state: 'playable', label: '可直接游玩' }, actionLabel: '进入游戏',
    },
    platform: { hosting: 'static', technology: '独立 HTML / CSS / JavaScript 运行包', license: game.license, sourceUrl: `https://github.com/${game.repo}`, localization: '游戏内菜单、玩法说明和主要状态为中文，保留原作署名。', fit: '独立静态运行包，通过 game.json 和 iframe 接入。', highlights: game.highlights, cautions: game.cautions ?? [game.audiences ? '仅支持同一台设备上的双人对弈，无网络联机。' : '单人玩法；本地成绩不跨设备同步。'], launch: { kind: 'iframe', entry: `/games/${game.id}/index.html` } },
    capabilities: ['fullscreen', 'storage'], permissions: ['fullscreen'],
  };
  if (['breakout', 'xiangqi', 'asteroids'].includes(game.recipe)) { manifest.capabilities.push('audio'); manifest.permissions.push('autoplay'); }
  await put(file('game.json'), JSON.stringify(manifest, null, 2) + '\n');
  await put(file('SOURCE.md'), `# ${game.title}\n\n原作：[${game.original}](https://github.com/${game.repo})\n\n固定提交：${commit}\n\n许可：${game.license}，完整文本见 [LICENSE](./LICENSE)。\n\n雨晴游戏厅改动：中文默认界面、相对资源地址、独立入口与玩法说明；具体可重建脚本在源码包内的 adaptations/。\n\n[完整源码与修改记录](./source.zip)\n`);
  inventory[game.id] = (await listFiles(destination)).filter(name => !['cover.png', 'source.zip'].includes(name));
  console.log(`${game.id}: ${commit.slice(0, 7)}, ${inventory[game.id].length} runtime files`);
}
await put(sourceFile, JSON.stringify(games, null, 2) + '\n');
await put(new URL('./runtime-assets.json', import.meta.url), JSON.stringify(inventory, null, 2) + '\n');

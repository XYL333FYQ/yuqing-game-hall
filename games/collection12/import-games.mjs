// Import only pinned upstream snapshots. Committed runtimes are used by normal builds.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url)),sources=new URL('./SOURCES.json',import.meta.url);
const games=JSON.parse(await fs.readFile(sources,'utf8')),inventory={};
const read=async p=>(await fs.readFile(p,'utf8')).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const write=(p,s)=>fs.writeFile(p,s,'utf8');
const translate=(s,pairs)=>{for(const [a,b] of Object.entries(pairs))s=s.replaceAll(a,b);return s};
async function list(dir,prefix=''){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const n=prefix+e.name;if(e.isDirectory())out.push(...await list(path.join(dir,e.name),n+'/'));else out.push(n)}return out.sort()}
for(const [i,g] of games.entries()){
 const up=path.join(root,'game-sources/upstream/next12',g.folder),out=path.join(root,'public/games',g.id),f=n=>path.join(out,n);
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:up,encoding:'utf8'}).trim();if(g.commit&&g.commit!==commit)throw Error(g.id+' mismatched commit');g.commit=commit;
 await fs.mkdir(out,{recursive:true});const copy=(n,d=n,base=up)=>fs.cp(path.join(base,n),f(d),{recursive:true});
 if(['0hh1','0hn0'].includes(g.folder)){
  for(const n of ['css','img','js','index.html'])await copy(n);
  if(g.folder==='0hh1')await copy('config.js');
  let html=await read(f('index.html'));html=html.replace(/<link href="fonts\/fonts.css"[^>]*>/,'').replace(/<script>\s*var WebFontConfig[\s\S]*?<\/script>/,'').replace(/<script[^>]+src="(?:cordova.js|js\/webfont.js)"[^>]*><\/script>/g,'').replace("'js/webfont.js',",'');
  html=translate(html,{'How to play':'怎么玩','Select a size to play...':'选择棋盘大小','Loading':'正在加载','>About<':'>原作介绍<','>Rules<':'>规则<','>Apps<':'>原作与源码<','>Play<':'>开始游戏<','Blue dots can see others <br>in their own row and column.':'蓝点能看见同行同列的其他蓝点。','Their numbers tell how many.':'数字表示它能看见的蓝点数量。','Red dots block their view.':'红点阻挡视线。','a little logic game':'轻巧的逻辑谜题'});
  html=html.replace(/(<p data-action="play">)\s*Play\s*(<\/p>)/,'$1开始游戏$2').replace(/(>\s*)About(\s*<)/g,'$1原作介绍$2').replaceAll('Oh hi','双色逻辑').replaceAll('Oh no','视线谜阵').replace("It's 0h h1's companion!",'用红蓝点破解视线谜题');
  html=html.replace(/(<div id="about"[\s\S]*?<p>)[\s\S]*?(<\/p>)/,`$1${g.description}<br><br>原作者 Martin Kool / Q42<br>© ${g.folder==='0hh1'?'2014':'2015'} Q42$2`);
  html=html.replace(/(<div id="apps"[\s\S]*?<div class="side-padded">)[\s\S]*?(<\/div>)/,'$1<p>原作由 Martin Kool / Q42 创作。<br>这是雨晴游戏厅的中文静态版本。<br><a href="SOURCE.md" target="_blank">查看来源与源码</a></p>$2');
  html=html.replace('</body>','<script src="localization.js"></script><script>app.fontsLoaded();</script></body>');await write(f('index.html'),html);
  let js=await read(f('js/game.js'));js=js.replace(/ojoos = \[[^\]]*]/,"ojoos = ['漂亮！','推理正确！','成功！','解开了！','太棒了！']");js=translate(js,{"That\\'s the undo button.":'这是撤销按钮。','Nothing to undo.':'目前没有可撤销的步骤。','This tile was reversed to ':'此格已撤销为：',"'red.'":"'红色。'","'blue.'":"'蓝色。'",'its empty state.':'空白。'});
  js=js.replaceAll('Select a size','选择棋盘大小');if(g.folder==='0hh1')js=js.replaceAll("'tutorialPlayed'","'yuqing:binary-puzzle:tutorialPlayed'").replaceAll("'score'","'yuqing:binary-puzzle:score'");await write(f('js/game.js'),js);
  if(g.folder==='0hn0'){let storage=await read(f('js/storage.js'));storage=storage.replace('localStorage.getItem(name)','localStorage.getItem("yuqing:visible-dots:" + name)').replace('localStorage.setItem(name, value)','localStorage.setItem("yuqing:visible-dots:" + name, value)').replace('localStorage.clear();','Object.keys(localStorage).filter(k=>k.startsWith("yuqing:visible-dots:")).forEach(k=>localStorage.removeItem(k));');await write(f('js/storage.js'),storage)}
  await fs.copyFile(new URL(`./translations/${g.folder}.js`,import.meta.url),f('localization.js'));
  await fs.copyFile(new URL('./vendor/APACHE-2.0.txt',import.meta.url),f('APACHE-2.0.txt'));await fs.copyFile(new URL('./vendor/JQUERY-2-MIT.txt',import.meta.url),f('JQUERY-LICENSE.txt'));
  await write(f('hall.css'),'body,html,p,h1,h2,h3{font-family:system-ui,sans-serif!important}h1,h2{letter-spacing:0!important}#tweeturl,#facebook{display:none!important}\n');
 }
 if(g.folder==='mah'){
  await copy('dist','.');
  // Publish only the documented public-domain Unicode tile set, with CC-BY-SA jokers.
  for(const dir of ['assets/svg','assets/img','assets/backgrounds','assets/music','assets/fonts']){try{const abs=f(dir);for(const n of await fs.readdir(abs)){if(dir==='assets/svg'&&['uni.svg','uni-black.svg','README.md'].includes(n))continue;await fs.rm(path.join(abs,n),{recursive:true,force:true})}}catch(e){if(e.code!=='ENOENT')throw e}}
  await copy('src/assets/svg/README.md','TILE-ATTRIBUTION.md');
  await fs.copyFile(new URL('./vendor/CC-BY-SA-4.0.txt',import.meta.url),f('CC-BY-SA-4.0.txt'));
 }
 if(g.folder==='sudoku-react'){
  for(const n of ['index.html','bundle.js','bundle.css'])await copy(n);
  const translations={'Sudoku':'数独','Start a new game':'新游戏','resume the existing one':'继续上次棋盘','The code of this game is on':'原作代码：','Please, choose the difficulty:':'请选择难度：','Congratulations!':'数独完成！','Easy':'简单','Medium':'中等','Hard':'困难','Back':'返回'};
  let js=translate(await read(f('bundle.js')),translations);js=js.replaceAll('localStorage.currentGame','localStorage["yuqing:sudoku:currentGame"]');
  // Equivalent to the original webpack DefinePlugin production setting.
  const envPattern=/\b[$\w]+\.env\.NODE_ENV\b/g;if((js.match(envPattern)||[]).length<100)throw Error('Sudoku environment anchor missing');js=js.replace(envPattern,'"production"');await write(f('bundle.js'),js);
  await fs.mkdir(f('preferred-source'),{recursive:true});for(const n of ['js/game.jsx','js/store.js']){let s=translate(await read(path.join(up,n)),translations).replaceAll('localStorage.currentGame','localStorage["yuqing:sudoku:currentGame"]');await write(f('preferred-source/'+path.basename(n)),s)}
  await write(f('hall.css'),'.github-corner{display:none}\n');
  for(const n of ['REACT-0.14-LICENSE.txt','REACT-0.14-PATENTS.txt','REDUX-LICENSE.txt','LODASH-LICENSE.txt','REACT-ROUTER-LICENSE.txt'])await fs.copyFile(new URL('./vendor/'+n,import.meta.url),f(n));
 }
 if(['solitaire','nonograms','battleship'].includes(g.folder))await copy('hall-dist','.');
 if(g.folder==='nonograms'){
  await fs.mkdir(f('preferred-source'),{recursive:true});for(const n of ['Game.js','GameState.js','Field.js'])await copy('src/game/'+n,'preferred-source/'+n);
  for(const n of ['FONT-AWESOME-5.txt','BOOTSTRAP-ICONS-MIT.txt'])await fs.copyFile(new URL('./vendor/'+n,import.meta.url),f(n));
  await fs.mkdir(f('licenses'),{recursive:true});for(const name of ['react','react-dom','i18next','i18next-http-backend','react-i18next','react-router','react-router-dom','react-timer-hook','react-icons','@remix-run/router']){for(const n of ['LICENSE','LICENSE.md','LICENSE.txt']){try{await copy(`node_modules/${name}/${n}`,`licenses/${name.replaceAll('/','-')}.txt`);break}catch(e){if(e.code!=='ENOENT')throw e}}}
 }
 if(g.folder==='connect-four'){
  for(const n of ['index.html','css','js','img'])await copy(n);
  let html=(await read(f('index.html'))).replace(/<link href="https:[^>]*>/,'');html=translate(html,{'Connect Four':'四子连线','Current player is: ':'当前玩家：','Next up is: ':'接下来：','Player 1':'黑方','Player 2':'红方','Play Again':'再来一局','See the code':'查看源码'});await write(f('index.html'),html);
  await write(f('js/vars.js'),translate(await read(f('js/vars.js')),{'This position is already taken. Please make another choice.':'此列已满，请选择其他列。','This game is a draw.':'棋盘已满，平局。','The winner is: ':'获胜者：'}));
  await write(f('js/functions.js'),(await read(f('js/functions.js'))).replace('y > y_pos','y >= 0'));
 }
 if(g.folder==='chess'){
  for(const n of ['chess.include.js','chess.js','bitboard.js','zobrist.js','move.js','position.js','parser.js','ai.js','ui.js'])await copy('src/'+n,n);await copy('chess.css');
  await copy('src/chess.html','index.html');
  for(const n of ['jquery.min.js','jquery-ui.min.js','JQUERY-MIT.txt','JQUERY-UI-MIT.txt'])await fs.copyFile(new URL('./vendor/'+n,import.meta.url),f(n));
  let html=await read(f('index.html'));html=html.replace(/<link rel="stylesheet" href="https:[^>]*>/,'').replace(/<link rel="shortcut icon"[^>]*>/,'').replace(/<script[^>]+src="https:[^>]*><\/script>/g,'').replace(/<a href="https:\/\/github.com\/kbjorklu\/chess"><img[^>]*><\/a>/,'');
  html=html.replace('<script src="chess.include.js">','<script src="jquery.min.js"></script><script src="jquery-ui.min.js"></script><script src="chess.include.js">').replace('<h1>Chess</h1>','<h1>国际象棋 · 你执白，电脑执黑 <button onclick="location.reload()">重新开局</button></h1>');
  html=html.replace(/<ul>[\s\S]*?<\/ul>/,'<ul><li>拖动棋子走子；右侧列出所有合法走法，也可直接点击。</li><li>兵到达底线可升变；右侧可选择升变棋子。</li><li>将王向车的方向移动两格即可王车易位。悔棋会撤销双方上一步。</li></ul>');await write(f('index.html'),html);
  await write(f('ui.js'),translate(await read(f('ui.js')),{'\">undo</a>':'\">悔棋</a>','\">auto</a>':'\">电脑代走</a>','Algebraic: ':'位置：','\\nRank: ':'\\n行：','\\nFile: ':'\\n列：','\\nIndex: ':'\\n编号：','\\nColor: ':'\\n颜色：','\\nPiece: ':'\\n棋子：'}));
  await write(f('hall.css'),'#moves{max-height:600px;overflow:auto}#dim{pointer-events:none}body{margin-top:20px}h1{letter-spacing:0}\n');
 }
 if(g.folder==='snake-classic'){
  await copy('src','.');let html=await read(f('index.html'));
  html=translate(html,{'Light Theme':'浅色','Main Theme':'经典','Dark Theme':'深色','Green Theme':'绿色','Matrix Theme':'矩阵','Snake Head Theme':'蛇头','Black and purple Theme':'黑紫','Neon Theme':'霓虹','Clean Theme':'简洁','Original Theme':'原版','Golden Theme':'金色','Cotton Candy Theme':'棉花糖','OG Theme':'怀旧'});
  html=translate(html,{'Theme:':'外观：','Mode:':'速度：','>Easy<':'>简单<','>Medium<':'>中等<','>Hard<':'>困难<','>Impossible<':'>极限<','>Rush<':'>加速挑战<','Full Screen':'全屏','aria-label="Up"':'aria-label="上"','aria-label="Down"':'aria-label="下"','aria-label="Left"':'aria-label="左"','aria-label="Right"':'aria-label="右"','aria-label="Pause"':'aria-label="暂停"','Theme by':'外观 /','Theme By':'外观 /'});await write(f('index.html'),html);
  let js=await read(f('js/snake.js'));js=translate(js,{'localeCompare("Rush")':'localeCompare("加速挑战")','[Paused]':'已暂停','Press [space] to unpause.':'按空格继续。','Length:':'长度：','Highscore:':'最高纪录：','Play Game':'开始游戏','Play Again?':'再来一局','You died :(':'撞到了！本局结束','You win! :D':'你填满了棋盘！','JavaScript Snake':'贪吃蛇挑战','Use the <strong>on-screen game pad</strong> to play the game.':'使用屏幕上的<strong>方向按钮</strong>移动。','Use the <strong>arrow keys</strong> on your keyboard to play the game. ':'使用键盘<strong>方向键</strong>移动，空格暂停。','On Windows, press F11 to play in Full Screen mode.':'可按 F11 全屏游玩。','more patorjk.com apps':'原作者 patorjk','source code':'原作源码',"pat's youtube":'原作者频道','jsSnakeHighScore':'yuqing:snake-classic:highScore'});await write(f('js/snake.js'),js);
 }
 if(g.folder==='battleship')await fs.copyFile(new URL('./vendor/NORMALIZE-MIT.txt',import.meta.url),f('NORMALIZE-MIT.txt'));
 if(g.folder==='color-lines'){
  for(const n of ['index.html','lines.js','style.css'])await copy(n);await write(f('index.html'),translate(await read(f('index.html')),{'Score:':'分数：','Record:':'纪录：'}));await write(f('lines.js'),translate(await read(f('lines.js')),{'Game over! Your score is ':'本局结束，你的得分：','!\\nPlay again?':'！\\n再来一局吗？','lines-record':'yuqing:color-lines:record'}));
 }
 if(g.folder==='tower-game'){
  for(const n of ['index.html','assets'])await copy(n);await copy('dist/main.js','main.js');
  for(const n of await fs.readdir(f('assets'))){if(n.startsWith('wenxue.'))await fs.rm(f('assets/'+n))}
  let html=await read(f('index.html'));html=html.replace('./dist/main.js','./main.js').replace(/@font-face\{[^}]*\}/,'').replace(/<script async src="https:\/\/www.googletagmanager.com[^>]*><\/script><script>[\s\S]*?<\/script>/,'');html=translate(html,{'Loading...':'正在加载…','Try Again!':'再试一次！','Network error... Please try again.':'资源加载失败，请重试。'});
  html=html.replace(/<img id="start"[^>]*>/,'<button id="start" class="start">开始叠塔</button>').replace(/<img src="\.\/assets\/main-index-title.png"[^>]*>/,'<h1 class="title">摩天楼建造</h1>').replace(/<img src="\.\/assets\/main-modal-again-b.png"[^>]*>/,'<button class="over-button-b js-reload">再来一局</button>').replace(/<img src="\.\/assets\/main-modal-invite-b.png"[^>]*>/,'');await write(f('index.html'),html);
  await write(f('main.js'),translate(await read(f('main.js')),{'string:"floor"':'string:"层"','.play()':'.play()?.catch(()=>{})'}));await fs.copyFile(new URL('./vendor/ZEPTO-MIT.txt',import.meta.url),f('ZEPTO-MIT.txt'));
  await write(f('hall.css'),'.landing h1{margin:20vh auto 0;color:white;font:bold 38px system-ui}.start,.js-reload{border:0;border-radius:999px;background:#fff1d5;color:#b55b35;padding:16px 25px;font:bold 24px system-ui}.font-wenxue{font-family:system-ui}.over-button-b{font-size:20px}\n');
 }
 await copy(g.licenseFile,'LICENSE');let html=await read(f('index.html'));html=html.replace(/<html(?:\s[^>]*)?>/,'<html lang="zh-CN">').replace(/<title>[^<]*<\/title>/,`<title>${g.title} · 雨晴游戏厅</title>`);
 if(!/charset=/i.test(html))html=html.replace('<head>','<head><meta charset="utf-8">');if(!/name="viewport"/.test(html))html=html.replace('<head>','<head><meta name="viewport" content="width=device-width,initial-scale=1">');
 try{await fs.access(f('hall.css'));html=html.replace('</head>','<link rel="stylesheet" href="hall.css"></head>')}catch{}
 html=html.replace('</body>',`<script src="../_shared/game-help.js" data-title="${g.title}" data-controls="${g.controls}" data-tip="${g.tip}"></script></body>`);await write(f('index.html'),html);
 const inputs=g.id==='snake-classic'?['keyboard','touch']:g.id==='sudoku'?['keyboard','mouse','touch']:g.mobile?['mouse','touch']:['mouse'];
 const manifest={schemaVersion:2,id:g.id,order:46+i,discovery:{audiences:g.duo?['duo']:['single']},theme:{accent:g.accent,dark:'#20292e'},presentation:{title:g.title,originalTitle:g.original,mark:g.mark,category:g.category,tagline:g.description.split('。')[0]+'。',description:g.description,tags:[...g.tags,'中文'],play:{modes:g.duo?'同屏双人':'单人挑战',players:g.duo?'2 人':'1 人',controls:g.controls,inputs,devices:g.mobile?['desktop','mobile']:['desktop'],vision:false},highlights:[g.description.split('。')[0],g.tip],art:{cover:`/games/${g.id}/cover.png`,hero:`/games/${g.id}/cover.png`},availability:{state:'playable',label:'可直接游玩'},actionLabel:'进入游戏'},platform:{hosting:'static',technology:'独立 HTML / CSS / JavaScript 静态运行包',license:g.license,sourceUrl:`https://github.com/${g.repo}`,localization:'中文游戏菜单、操作说明和主要反馈；保留原作署名。',fit:'通过 game.json 与 iframe 接入，无需新增服务器进程。',highlights:[g.category],cautions:[g.duo?'双人在同一设备上轮流操作，无网络联机。':'单人玩法，本地成绩不跨设备同步。'],launch:{kind:'iframe',entry:`/games/${g.id}/index.html`}},capabilities:['fullscreen','storage'],permissions:['fullscreen']};if(['tower-game','mah'].includes(g.folder)){manifest.capabilities.push('audio');manifest.permissions.push('autoplay')}
 await write(f('game.json'),JSON.stringify(manifest,null,2)+'\n');await write(f('SOURCE.md'),`# ${g.title}\n\n原作：[${g.original}](https://github.com/${g.repo})\n\n固定提交：${commit}\n\n许可：${g.license}，完整条款见本目录 LICENSE 和其他许可文件。\n\n中文及本地化改动、构建脚本和首选源文件见 [源码包](source.zip)。\n`);
 inventory[g.id]=(await list(out)).filter(n=>!['cover.png','source.zip'].includes(n));console.log(g.id);
}
await write(sources,JSON.stringify(games,null,2)+'\n');await write(new URL('./runtime-assets.json',import.meta.url),JSON.stringify(inventory,null,2)+'\n');

// Optional maintenance build; never runs in the hall's normal build or deployment.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url)), base=path.join(root,'game-sources/upstream/next12');
const read=async p=>(await fs.readFile(p,'utf8')).replace(/\r\n/g,'\n');
const edit=async(p,a,b)=>{const s=await read(p);if(s.includes(b))return;if(!s.includes(a))throw Error(`Missing anchor ${p}: ${a}`);await fs.writeFile(p,s.replaceAll(a,b))};
const npm=(cwd,args)=>execFileSync(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/s','/c','npm.cmd '+args.join(' ')]:args,{cwd,stdio:'inherit'});

const mah=path.join(base,'mah');
let consts=await read(path.join(mah,'src/app/model/consts.ts'));
consts=consts.replace(/export const ImageSets:[\s\S]*?\n];/,"export const ImageSets: Array<{ id: string; type: 'SVG' | 'PNG'; name: string; license: LICENCE }> = [{ id: 'uni', type: 'SVG', name: 'Unicode', license: 'pub' }];");
consts=consts.replace(/export const Backgrounds:[\s\S]*?\n];/,"export const Backgrounds: Array<{ img: string; name: string; type?: 'jpg' | 'png' | 'svg' | 'MAH'; repeat?: boolean; license?: LICENCE }> = [{ img: '', name: 'BACK_NONE' }];");
consts=consts.replace("ImageSetDefault = 'riichi'","ImageSetDefault = 'uni'").replace("LangDefault = 'auto'","LangDefault = 'zh'");await fs.writeFile(path.join(mah,'src/app/model/consts.ts'),consts);
const angular=JSON.parse(await read(path.join(mah,'angular.json')));angular.projects.mah.architect.build.options.styles=['src/styles.scss'];await fs.writeFile(path.join(mah,'angular.json'),JSON.stringify(angular,null,2));
await fs.writeFile(path.join(mah,'custom-build-config.json'),JSON.stringify({name:'麻将叠叠消',title:'麻将叠叠消',description:'单人麻将配对',mobile:true,editor:false,kyodai:false,daily:false}));
if(!process.argv.includes('--skip-mah')){npm(mah,['ci','--ignore-scripts','--no-audit','--no-fund']);npm(mah,['run','build:prod'])}

const non=path.join(base,'nonograms');
await edit(path.join(non,'src/App.jsx'),'BrowserRouter','HashRouter');
await edit(path.join(non,'src/index.js'),"lng: language || 'en'","lng: 'zh'");
await edit(path.join(non,'src/index.js'),"'/locales/{{lng}}/{{ns}}.json'","'./locales/{{lng}}/{{ns}}.json'");
await fs.writeFile(path.join(non,'src/config/languages.json'),'["zh"]');
await edit(path.join(non,'src/components/Navbar/Navbar.jsx'),"const lang = i18next.language === 'pl' ? 'en' : 'pl';","const lang = 'zh';");
async function adaptNon(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await adaptNon(p);else if(/\.jsx?$/.test(p)){let s=await read(p);s=s.replace(/localStorage\.(getItem|setItem)\((['"])(settings|language)\2/g, 'localStorage.$1($2yuqing:nonograms:$3$2');await fs.writeFile(p,s)}}}
await adaptNon(path.join(non,'src'));
await edit(path.join(non,'src/components/Levels/Level.jsx'),'<h1>{levelName}</h1>',"<h1>{{Beginner:'入门',Medium:'进阶',Advanced:'挑战'}[levelName] || levelName}</h1>");
await edit(path.join(non,'src/components/Game/Game.jsx'),'{params.id}',"{{Beginner:'入门',Medium:'进阶',Advanced:'挑战'}[params.id] || params.id}");
// React applies settings after construction: bind once to avoid double toggles.
await edit(path.join(non,'src/game/Game.js'),'        if (isTouchDevice()) {','        if (this.inputBound) return;\n        this.inputBound = true;\n        if (isTouchDevice()) {');
await edit(path.join(non,'src/game/Game.js'),'        else {\n            // Mouse events','        {\n            // Mouse events, also on laptops with touchscreens');
for(const name of ['handleTouchStart','handleTouchEnd'])await edit(path.join(non,'src/game/Game.js'),`    ${name}(event) {`,`    ${name}(event) {\n        event.preventDefault();`);
await edit(path.join(non,'src/game/Game.js'),'this.canvas.offsetLeft','this.canvas.getBoundingClientRect().left');
await edit(path.join(non,'src/game/Game.js'),'this.canvas.offsetTop','this.canvas.getBoundingClientRect().top');
await fs.mkdir(path.join(non,'public/locales/zh'),{recursive:true});await fs.copyFile(new URL('./translations/nonograms-zh.json',import.meta.url),path.join(non,'public/locales/zh/main.json'));
const buildPackage={private:true,dependencies:{react:'18.2.0','react-dom':'18.2.0',i18next:'21.8.16','i18next-http-backend':'1.4.1','react-i18next':'11.18.3','react-icons':'4.4.0','react-router-dom':'6.3.0','react-timer-hook':'3.0.5','web-vitals':'2.1.4'}};
await fs.writeFile(path.join(non,'package.json'),JSON.stringify(buildPackage,null,2));
const lock=new URL('./build-inputs/nonograms/package-lock.json',import.meta.url);
try{await fs.copyFile(lock,path.join(non,'package-lock.json'));npm(non,['ci','--ignore-scripts','--no-audit','--no-fund'])}catch(e){if(e.code!=='ENOENT')throw e;npm(non,['install','--ignore-scripts','--no-audit','--no-fund']);await fs.mkdir(new URL('./build-inputs/nonograms/',import.meta.url),{recursive:true});await fs.copyFile(path.join(non,'package-lock.json'),lock)}
const esbuild=await import(pathToFileURL(path.join(mah,'node_modules/esbuild/lib/main.js')));
const sassModule=await import(pathToFileURL(path.join(mah,'node_modules/sass/sass.node.js')));const sass=sassModule.default??sassModule;
await fs.mkdir(path.join(non,'hall-dist'),{recursive:true});
await esbuild.build({entryPoints:[path.join(non,'src/index.js')],outfile:path.join(non,'hall-dist/main.js'),bundle:true,minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.js':'jsx','.jsx':'jsx','.png':'dataurl','.svg':'dataurl'},plugins:[{name:'scss',setup(b){b.onLoad({filter:/\.scss$/},a=>({contents:sass.compile(a.path).css,loader:'css'}))}}],legalComments:'external'});
let html=await read(path.join(non,'public/index.html'));html=html.replace(/%PUBLIC_URL%/g,'.').replace('</head>','<link rel="stylesheet" href="main.css"></head>').replace('</body>','<script defer src="main.js"></script></body>');await fs.writeFile(path.join(non,'hall-dist/index.html'),html);await fs.cp(path.join(non,'public/locales'),path.join(non,'hall-dist/locales'),{recursive:true});await fs.copyFile(path.join(non,'public/favicon.ico'),path.join(non,'hall-dist/favicon.ico'));

const sol=path.join(base,'solitaire');await fs.mkdir(path.join(sol,'hall-dist'),{recursive:true});
await esbuild.build({entryPoints:[path.join(sol,'src/index.js')],outfile:path.join(sol,'hall-dist/main.js'),bundle:true,minify:true,loader:{'.scss':'empty'},legalComments:'external'});
await fs.writeFile(path.join(sol,'hall-dist/main.css'),sass.compile(path.join(sol,'src/index.scss')).css);
html=(await read(path.join(sol,'src/index.html'))).replace('%CDN_URL%','').replace('New game','新游戏').replace(/Solitaire/g,'纸牌接龙').replace('</head>','<link rel="stylesheet" href="main.css"></head>');await fs.writeFile(path.join(sol,'hall-dist/index.html'),html);

const battle=path.join(base,'battleship');
for(const name of ['gameUI.js','index.html']){
 const p=path.join(battle,'src',name);let text=await read(p);
 for(const [a,b] of Object.entries({'Battleship':'舰队猎手','Your Turn':'轮到你开火','Your Board':'我方舰队','Enemy Board':'敌方海域','Place your ships by clicking on the board below':'点击下方棋盘放置舰船，可先旋转方向','Rotate':'旋转','Computer\'s Turn':'电脑正在开火','You win!':'你获胜了！','You lose!':'电脑获胜了！','Game Over! Do you want to play again?':'本局结束，重新挑战吗？','Play Again':'再来一局'}))text=text.replaceAll(a,b);
 text=text.replace('github.com/Shahir-47/舰队猎手','github.com/Shahir-47/Battleship').replace('Source Code','原作源码').replace('Computer Turn','电脑正在开火').replace('`${player} won!`',"player === 'user' ? '你获胜了！' : '电脑获胜了！'");await fs.writeFile(p,text);
}
await fs.mkdir(path.join(battle,'hall-dist'),{recursive:true});await esbuild.build({entryPoints:[path.join(battle,'src/index.js')],outfile:path.join(battle,'hall-dist/main.js'),bundle:true,minify:true,loader:{'.svg':'dataurl'},legalComments:'external'});
html=(await read(path.join(battle,'src/index.html'))).replace(/<link rel="icon"[^>]*>/,'<link rel="icon" href="data:,">').replace('</head>','<link rel="stylesheet" href="main.css"></head>').replace('</body>','<script defer src="main.js"></script></body>');await fs.writeFile(path.join(battle,'hall-dist/index.html'),html);

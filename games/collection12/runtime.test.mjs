import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const read=n=>fs.readFileSync(new URL('../../public/games/'+n,import.meta.url),'utf8');

test('nonogram mouse input works on a touch laptop after repeated settings updates',()=>{
 const handlers={};const context=new Proxy({measureText:()=>({actualBoundingBoxRight:12,actualBoundingBoxLeft:0,actualBoundingBoxAscent:12,actualBoundingBoxDescent:0})},{get:(o,k)=>o[k]??(()=>{})});
 const canvas={width:500,height:500,getContext:()=>context,addEventListener:(n,f)=>(handlers[n]??=[]).push(f),getBoundingClientRect:()=>({left:0,top:0})};
 const sandbox=vm.createContext({window:{},navigator:{maxTouchPoints:10},requestAnimationFrame:()=>{},setTimeout:()=>{}});
 for(const n of ['Field.js','GameState.js','Game.js'])vm.runInContext(read('nonograms/preferred-source/'+n).replace(/^import .*;?\r?\n/gm,'').replace(/export default \w+;/g,'').replace('export const','const'),sandbox);
 const pattern=[[1,1,0,1,1],[1,1,0,1,1],[0,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0]];
 sandbox.canvas=canvas;sandbox.pattern=pattern;const game=vm.runInContext('new Game(canvas,pattern,{cluesSize:100,fontSize:16})',sandbox);
 game.updateSettings({cluesSize:100,fontSize:16});game.updateSettings({cluesSize:100,fontSize:16});
 assert.equal(handlers.mousedown.length,1);assert.equal(handlers.mouseup.length,1);assert.equal(handlers.touchstart.length,1);
 for(let y=0;y<5;y++)for(let x=0;x<5;x++)if(pattern[y][x]){const e={button:0,offsetX:100+(x+.5)*80,offsetY:100+(y+.5)*80};handlers.mousedown[0](e);handlers.mouseup[0](e)}
 assert.equal(game.checkSolution(),true);
});

test('connect-four drops above an occupied cell when clicking the bottom of a column',()=>{
 const sandbox=vm.createContext({document:{}});vm.runInContext(read('connect-four/js/vars.js')+'\n'+read('connect-four/js/functions.js'),sandbox);
 const game=sandbox.Game;assert.equal(game.do.dropToBottom(0,game.config.boardHeight),game.config.boardHeight);
 game.do.addDiscToBoard(0,game.config.boardHeight);assert.equal(game.do.dropToBottom(0,game.config.boardHeight),game.config.boardHeight-1);
 for(let y=game.config.boardHeight-1;y>=game.config.boardHeight-3;y--)game.do.addDiscToBoard(0,y);
 assert.equal(game.check.isVerticalWin(),true);game.board[game.config.boardHeight-1][0]=0;assert.equal(game.check.isVerticalWin(),false);
});

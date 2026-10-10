import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function chessContext() {
  const context=vm.createContext({console,Date,Math});
  for(const name of ['book.js','position.js','search.js']) vm.runInContext(await readFile(new URL(`../../public/games/chinese-chess/${name}`,import.meta.url),'utf8'),context);
  return context;
}
test('象棋搜索返回合法走法且完整恢复棋盘，随后可走子并撤销',async()=>{
  const ctx=await chessContext();
  vm.runInContext('var pos = new Position(); pos.fromFen("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w"); var before=pos.toFen(); var search=new Search(pos,16); var move=search.searchMain(4,100);',ctx);
  assert.equal(ctx.pos.toFen(),ctx.before);
  assert.equal(ctx.pos.legalMove(ctx.move),true);
  assert.equal(ctx.pos.makeMove(ctx.move),true);
  ctx.pos.undoMakeMove(); assert.equal(ctx.pos.toFen(),ctx.before);
});
test('象棋阻挡、兵的前进规则与将死判定',async()=>{
  const ctx=await chessContext();
  vm.runInContext('var pos=new Position();pos.fromFen("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w");',ctx);
  assert.equal(ctx.pos.legalMove((0x83<<8)|0x93),true); // red pawn forward
  assert.equal(ctx.pos.legalMove((0xa3<<8)|0x93),false); // red pawn backward
  assert.equal(ctx.pos.legalMove((0xb4<<8)|0xc3),false); // rook across occupied horse
  ctx.pos.fromFen('4k4/3R1R3/4R4/9/9/9/9/9/9/4K4 w');
  assert.equal(ctx.pos.makeMove((0x47<<8)|0x57),true);
  assert.equal(ctx.pos.inCheck(),true); assert.equal(ctx.pos.isMate(),true);
});
test('百关推箱子实际包含 100 张完整地图，全部箱子都有对应目标',async()=>{
  const ctx=vm.createContext({});vm.runInContext(await readFile(new URL('../../public/games/sokoban-100/js/mapdata100.js',import.meta.url),'utf8'),ctx);
  assert.equal(ctx.levels.length,100);
  for(const [i,map] of ctx.levels.entries()){
    const cells=map.flat();assert.equal(map.length,16,`关卡${i+1}`);assert.equal(map.every(row=>row.length===16),true);
    assert.equal(cells.filter(v=>v===4).length,1,`关卡${i+1}人物`);
    assert.equal(cells.filter(v=>v===3).length,cells.filter(v=>v===2).length,`关卡${i+1}箱子/目标`);
  }
});

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

async function othelloContext() {
  let now = 1_000;
  let nextTimer = 0;
  const timers = new Map();
  const node = () => {
    let text = '';
    const classes = new Set();
    return {
      style: {}, classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) },
      children: [], appendChild(child) { this.children.push(child); },
      get textContent() { return text; }, set textContent(value) { text = value; },
      get innerText() { return text; }, set innerText(value) { text = value; },
    };
  };
  const ctx = vm.createContext({
    console, Date: { now: () => now }, document: { createElement: node },
    window: { addEventListener() {} },
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }, setInterval() {}, clearInterval() {},
  });
  vm.runInContext(await readFile(new URL('../../public/games/othello/othello.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(`
    boardEl = document.createElement('div');
    blackScoreEl = document.createElement('span'); whiteScoreEl = document.createElement('span');
    turnBarEl = document.createElement('div'); turnIconEl = document.createElement('div'); turnTextEl = document.createElement('span');
    settingsFormEl = document.createElement('form'); settingsFormEl.length = 0;
    settings = {timerEnabled: true, timerBlackLimit: 1, timerWhiteLimit: 1, timerPunish: 'lose'};
    startGame();
  `, ctx);
  return { ctx, advance: () => { now += 1_001; }, flushTransitions: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); } };
}

test('黑白棋超时判负后撤销可继续，重做必须恢复判负而不是重新开放落点', async () => {
  const { ctx, advance } = await othelloContext();
  advance();
  vm.runInContext('showTimer();', ctx);
  assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '白方获胜');
  vm.runInContext('undoHistory();', ctx);
  assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '黑方回合');
  assert.equal(vm.runInContext('OTHELLO_BOARD.canPlaceCount', ctx), 4);
  vm.runInContext('redoHistory();', ctx);
  assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '白方获胜');
  assert.equal(vm.runInContext('OTHELLO_BOARD.canPlaceCount', ctx), 0);
});

test('黑白棋普通落子、撤销和重做保留棋子数量及可落点', async () => {
  const { ctx } = await othelloContext();
  vm.runInContext('OTHELLO_BOARD[2][3].stoneEl.onclick();', ctx);
  assert.equal(vm.runInContext('calculateScore().blackScore', ctx), 4);
  assert.equal(vm.runInContext('calculateScore().whiteScore', ctx), 1);
  vm.runInContext('undoHistory();', ctx);
  assert.equal(vm.runInContext('calculateScore().blackScore', ctx), 2);
  vm.runInContext('redoHistory();', ctx);
  assert.equal(vm.runInContext('calculateScore().blackScore', ctx), 4);
  assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '白方回合');
});

test('黑白棋白方超时后的重做也能恢复黑方获胜', async () => {
  const { ctx, advance } = await othelloContext();
  vm.runInContext('OTHELLO_BOARD[2][3].stoneEl.onclick();', ctx);
  advance();
  vm.runInContext('showTimer();', ctx);
  assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '黑方获胜');
  vm.runInContext('undoHistory(); redoHistory();', ctx);
  assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '黑方获胜');
  assert.equal(vm.runInContext('OTHELLO_BOARD.canPlaceCount', ctx), 0);
});

test('黑白棋平局后重新开始清除平局图标状态', async () => {
  const { ctx } = await othelloContext();
  vm.runInContext(`
    OTHELLO_BOARD.forEach((row, x) => row.forEach((grid, y) => changeStoneType(grid, (x + y) % 2 ? 'BLACK' : 'WHITE')));
    checkGameState();
  `, ctx);
  assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '双方平局');
  vm.runInContext('startGame();', ctx);
  assert.equal(vm.runInContext('turnIconEl.classList.contains("double")', ctx), false);
  assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '黑方回合');
});

test('黑白棋快速关闭设置不会被旧打开动画重新遮住棋盘', async () => {
  const { ctx, flushTransitions } = await othelloContext();
  vm.runInContext('showSettings(); hideSettings();', ctx);
  flushTransitions();
  assert.equal(vm.runInContext('settingsFormEl.classList.contains("hide")', ctx), true);
  assert.equal(vm.runInContext('settingsFormEl.classList.contains("show")', ctx), false);
  vm.runInContext('showSettings();', ctx);
  flushTransitions();
  assert.equal(vm.runInContext('settingsFormEl.classList.contains("hide")', ctx), false);
  assert.equal(vm.runInContext('settingsFormEl.classList.contains("show")', ctx), true);
});

test('黑白棋完整对局的棋子守恒、结算、全程撤销重做和重开', async () => {
  for (const strategy of [0, 1, 7, 19]) {
    const { ctx } = await othelloContext();
    ctx.strategy = strategy;
    vm.runInContext(`
      var moves = 0;
      while (OTHELLO_BOARD.gameResult === undefined && moves < 64) {
        var legal = OTHELLO_BOARD.flat().filter(grid => grid.type === 'BLACK_CAN_PLACE' || grid.type === 'WHITE_CAN_PLACE');
        if (!legal.length) throw new Error('未结算但无可落点');
        var before = calculateScore();
        legal[(moves * strategy) % legal.length].stoneEl.onclick();
        var after = calculateScore();
        if (after.blackScore + after.whiteScore !== before.blackScore + before.whiteScore + 1) throw new Error('落子数量不守恒');
        moves++;
      }
      var finalBoard = JSON.stringify(OTHELLO_BOARD.map(row => row.map(grid => grid.type)));
      var finalResult = OTHELLO_BOARD.gameResult;
      if (finalResult === undefined) throw new Error('完整对局未结束');
      while (undoList.length) undoHistory();
    `, ctx);
    assert.equal(vm.runInContext('calculateScore().blackScore + calculateScore().whiteScore', ctx), 4);
    assert.equal(vm.runInContext('turnTextEl.textContent', ctx), '黑方回合');
    vm.runInContext('while (redoList.length) redoHistory();', ctx);
    assert.equal(vm.runInContext('JSON.stringify(OTHELLO_BOARD.map(row => row.map(grid => grid.type))) === finalBoard', ctx), true);
    assert.equal(vm.runInContext('OTHELLO_BOARD.gameResult === finalResult', ctx), true);
    assert.equal(vm.runInContext('OTHELLO_BOARD.canPlaceCount', ctx), 0);
    vm.runInContext('startGame();', ctx);
    assert.equal(vm.runInContext('OTHELLO_BOARD.canPlaceCount', ctx), 4);
    assert.equal(vm.runInContext('undoList.length + redoList.length', ctx), 0);
  }
});

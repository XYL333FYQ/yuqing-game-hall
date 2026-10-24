import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function minesweeperContext({ stored = null, seconds = 2, failSave = false, customOpen = false, helpOpen = false } = {}) {
  const source = await readFile(new URL('./overrides/minesweeper/App.jsx', import.meta.url), 'utf8');
  const fragment = (start, end) => {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert(from >= 0 && to > from, `扫雷源码锚点缺失: ${start}`);
    return source.slice(from, to);
  };
  const observations = { stored, status: 'playing', board: null, notice: '', newGames: 0, help: false };
  const ctx = vm.createContext({ difficulty: 'custom', seconds, customOpen, helpOpen,
    localStorage: { getItem: () => observations.stored, setItem: (key, value) => { if (failSave) throw new Error('QuotaExceededError'); observations.stored = value; } },
    setBoard: board => { observations.board = board; },
    setStatus: next => { observations.status = typeof next === 'function' ? next(observations.status) : next; },
    setInstallMessageKey: key => { observations.notice = key; },
    newGame: () => { observations.newGames++; }, setHelpOpen: value => { observations.help = value; },
  });
  vm.runInContext(fragment('function loadBest(', 'export default function App()') + fragment('function finish(', '  function handleOpen(') + fragment('function onKey(', "    window.addEventListener('keydown'"), ctx);
  const key = (key, { button = false, editable = false, contentEditable = false, code = '' } = {}) => {
    const event = { key, code, target: { matches: selector => selector.includes('input') && editable || selector.includes('button') && button, closest: selector => selector === 'button' && button, isContentEditable: contentEditable }, prevented: false, preventDefault() { this.prevented = true; } };
    ctx.onKey(event);
    return event;
  };
  return { ctx, observations, key };
}

test('扫雷零秒最佳纪录应读为 0，而不是缺少纪录', async () => {
  const { ctx } = await minesweeperContext({ stored: '0' });
  assert.equal(ctx.loadBest('custom'), 0);
});

test('扫雷较慢的胜局不能覆盖零秒最佳纪录', async () => {
  const { ctx, observations } = await minesweeperContext({ stored: '0', seconds: 2 });
  ctx.finish([[{ isMine: true }]], 'won');
  assert.equal(observations.stored, '0');
  assert.equal(observations.status, 'won');
});

test('扫雷最佳纪录忽略缺失、空白和非法数值，保留有效正数', async () => {
  for (const stored of [null, '', ' ', 'broken', '-1', 'Infinity']) {
    const { ctx } = await minesweeperContext({ stored });
    assert.equal(ctx.loadBest('custom'), null, `非法纪录 ${stored}`);
  }
  const { ctx } = await minesweeperContext({ stored: '12' });
  assert.equal(ctx.loadBest('custom'), 12);
});

test('扫雷格子或暂停按钮获得焦点后，P 仍可暂停恢复、R 仍可重开', async () => {
  const { observations, key } = await minesweeperContext();
  key('p', { button: true }); assert.equal(observations.status, 'paused');
  key('p', { button: true }); assert.equal(observations.status, 'playing');
  key('r', { button: true }); assert.equal(observations.newGames, 1);
});

test('扫雷按钮上的空格保留原生激活行为，不触发全局暂停', async () => {
  const { observations, key } = await minesweeperContext();
  const event = key(' ', { button: true, code: 'Space' });
  assert.equal(observations.status, 'playing');
  assert.equal(event.prevented, false);
});

test('扫雷输入框和可编辑区域的按键不能操作背景棋盘', async () => {
  for (const options of [{ editable: true }, { contentEditable: true }]) {
    const { observations, key } = await minesweeperContext();
    key('r', options); key('p', options); key('?', options);
    assert.equal(observations.newGames, 0); assert.equal(observations.status, 'playing'); assert.equal(observations.help, false);
  }
});

test('扫雷自定义或说明弹窗打开时，不执行背景棋盘快捷键', async () => {
  for (const flags of [{ customOpen: true }, { helpOpen: true }]) {
    const { observations, key } = await minesweeperContext(flags);
    key('r'); key('p');
    assert.equal(observations.newGames, 0); assert.equal(observations.status, 'playing');
  }
});

test('扫雷保存纪录遇到存储配额异常时仍正常结算并显示保存失败提示', async () => {
  const { ctx, observations } = await minesweeperContext({ failSave: true });
  const board = [[{ isMine: true, isFlagged: false }]];
  assert.doesNotThrow(() => ctx.finish(board, 'won'));
  assert.equal(observations.status, 'won'); assert.equal(observations.board, board);
  assert.equal(board[0][0].isFlagged, true); assert.equal(observations.notice, 'bestSaveFailed');
});

test('扫雷页面空白区域的空格仍可暂停恢复，问号仍可打开说明', async () => {
  const { observations, key } = await minesweeperContext();
  assert.equal(key(' ', { code: 'Space' }).prevented, true); assert.equal(observations.status, 'paused');
  key(' ', { code: 'Space' }); assert.equal(observations.status, 'playing');
  key('?'); assert.equal(observations.help, true);
});

function element() {
  const node = { style: {}, dataset: {}, children: [], className: '', innerHTML: '', appendChild(child) { this.children.push(child); }, addEventListener() {}, cloneNode() { const copy = element(); copy.className = this.className; return copy; } };
  node.classList = {
    add(...names) { node.className = [...new Set(node.className.split(/\s+/).filter(Boolean).concat(names))].join(' '); },
    remove(...names) { node.className = node.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
    item(index) { return node.className.split(/\s+/)[index]; },
    contains(name) { return node.className.split(/\s+/).includes(name); },
  };
  node.querySelectorAll = selector => node.children.filter(child => child.classList.contains(selector.slice(1)));
  return node;
}

async function snakeContext() {
  const container = element();
  const speed = { value: '80', addEventListener() {}, options: [{ text: '普通' }], selectedIndex: 0 };
  const storage = { setItem(key, value) { this[key] = String(value); } };
  const ctx = vm.createContext({ console, document: { createElement: element, getElementById: () => speed }, window: { addEventListener() {}, removeEventListener() {} }, localStorage: storage, setTimeout() {}, alert() {} });
  ctx.SNAKE = ctx.window.SNAKE = {};
  vm.runInContext(await readFile(new URL('../../public/games/snake-classic/js/snake.js', import.meta.url), 'utf8'), ctx);
  const board = { getBlockWidth: () => 20, getBlockHeight: () => 20, getBoardContainer: () => container, foodEaten: () => true, handleDeath() {}, handleWin() {} };
  return { snake: new ctx.SNAKE.Snake({ playingBoard: board, startRow: 2, startCol: 2 }), container };
}

test('贪吃蛇吃食后死亡重开应复用蛇身，重复对局不持续创建隐藏元素', async () => {
  const { snake, container } = await snakeContext();
  const counts = [];
  for (let round = 0; round < 8; round++) {
    snake.eatFood();
    assert.equal(snake.snakeLength, 6);
    snake.handleDeath();
    snake.reset();
    snake.rebirth();
    assert.equal(snake.snakeLength, 1);
    counts.push(container.children.length);
  }
  assert.equal(counts.at(-1), counts[0], `重复对局元素数不应从 ${counts[0]} 增长到 ${counts.at(-1)}`);
});

async function linesContext() {
  const elements = Object.fromEntries(['grid', 'forecast', 'score', 'record'].map(name => [name, element()]));
  const timers = [];
  const storage = new Map();
  const ctx = vm.createContext({ console, Math, setTimeout: fn => timers.push(fn), confirm: () => false,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, String(value)) },
    document: { createElement: element, querySelector: selector => elements[selector.slice(1)], getElementById: id => elements.grid.children.find(cell => cell.id === id) },
  });
  const source = await readFile(new URL('../../public/games/color-lines/lines.js', import.meta.url), 'utf8');
  assert(source.includes('init: init'));
  vm.runInContext(source.replace('init: init', 'init: init, test: { removeLines: removeLines, setGrid: function(next) { grid = next; } }'), ctx);
  ctx.Lines.init();
  const flush = () => { while (timers.length) timers.shift()(); };
  flush();
  const grid = Array.from({ length: 9 }, () => Array(9).fill(1));
  elements.grid.children.forEach(cell => { cell.className = 'ball blue'; });
  ctx.Lines.test.setGrid(grid);
  return { lines: ctx.Lines.test, grid, elements, flush };
}

const horizontal = y => Array.from({ length: 5 }, (_, x) => [x, y]);
test('五彩连珠一次出现两条独立连线时，两条都要计分', async () => {
  const { lines, elements, flush } = await linesContext();
  lines.removeLines([[horizontal(0)], [horizontal(8)]]);
  flush();
  assert.equal(Number(elements.score.innerHTML), 20);
  assert.equal(elements.grid.querySelectorAll('.empty').length, 10);
});

test('五彩连珠同一条线被多个新球发现时只计一次', async () => {
  const { lines, elements, flush } = await linesContext();
  lines.removeLines([[horizontal(0)], [horizontal(0)], [horizontal(0)]]);
  flush();
  assert.equal(Number(elements.score.innerHTML), 10);
  assert.equal(elements.grid.querySelectorAll('.empty').length, 5);
});

test('五彩连珠交叉线共用的球只消除并计分一次', async () => {
  const { lines, elements, flush } = await linesContext();
  const vertical = Array.from({ length: 5 }, (_, y) => [2, y]);
  lines.removeLines([[horizontal(2), vertical]]);
  flush();
  assert.equal(Number(elements.score.innerHTML), 18);
  assert.equal(elements.grid.querySelectorAll('.empty').length, 9);
});

async function tetrisContext(random = () => 0.999999) {
  const html = await readFile(new URL('../../public/games/classic-tetris/index.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const canvas = { getContext: () => ({}) };
  const math = Object.create(Math);
  math.random = random;
  const ctx = vm.createContext({ Math: math, window: { requestAnimationFrame() {} }, Stats: function () {}, document: { getElementById: () => canvas } });
  // Skip only the render-loop entry point; execute the actual shipped rules.
  vm.runInContext(script.replace(/\n\s+run\(\);\s*$/, ''), ctx);
  return ctx;
}

test('俄罗斯方块抽袋可选到最后一项，不应固定留下一块 Z 到袋尾', async () => {
  const ctx = await tetrisContext();
  for (let draw = 0; draw < 4; draw++) assert.equal(ctx.randomPiece().type, ctx.z, `第 ${draw + 1} 次上界抽样必须仍能取到 Z`);
  const count = new Map();
  for (let draw = 4; draw < 28; draw++) {
    const type = ctx.randomPiece().type;
    count.set(type, (count.get(type) || 0) + 1);
  }
  for (const type of [ctx.i, ctx.j, ctx.l, ctx.o, ctx.s, ctx.t]) assert.equal(count.get(type), 4);
});

test('俄罗斯方块完整消除顶行，底行和连续多行也正常计分', async () => {
  for (const rows of [[0], [19], [0, 18, 19]]) {
    const ctx = await tetrisContext();
    ctx.reset();
    for (const y of rows) for (let x = 0; x < 10; x++) ctx.setBlock(x, y, ctx.o);
    ctx.removeLines();
    assert.equal(ctx.rows, rows.length, `应消除行 ${rows}`);
    assert.equal(ctx.score, 100 * 2 ** (rows.length - 1));
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) assert.equal(ctx.getBlock(x, y) || null, null);
  }
});

async function context2048() {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
  const ctx = vm.createContext({ window: { localStorage: storage }, console });
  for (const name of ['tile', 'grid', 'local_storage_manager', 'game_manager']) {
    vm.runInContext(await readFile(new URL(`../../public/games/classic-2048/js/${name}.js`, import.meta.url), 'utf8'), ctx);
  }
  class Input { handlers = {}; on(name, callback) { this.handlers[name] = callback; } }
  class Actuator { actuate() {} continueGame() {} }
  const create = () => new ctx.GameManager(4, Input, Actuator, ctx.LocalStorageManager);
  return { ctx, create };
}

test('2048 获胜后选择继续应立即保存，刷新后不应再次阻止移动', async () => {
  const { ctx, create } = await context2048();
  const game = create();
  game.grid = new ctx.Grid(4);
  game.grid.insertTile(new ctx.Tile({ x: 0, y: 0 }, 1024));
  game.grid.insertTile(new ctx.Tile({ x: 1, y: 0 }, 1024));
  game.move(3);
  assert.equal(game.won, true);
  assert.equal(game.isGameTerminated(), true);
  game.inputManager.handlers.keepPlaying();
  assert.equal(game.isGameTerminated(), false);
  assert.equal(game.storageManager.getGameState().keepPlaying, true);
  const resumed = create();
  assert.equal(resumed.isGameTerminated(), false);
  assert.equal(resumed.score, 2048);
  resumed.restart();
  assert.equal(resumed.won, false);
  assert.equal(resumed.score, 0);
  assert.equal(resumed.grid.availableCells().length, 14);
});

async function touchInput2048() {
  const handlers = {}, moves = [];
  const container = { addEventListener(name, callback) { handlers[name] = callback; } };
  const ctx = vm.createContext({ window: { navigator: {} }, document: { addEventListener() {}, querySelector: () => ({ addEventListener() {} }), getElementsByClassName: () => [container] } });
  vm.runInContext(await readFile(new URL('../../public/games/classic-2048/js/keyboard_input_manager.js', import.meta.url), 'utf8'), ctx);
  const input = new ctx.KeyboardInputManager();
  input.on('move', direction => moves.push(direction));
  const event = (touches, changedTouches = []) => ({ touches, targetTouches: touches, changedTouches, preventDefault() {} });
  return { handlers, moves, event };
}

test('2048 双指手势结束不能当成单指滑动，随后单指滑动仍然有效', async () => {
  const { handlers, moves, event } = await touchInput2048();
  const first = { clientX: 100, clientY: 100 }, second = { clientX: 200, clientY: 100 };
  handlers.touchstart(event([first]));
  handlers.touchstart(event([first, second]));
  handlers.touchend(event([second], [first]));
  handlers.touchend(event([], [second]));
  assert.deepEqual(moves, [], '两指接触过的手势应整段忽略');
  handlers.touchstart(event([first]));
  handlers.touchend(event([], [second]));
  assert.deepEqual(moves, [1]);
});

test('接龙翻回弃牌后按原顺序重新抽取，不能倒转下一轮牌序', async () => {
  const source = await readFile(new URL('../../public/games/klondike/main.js', import.meta.url), 'utf8');
  const anchor = 'window.onload=de;';
  assert(source.includes(anchor));
  const elements = new Map();
  const ctx = vm.createContext({ window: {}, document: { getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); } }, requestAnimationFrame: callback => callback(), clearTimeout() {} });
  vm.runInContext(source.replace(anchor, 'window.qaCards={state:n,click:ce,recycle:se};' + anchor), ctx);
  const { state, click, recycle } = ctx.window.qaCards;
  state.desk = Array.from({ length: 7 }, () => ({ cards: [], el: element() }));
  state.finish = Array.from({ length: 4 }, () => ({ cards: [], el: element() }));
  state.cards = Array.from({ length: 8 }, (_, number) => ({ el: element(), facingUp: false, number: number + 1, type: 'c' }));
  state.deal.pile.cards = Array.from({ length: 8 }, (_, index) => index);
  const drawPass = () => {
    const pass = [];
    while (state.deal.pile.cards.length) {
      const before = state.deal.deal.cards.length;
      click(state.deal.pile.cards.at(-1))({ stopPropagation() {} });
      pass.push(Array.from(state.deal.deal.cards.slice(before)));
    }
    return pass;
  };
  const first = drawPass();
  recycle();
  assert.equal(state.deal.pile.cards.length, 8);
  assert(state.cards.every(card => !card.facingUp));
  assert.deepEqual(drawPass(), first);
  click(0)({ stopPropagation() {} }); // Play the exposed club ace to a foundation.
  assert.equal(state.finish[0].cards.length, 1);
  recycle();
  assert.deepEqual(drawPass().flat(), first.flat().filter(card => card !== 0));
});

test('接龙重开取消松手延迟和已排队的落牌帧，旧移动不能改写新牌局', async () => {
  const source = await readFile(new URL('../../public/games/klondike/main.js', import.meta.url), 'utf8');
  assert(source.includes('window.onload=de;'));
  for (const frameAlreadyQueued of [false, true]) {
    const elements = new Map(), timers = new Map(), frames = [];
    let nextTimer = 0;
    const ctx = vm.createContext({ window: {}, document: { getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); } },
      requestAnimationFrame: callback => frames.push(callback), setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout: id => timers.delete(id),
    });
    vm.runInContext(source.replace('window.onload=de;', 'window.qaReset={state:n,reset:J,release:W};window.onload=de;'), ctx);
    const { state, reset, release } = ctx.window.qaReset;
    state.desk = Array.from({ length: 7 }, () => ({ cards: [], el: element() }));
    state.finish = Array.from({ length: 4 }, () => ({ cards: [], el: element() }));
    state.cards = Array.from({ length: 52 }, (_, index) => ({ el: element(), facingUp: false, number: index % 13 + 1, type: ['c','d','h','s'][Math.floor(index / 13)] }));
    const flushFrames = () => { while (frames.length) frames.shift()(); };
    const flushTimers = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); };
    reset(); flushFrames();
    state.moving.capture = true;
    state.moving.element = state.cards[0].el;
    state.moving.element.classList.add('card--moving');
    state.moving.origin = { location: 'desk', pile: 0, index: 0 };
    const target = state.cards[state.desk[1].cards.at(-1)].el;
    target.classList.add('finish-dest');
    state.moving.destinations = [{ el: target, target: { dest: 'desk', pile: 1, card: 0 }, offset: { left: 0, top: 0, width: 100, height: 100 } }];
    release({ pageX: 50, pageY: 50 });
    if (frameAlreadyQueued) flushTimers();
    reset();
    flushTimers(); flushFrames();
    assert.deepEqual(Array.from(state.desk, pile => pile.cards.length), [1,2,3,4,5,6,7]);
    assert.equal(state.deal.pile.cards.length, 24);
    assert.equal(state.moving.capture, false);
    assert.equal(state.moving.element, null);
    assert(state.cards.every(card => !card.el.classList.contains('card--moving') && !card.el.classList.contains('finish-dest')));
  }
});

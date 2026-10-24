const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function historyDatabase({ failInsert = false, holdInsert = false } = {}) {
  const records = new Map([[1, { id: 1, room_code: 'old-room', players_json: '[]', moves_json: '[]', result_json: '{}' }]]);
  let failList = false;
  let failDetail = false;
  let nextId = 9001;
  let releaseInsert;
  const insertGate = new Promise(resolve => { releaseInsert = resolve; });
  if (!holdInsert) releaseInsert();
  const pool = {
    async query(sql, values) {
      if (sql.includes('INSERT INTO `pre_game_history`')) {
        if (failInsert) throw new Error('Temporary insert failure');
        await insertGate;
        const id = nextId++;
        records.set(id, { id, room_code: values[0], desk_id: values[1], game_type: values[2], game_label: values[3], is_private: values[4], started_at: values[5], ended_at: values[6], players_json: values[7], moves_json: values[8], result_json: values[9] });
        return [{ insertId: id }];
      }
      if (sql.includes('FROM `pre_game_history`')) {
        if (sql.includes('WHERE id = ?')) {
          if (failDetail) throw new Error('Temporary detail read failure');
          return [[records.get(values[0])].filter(Boolean)];
        }
        if (failList) throw new Error('Temporary list read failure');
        return [[...records.values()]];
      }
      return [[]];
    },
    async end() {},
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../db'), 'utf8'), {
    module, process: { env: { DB_USER: 'fixture', DB_NAME: 'fixture' } },
    require: name => { if (name === 'node:crypto') return require(name); assert.equal(name, 'mysql2/promise'); return { createPool: () => pool }; },
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
  });
  return { db: module.exports, failListRead() { failList = true; }, restoreListRead() { failList = false; }, failDetailRead() { failDetail = true; }, releaseInsert };
}

test('数据库列表临时失败后，内存回退仍使用真实记录 ID，恢复读取不能打开旧对局', async () => {
  const { db, failListRead, failDetailRead } = historyDatabase();
  await db.init();
  try {
    const id = await db.saveHistory({ roomCode: 'new-room', gameType: 'doudizhu', players: [], moves: [{ type: 'play' }], result: { winner: [0] } });
    assert.equal(id, 9001);
    failListRead();
    const fallback = await db.listHistory();
    assert.equal(fallback.items.length, 1);
    const opened = await db.getHistory(String(fallback.items[0].id));
    assert.equal(opened.roomCode, 'new-room', '列表请求失败后点击记录，应打开刚才的牌局，不能打开数据库旧 ID 的牌局');
    assert.equal(fallback.items[0].id, id);
    failDetailRead();
    const cached = await db.getHistory(id);
    assert.equal(cached.roomCode, 'new-room');
    assert.equal(cached.moves.length, 1);
  } finally { await db.close(); }
});

test('数据库写入失败后，回退记录的身份不能与已有数据库记录混淆', async () => {
  const { db, failListRead } = historyDatabase({ failInsert: true });
  await db.init();
  try {
    await db.saveHistory({ roomCode: 'unsaved-round', players: [], moves: [] });
    failListRead();
    const fallback = await db.listHistory();
    const opened = await db.getHistory(fallback.items[0].id);
    assert.equal(opened.roomCode, 'unsaved-round');
  } finally { await db.close(); }
});

test('只有写入失败、列表查询正常时，尚在内存的牌局仍应出现在历史中', async () => {
  const { db } = historyDatabase({ failInsert: true });
  await db.init();
  try {
    const id = await db.saveHistory({ roomCode: 'unsaved-round', endedAt: 100, players: [], moves: [] });
    const listing = await db.listHistory();
    assert(listing.items.some(item => item.id === id && item.roomCode === 'unsaved-round'));
    assert(listing.items.some(item => item.id === 1 && item.roomCode === 'old-room'));
  } finally { await db.close(); }
});

test('写入过程中已显示的历史记录，写入成功后仍能用原入口打开且不重复列出', async () => {
  const { db, failListRead, restoreListRead, releaseInsert } = historyDatabase({ holdInsert: true });
  await db.init();
  try {
    const saving = db.saveHistory({ roomCode: 'pending-round', endedAt: 100, players: [], moves: [] });
    failListRead();
    const pending = (await db.listHistory()).items.find(item => item.roomCode === 'pending-round');
    assert(pending);
    releaseInsert();
    const storedId = await saving;
    const opened = await db.getHistory(pending.id);
    assert.equal(opened.roomCode, 'pending-round');
    assert.equal(opened.id, storedId);
    restoreListRead();
    const listing = await db.listHistory();
    assert.equal(listing.items.filter(item => item.roomCode === 'pending-round').length, 1);
  } finally { releaseInsert(); await db.close(); }
});

test('并行写入中的不同牌局各有独立入口，成功后缓存旧入口仍按各自牌局解析', async () => {
  const { db, failListRead, releaseInsert } = historyDatabase({ holdInsert: true });
  await db.init();
  try {
    const first = db.saveHistory({ roomCode: 'first-round', endedAt: 100, players: [], moves: [] });
    const second = db.saveHistory({ roomCode: 'second-round', endedAt: 101, players: [], moves: [] });
    const liveListing = await db.listHistory();
    assert(liveListing.items.some(item => item.roomCode === 'first-round'));
    assert(liveListing.items.some(item => item.roomCode === 'second-round'));
    failListRead();
    const pending = (await db.listHistory()).items;
    assert.notEqual(pending[0].id, pending[1].id);
    releaseInsert();
    await Promise.all([first, second]);
    for (const item of pending) assert.equal((await db.getHistory(item.id))?.roomCode, item.roomCode);
  } finally { releaseInsert(); await db.close(); }
});

test('旧进程的临时历史入口不能在新进程中被复用成另一局记录', async () => {
  const previous = historyDatabase({ failInsert: true }).db;
  const current = historyDatabase({ failInsert: true }).db;
  await previous.init(); await current.init();
  try {
    const oldId = await previous.saveHistory({ roomCode: 'previous-process-round', players: [], moves: [] });
    await current.saveHistory({ roomCode: 'current-process-round', players: [], moves: [] });
    assert.equal(await current.getHistory(oldId), null);
  } finally { await previous.close(); await current.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../public/games/_shared/game-chinese.js', import.meta.url), 'utf8');

function runtime(game = 'khan') {
  class Media {
    get src() { return this.value; }
    set src(value) { this.value = value; }
  }
  class Audio extends Media { constructor(src) { super(); if (src !== undefined) this.src = src; } }
  class Canvas {
    clearRect() {}
    fillRect() {}
    fillText() {}
    strokeText() {}
  }
  const created = [], revoked = [], listeners = {};
  const context = vm.createContext({
    HTMLMediaElement: Media, CanvasRenderingContext2D: Canvas,
    Audio, Blob, Uint8Array, atob,
    URL: { createObjectURL(blob) { created.push(blob); return `blob:local/${created.length}`; }, revokeObjectURL(url) { revoked.push(url); } },
    document: { body: null, readyState: 'complete', documentElement: {} },
    location: { pathname: `/games/${game}/index.html` },
    MutationObserver: class { observe() {} },
    requestAnimationFrame() {},
    addEventListener(type, callback) { listeners[type] = callback; },
    alert() {}, confirm() {},
  });
  context.window = context;
  vm.runInContext(source, context);
  return { context, translate: context.YuqingChinese.translate, created, revoked, listeners };
}

test('dynamic game rules remain readable with live numbers and split bitmap lines', () => {
  const { translate } = runtime();
  assert.equal(translate('LIFE: 5/5'), '生命：5/5');
  assert.equal(translate('STAMINA: 3'), '体力：3');
  assert.equal(translate('Stage 1 / 10'), '关卡 1 / 10');
  assert.equal(translate('Shoot enemies'), '使用蜂蜜枪');
  assert.equal(translate('with the honey gun'), '射击敌人');
  assert.equal(translate('Clear away toadstools to prevent'), '清除蘑菇可以阻止');
  assert.equal(translate('https://example.com/Play'), 'https://example.com/Play');
  assert.equal(translate('Player Alice 123'), 'Player Alice 123');
});

test('ambiguous words use the current game rather than another game dictionary', () => {
  assert.equal(runtime('bounce-back').translate('BACK'), '勇者');
  assert.equal(runtime('backcountry').translate('BACK'), '荒野');
  assert.equal(runtime('norman-necromancer').translate('Recharge'), '强化施法');
  assert.equal(runtime('khan').translate('Recharge'), '恢复体力');
});

test('synthesized WAV audio becomes local blob media for the existing CSP', async () => {
  const { context, created, revoked, listeners } = runtime();
  const wav = 'data:audio/wav;base64,UklGRg==';
  const a = new context.Audio(wav), b = new context.Audio(wav);
  assert.equal(a.src, 'blob:local/1');
  assert.equal(b.src, a.src);
  assert.equal(created.length, 1);
  assert.equal(created[0].type, 'audio/wav');
  assert.deepEqual([...new Uint8Array(await created[0].arrayBuffer())], [82, 73, 70, 70]);
  a.src = '/games/sound.ogg';
  assert.equal(a.src, '/games/sound.ogg');
  const media = new context.HTMLMediaElement();
  media.src = wav;
  assert.equal(media.src, b.src);
  listeners.pagehide();
  assert.deepEqual(revoked, ['blob:local/1']);
});

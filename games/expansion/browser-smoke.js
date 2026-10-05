// Playwright CLI: run-code --filename=games/expansion/browser-smoke.js
// Run against `wrangler pages dev dist --port 5292` after building the hall.
// This is a desktop gameplay smoke check, not a full playthrough.
async page => {
  const base = 'http://127.0.0.1:5292';
  const ids = ['a-dark-room', 'gridland', 'tiny-yurts', 'casual-crusade', 'infernal-throne', 'underrun', 'xx142-b2', 'packabunchas', 'bounce-back', 'super-castle', 'norman-necromancer', 'the-neatness', 'backcountry', 'radius-raid', 'elematter', 'bee-kind', 'rat-plague', 'hextris', 'thirteenth-floor', 'khan'];
  const results = [];
  for (const id of ids) {
    const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 800 } });
    const p = await context.newPage();
    await p.bringToFront();
    const errors = [], failed = [], remote = [], consoleErrors = [];
    p.on('pageerror', error => errors.push(error.message));
    p.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    p.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
    p.on('request', request => { if (!request.url().startsWith(base) && !/^(data:|blob:)/.test(request.url())) remote.push(request.url()); });
    const row = { id, errors, consoleErrors, failed, remote, observed: {} };
    try {
      const response = await p.goto(`${base}/games/${id}/index.html`);
      row.csp = !!response.headers()['content-security-policy'];
      await p.waitForTimeout(1700);
      row.chineseHelp = await p.getByText('玩法说明', { exact: true }).count() > 0;
      if (id === 'a-dark-room') {
        await p.waitForTimeout(2300);
        const mute = p.getByText('保持静音', { exact: true });
        if (await mute.isVisible()) await mute.click();
        await p.locator('#lightButton').click();
        await p.waitForTimeout(600);
        row.observed.fireLit = (await p.locator('body').innerText()).includes('火堆燃烧');
      }
      if (id === 'gridland') {
        await p.getByText('新游戏', { exact: true }).first().click();
        await p.waitForTimeout(4200);
        const tiles = p.locator('.tile');
        row.observed.tiles = await tiles.count();
        const a = await tiles.nth(0).boundingBox(), b = await tiles.nth(1).boundingBox();
        await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await p.mouse.down();
        await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
        await p.mouse.up();
      }
      if (id === 'tiny-yurts') {
        await p.getByText('开始游戏', { exact: true }).click();
        await p.waitForTimeout(300);
        await p.mouse.move(620, 400); await p.mouse.down();
        await p.mouse.move(680, 430, { steps: 20 }); await p.mouse.up();
        await p.keyboard.press('Space');
      }
      if (id === 'casual-crusade') {
        await p.mouse.click(640, 440); await p.waitForTimeout(750);
        await p.mouse.move(650, 655); await p.mouse.down();
        await p.mouse.move(705, 390, { steps: 20 }); await p.mouse.up();
        await p.mouse.click(705, 390);
      }
      if (id === 'infernal-throne') {
        await p.keyboard.press('Enter');
        await p.waitForFunction(() => !document.querySelector('h1'), { timeout: 45000 });
        await p.waitForTimeout(3300);
        await p.keyboard.down('ArrowRight'); await p.waitForTimeout(650); await p.keyboard.up('ArrowRight');
        await p.keyboard.press('z'); await p.keyboard.press('x');
      }
      if (id === 'underrun') {
        await p.mouse.click(640, 420); await p.waitForTimeout(1500);
        const before = await p.evaluate(() => entity_player.y);
        await p.keyboard.down('w'); await p.mouse.down(); await p.waitForTimeout(600);
        await p.keyboard.up('w'); await p.mouse.up();
        row.observed = await p.evaluate(before => ({ level: current_level, entities: entities.length, moved: entity_player.y !== before }), before);
      }
      if (id === 'xx142-b2') {
        await p.keyboard.press('Enter'); await p.waitForTimeout(800);
        await p.keyboard.down('ArrowUp'); await p.waitForTimeout(600); await p.keyboard.up('ArrowUp');
        row.observed.canvasVisible = await p.locator('#c').isVisible();
      }
      if (id === 'packabunchas') {
        await p.mouse.click(640, 600);
        await p.waitForFunction(() => state === 'story-intro', { timeout: 25000 });
        for (let i = 0; i < 15; i++) {
          await p.mouse.click(640, 730); await p.waitForTimeout(450);
          if (await p.evaluate(() => state === 'menu')) break;
        }
        await p.waitForTimeout(1800);
        const button = await p.evaluate(() => {
          const r = c.getBoundingClientRect();
          return { x: r.x + (startButton.x + startButton.w / 2) * r.width / c.width, y: r.y + (startButton.y + startButton.h / 2) * r.height / c.height };
        });
        await p.mouse.click(button.x, button.y); await p.waitForTimeout(1800);
        const piece = await p.evaluate(() => {
          const r = c.getBoundingClientRect(), s = pieces[0];
          return { x: r.x + (s.position.x + 30) * r.width / c.width, y: r.y + (s.position.y + 30) * r.height / c.height };
        });
        await p.mouse.move(piece.x, piece.y); await p.mouse.down();
        await p.mouse.move(645, 470, { steps: 20 }); await p.mouse.up();
        row.observed = await p.evaluate(() => ({ state, pieces: pieces.length }));
      }
      if (id === 'bounce-back') {
        await p.keyboard.down('w'); await p.waitForTimeout(600); await p.keyboard.up('w');
        await p.mouse.click(800, 350); await p.waitForTimeout(4000);
      }
      if (id === 'super-castle') {
        await p.mouse.click(280, 610); await p.waitForTimeout(600);
        await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowUp');
      }
      if (id === 'norman-necromancer') {
        await p.mouse.click(640, 400); await p.waitForTimeout(900);
        await p.keyboard.down('d'); await p.mouse.click(800, 300);
        await p.waitForTimeout(600); await p.keyboard.up('d'); await p.keyboard.press('Space');
      }
      if (id === 'the-neatness') {
        await p.mouse.move(406, 400); await p.mouse.down();
        await p.mouse.move(875, 400, { steps: 100 }); await p.mouse.up(); await p.waitForTimeout(2500);
      }
      if (id === 'backcountry') {
        const start = p.getByText('开始游戏', { exact: true });
        if (await start.count()) await start.click(); else await p.mouse.click(640, 440);
        await p.waitForTimeout(1300); await p.mouse.move(650, 400);
        await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up();
        row.observed = await p.evaluate(() => ({ models: game.Models.length, entities: game.World.length }));
      }
      if (id === 'radius-raid') {
        const point = await p.evaluate(() => {
          const r = document.querySelector('#cmg').getBoundingClientRect(), b = $.buttons[0];
          return { x: r.x + b.x, y: r.y + b.y };
        });
        await p.mouse.move(point.x, point.y); await p.mouse.down(); await p.waitForTimeout(200); await p.mouse.up();
        await p.mouse.move(800, 400); await p.mouse.down(); await p.waitForTimeout(4500); await p.mouse.up();
        row.observed = await p.evaluate(() => ({ state: $.state, bullets: $.bullets.length, enemies: $.enemies.length }));
      }
      if (id === 'elematter') {
        await p.locator('.b-play').click();
        await p.locator('.tile:not(.path)').nth(85).click();
        await p.locator('.build-button[data-type=e]').hover(); await p.locator('.build-button[data-type=e]').click();
        await p.waitForTimeout(1600); row.observed.towers = await p.locator('.t-wrap').count();
      }
      if (id === 'bee-kind') {
        await p.keyboard.press('Enter'); await p.waitForTimeout(4200);
        await p.keyboard.down('ArrowRight'); await p.waitForTimeout(550); await p.keyboard.up('ArrowRight');
        await p.keyboard.press('ArrowUp');
      }
      if (id === 'rat-plague') {
        await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
        await p.mouse.move(620, 450); await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up();
      }
      if (id === 'hextris') {
        await p.locator('#startBtn').click(); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowRight');
        await p.waitForTimeout(1700); row.observed.state = await p.evaluate(() => gameState);
      }
      if (id === 'thirteenth-floor') {
        await p.mouse.click(640, 420); await p.waitForTimeout(1800);
        await p.keyboard.press('e'); await p.keyboard.down('w'); await p.waitForTimeout(500);
        await p.keyboard.up('w'); await p.keyboard.press('f'); await p.keyboard.press('Escape');
        row.observed.hud = await p.locator('body').innerText();
      }
      if (id === 'khan') {
        await p.locator('#new').click(); await p.locator('#context-close').click(); await p.waitForTimeout(1200);
        const before = await p.locator('#enemy').innerText();
        await p.locator('#card-holder .card').filter({ hasText: '弯刀攻击' }).first().click();
        await p.locator('#enemy .sprite-wrapper').first().click(); await p.waitForTimeout(500);
        row.observed.enemyHealthChanged = before !== await p.locator('#enemy').innerText();
        await p.locator('#endturn').click(); await p.waitForTimeout(1800);
      }
      await p.waitForTimeout(650);
      await p.screenshot({ path: `output/playwright/csp-${id}.png` });
    } catch (error) { row.error = error.message; }
    results.push(row);
    await context.close();
  }
  return results;
}

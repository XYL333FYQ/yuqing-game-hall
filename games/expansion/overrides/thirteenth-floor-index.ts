import { controls } from '@/core/controls';
import { initTextures } from '@/textures';
import { GameState } from '@/game-states/game.state';

let previousTime = 0;
const interval = 1000 / 60;
tmpl.innerHTML = `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">Click to Start</div>`;
document.onclick = async () => {
    document.onclick = null;
    Promise.resolve(tmpl.requestPointerLock()).catch(() => {});
    tmpl.innerHTML = '';

    await initTextures();

    const gameState = new GameState();
    gameState.onEnter();

    draw(0);

    document.onclick = () => Promise.resolve(tmpl.requestPointerLock()).catch(() => {});

  function draw(currentTime: number) {
    const delta = currentTime - previousTime;

    if (delta >= interval) {
      previousTime = currentTime - (delta % interval);

      controls.queryController();
      gameState.onUpdate();
    }
    requestAnimationFrame(draw);
  }
};


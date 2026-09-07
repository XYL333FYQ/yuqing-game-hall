/** 果切自己的宣传视觉；平台壳层不再持有游戏专属资源。 */
export function fruitArtwork(): string {
  return `
    <div class="fruit-art" aria-hidden="true">
      <span class="fruit fruit-watermelon"><img src="/games/fruit-party/assets/fruits/watermelon.svg" alt=""></span>
      <span class="fruit fruit-orange"><img src="/games/fruit-party/assets/fruits/orange.svg" alt=""></span>
      <span class="fruit fruit-kiwi"><img src="/games/fruit-party/assets/fruits/kiwi.svg" alt=""></span>
      <span class="fruit fruit-strawberry"><img src="/games/fruit-party/assets/fruits/strawberry.svg" alt=""></span>
      <span class="fruit fruit-bomb"><img src="/games/fruit-party/assets/fruits/bomb.svg" alt=""></span>
      <span class="blade-swoosh"></span>
      <span class="juice-dot d1"></span><span class="juice-dot d2"></span><span class="juice-dot d3"></span>
    </div>`;
}


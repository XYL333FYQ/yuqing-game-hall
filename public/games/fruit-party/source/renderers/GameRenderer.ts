/** Visual renderer adapted from forinda/canvas-games (MIT). */
import { getStroke } from "perfect-freehand";
import {
  MIN_SLICE_SPEED,
  type BladeState,
  type Fruit,
  type FruitNinjaState,
  type FruitType,
  type SlicePoint,
  type WallSplatter,
} from "../types";
import { fruitRadiusForInstance, fruitRadiusForViewport, fruitTypeByName } from "../data/fruits";

const FRUIT_SPRITES: Partial<Record<FruitType["name"], string>> = {
  watermelon: "./assets/fruits/watermelon.svg",
  orange: "./assets/fruits/orange.svg",
  apple: "./assets/fruits/apple.svg",
  lemon: "./assets/fruits/lemon.svg",
  kiwi: "./assets/fruits/kiwi.svg",
  strawberry: "./assets/fruits/strawberry.svg",
  bomb: "./assets/fruits/bomb.svg",
};

const HALF_CACHE_SCALE = 3;

interface HalfSpriteCache {
  canvas: HTMLCanvasElement;
  size: number;
}

export class GameRenderer {
  private readonly sprites = new Map<FruitType["name"], HTMLImageElement>();
  private readonly halfSprites = new Map<string, HalfSpriteCache>();
  private readonly halfShadowSprites = new Map<string, HalfSpriteCache>();
  private readonly splatterPaths = new WeakMap<WallSplatter, Path2D>();
  private readonly strokeInput: Array<[number, number, number]> = [];
  private preparedHalfShadowScale = "";
  private backgroundCanvas?: HTMLCanvasElement;
  private backgroundWidth = 0;
  private backgroundHeight = 0;

  constructor() {
    for (const [name, source] of Object.entries(FRUIT_SPRITES)) {
      if (!source) continue;
      const image = new Image();
      image.decoding = "async";
      const fruitName = name as FruitType["name"];
      this.sprites.set(fruitName, image);
      if (fruitName !== "bomb") {
        image.addEventListener("load", () => this.prepareHalfSprites(fruitName), { once: true });
      }
      image.src = source;
      if (fruitName !== "bomb" && image.complete && image.naturalWidth > 0) {
        queueMicrotask(() => this.prepareHalfSprites(fruitName));
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    this.prepareHalfShadowsForViewport(state.width, state.height);
    this.drawBackground(ctx, state.width, state.height);
    // Wall stains are deliberately outside the shake transform: they belong to
    // the room, not to the moving foreground camera.
    this.drawWallSplatters(ctx, state);
    ctx.save();
    if (state.shake > 0) {
      const amount = state.shake * 6;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }
    this.drawParticles(ctx, state);
    this.drawHalves(ctx, state);
    this.drawFruits(ctx, state);
    this.drawSlashBursts(ctx, state);
    this.drawFloatingLabels(ctx, state);
    this.drawTrails(ctx, state);
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (
      !this.backgroundCanvas
      || this.backgroundWidth !== width
      || this.backgroundHeight !== height
    ) {
      const background = this.backgroundCanvas ?? document.createElement("canvas");
      background.width = Math.max(1, Math.round(width));
      background.height = Math.max(1, Math.round(height));
      const backgroundContext = background.getContext("2d", { alpha: false });
      if (backgroundContext) this.paintBackground(backgroundContext, width, height);
      this.backgroundCanvas = background;
      this.backgroundWidth = width;
      this.backgroundHeight = height;
    }
    ctx.drawImage(this.backgroundCanvas, 0, 0, width, height);
  }

  private paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = "#15120e";
    ctx.fillRect(0, 0, width, height);
    const plankHeight = Math.max(72, Math.min(98, height / 7.5));
    for (let row = 0, y = 0; y < height; row += 1, y += plankHeight) {
      ctx.fillStyle = row % 2 === 0 ? "#2a1d15" : "#241912";
      ctx.fillRect(0, y, width, plankHeight);
      ctx.strokeStyle = "rgba(6,5,4,.78)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y + plankHeight - 1);
      ctx.lineTo(width, y + plankHeight - 1);
      ctx.stroke();

      ctx.strokeStyle = "rgba(224,168,96,.065)";
      ctx.lineWidth = 1;
      for (let grain = 0; grain < 3; grain += 1) {
        const baseY = y + plankHeight * (0.22 + grain * 0.25);
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= width; x += 44) {
          ctx.lineTo(x, baseY + Math.sin(x * 0.014 + row * 1.7 + grain) * (2.5 + grain));
        }
        ctx.stroke();
      }

      const knotX = ((row * 263 + 137) % Math.max(240, width - 120)) + 60;
      const knotY = y + plankHeight * (row % 2 === 0 ? 0.62 : 0.38);
      ctx.strokeStyle = "rgba(9,6,4,.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(knotX, knotY, 19, 7, -.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(knotX, knotY, 8, 3, -.12, 0, Math.PI * 2);
      ctx.stroke();
    }

    const warmLight = ctx.createRadialGradient(
      width * 0.52,
      height * 0.36,
      10,
      width * 0.52,
      height * 0.46,
      Math.max(width, height) * 0.66,
    );
    warmLight.addColorStop(0, "rgba(135,98,54,.23)");
    warmLight.addColorStop(0.52, "rgba(68,43,25,.1)");
    warmLight.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = warmLight;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = "rgba(9,6,4,.34)";
    ctx.lineCap = "round";
    for (const [xRatio, yRatio, angle] of [
      [0.18, 0.2, -0.55],
      [0.76, 0.3, 0.48],
      [0.64, 0.72, -0.7],
    ] as const) {
      const length = Math.max(25, Math.min(width, height) * 0.055);
      const x = width * xRatio;
      const y = height * yRatio;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle + .18) * length * .7, y - Math.sin(angle + .18) * length * .7);
      ctx.lineTo(x + Math.cos(angle + .18) * length * .7, y + Math.sin(angle + .18) * length * .7);
      ctx.stroke();
    }
    ctx.restore();

    const counter = ctx.createLinearGradient(0, height * .84, 0, height);
    counter.addColorStop(0, "rgba(6,6,4,0)");
    counter.addColorStop(.34, "rgba(8,7,5,.42)");
    counter.addColorStop(1, "rgba(3,3,2,.82)");
    ctx.fillStyle = counter;
    ctx.fillRect(0, height * .82, width, height * .18);
  }

  private drawWallSplatters(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    ctx.save();
    for (const splatter of state.wallSplatters) {
      const growth = Math.min(1, splatter.age / splatter.expandDuration);
      const easedGrowth = 1 - (1 - growth) ** 3;
      const fadeStart = splatter.life * 0.58;
      const fade = splatter.age <= fadeStart
        ? 1
        : Math.max(0, 1 - (splatter.age - fadeStart) / (splatter.life - fadeStart));
      const ageRatio = Math.min(1, splatter.age / splatter.life);
      const centerX = splatter.x * state.width;
      const centerY = splatter.y * state.height;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(splatter.angle);
      ctx.scale(splatter.size * easedGrowth, splatter.size * easedGrowth);
      ctx.globalAlpha = splatter.alpha * fade * (0.82 - ageRatio * 0.36);
      ctx.fillStyle = splatter.color;
      const path = this.getSplatterPath(splatter);
      ctx.fill(path);
      ctx.globalAlpha = splatter.alpha * fade * (0.18 + ageRatio * 0.36);
      ctx.fillStyle = splatter.darkColor;
      ctx.fill(path);

      ctx.fillStyle = ageRatio > 0.45 ? splatter.darkColor : splatter.color;
      for (const satellite of splatter.satellites) {
        ctx.globalAlpha = splatter.alpha * fade * satellite.alpha;
        ctx.beginPath();
        ctx.ellipse(
          satellite.x,
          satellite.y,
          satellite.radiusX,
          satellite.radiusY,
          satellite.rotation,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();

      // Drips stay vertical in screen space even when the cut travelled at an angle.
      const cos = Math.cos(splatter.angle);
      const sin = Math.sin(splatter.angle);
      for (const drip of splatter.drips) {
        if (splatter.age < drip.delay) continue;
        const dripGrowth = Math.min(1, (splatter.age - drip.delay) / 1.25);
        const localX = drip.offsetX * splatter.size;
        const localY = drip.offsetY * splatter.size;
        const startX = centerX + localX * cos - localY * sin;
        const startY = centerY + localX * sin + localY * cos;
        const length = drip.length * splatter.size * dripGrowth;
        ctx.globalAlpha = splatter.alpha * fade * 0.72;
        ctx.strokeStyle = splatter.darkColor;
        ctx.lineWidth = Math.max(1.2, drip.width * splatter.size * (1 - dripGrowth * 0.3));
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(
          startX + drip.bend * splatter.size,
          startY + length * 0.32,
          startX - drip.bend * splatter.size * 0.35,
          startY + length * 0.72,
          startX + drip.bend * splatter.size * 0.25,
          startY + length,
        );
        ctx.stroke();
        ctx.fillStyle = splatter.darkColor;
        ctx.beginPath();
        ctx.arc(
          startX + drip.bend * splatter.size * 0.25,
          startY + length,
          drip.beadRadius * splatter.size * Math.min(1, dripGrowth * 1.4),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private getSplatterPath(splatter: WallSplatter): Path2D {
    const cached = this.splatterPaths.get(splatter);
    if (cached) return cached;
    const path = new Path2D();
    const outline = splatter.outline;
    if (outline.length === 0) {
      this.splatterPaths.set(splatter, path);
      return path;
    }
    const first = outline[0];
    const last = outline[outline.length - 1];
    path.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    for (let index = 0; index < outline.length; index += 1) {
      const current = outline[index];
      const next = outline[(index + 1) % outline.length];
      path.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    path.closePath();
    this.splatterPaths.set(splatter, path);
    return path;
  }

  private drawParticles(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    ctx.save();
    for (const particle of state.particles) {
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.ellipse(
        particle.x,
        particle.y,
        particle.radius * (particle.stretch ?? 1.6),
        particle.radius,
        Math.atan2(particle.vy, particle.vx),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFloatingLabels(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    for (const label of state.floatingLabels) {
      const ageRatio = 1 - label.life / label.maxLife;
      const fade = Math.min(1, label.life / 0.22);
      const entrance = Math.min(1, ageRatio / 0.16);
      const scale = (0.72 + entrance * 0.28) * label.emphasis;
      ctx.save();
      ctx.translate(label.x, label.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = fade;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 20px 'YQ Display', 'Microsoft YaHei UI', sans-serif";
      ctx.lineJoin = "round";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(8,12,19,.78)";
      ctx.strokeText(label.text, 0, 0);
      ctx.fillStyle = label.color;
      ctx.shadowColor = label.color;
      ctx.shadowBlur = 7;
      ctx.fillText(label.text, 0, 0);
      ctx.restore();
    }
  }

  private drawFruits(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    for (const fruit of state.fruits) {
      if (fruit.sliced) continue;
      const radius = fruitRadiusForInstance(fruit, state.width, state.height);
      const scale = radius / fruit.type.radius;
      ctx.save();
      ctx.translate(fruit.x, fruit.y);
      ctx.rotate(fruit.rotation);
      ctx.scale(scale, scale);
      this.drawFruit(ctx, fruit.type, fruit.isBomb, state.elapsedMs, fruit.id);
      this.drawFruitOverlay(ctx, fruit, state.elapsedMs);
      ctx.restore();
    }
  }

  private drawFruitOverlay(ctx: CanvasRenderingContext2D, fruit: Fruit, elapsedMs: number): void {
    const radius = fruit.type.radius;
    if (fruit.perfectTarget) {
      const pulse = 1 + Math.sin(elapsedMs * 0.01 + fruit.id) * 0.08;
      ctx.save();
      ctx.rotate(-fruit.rotation);
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = "rgba(255,244,174,.88)";
      ctx.lineWidth = 2.1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.28 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,247,190,.72)";
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (fruit.variant !== "boss") return;
    const hits = fruit.bossHits ?? 0;
    const maximum = fruit.bossMaxHits ?? 8;
    ctx.save();
    ctx.rotate(-fruit.rotation);
    for (let index = 0; index < hits; index += 1) {
      const angle = (fruit.id * 0.73 + index * 2.399) % (Math.PI * 2);
      const start = radius * (0.12 + (index % 3) * 0.06);
      const middle = radius * (0.48 + (index % 2) * 0.1);
      const end = radius * (0.82 + (index % 3) * 0.04);
      ctx.strokeStyle = "rgba(46,12,19,.82)";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
      ctx.lineTo(Math.cos(angle + 0.16) * middle, Math.sin(angle + 0.16) * middle);
      ctx.lineTo(Math.cos(angle - 0.09) * end, Math.sin(angle - 0.09) * end);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(3,8,15,.58)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.14, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = hits >= maximum ? "#fff0a8" : "#78dcff";
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - hits / maximum));
    ctx.stroke();
    ctx.restore();
  }

  private drawFruit(
    ctx: CanvasRenderingContext2D,
    type: FruitType,
    isBomb: boolean,
    elapsedMs: number,
    id: number,
  ): void {
    const radius = type.radius;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.58)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 12;

    if (isBomb) {
      const pulse = 0.5 + Math.sin(elapsedMs * 0.015 + id) * 0.5;
      ctx.save();
      ctx.shadowOffsetY = 0;
      ctx.shadowColor = "#ff643d";
      ctx.shadowBlur = 20 + pulse * 18;
      ctx.strokeStyle = `rgba(255,113,62,${0.55 + pulse * 0.28})`;
      ctx.lineWidth = 4 + pulse * 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (1.08 + pulse * 0.04), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const bombSprite = this.sprites.get("bomb");
      if (this.isReady(bombSprite)) {
        ctx.drawImage(bombSprite, -radius * 1.22, -radius * 1.22, radius * 2.44, radius * 2.44);
        ctx.shadowBlur = 0;
        this.drawFuseSparks(ctx, radius, elapsedMs, id);
        ctx.restore();
        return;
      }
      const bombGradient = ctx.createRadialGradient(-radius * 0.32, -radius * 0.38, 2, 0, 0, radius);
      bombGradient.addColorStop(0, "#747474");
      bombGradient.addColorStop(0.35, "#303030");
      bombGradient.addColorStop(1, "#080808");
      ctx.fillStyle = bombGradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#9b6e32";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(5, -radius + 2);
      ctx.quadraticCurveTo(22, -radius - 19, 12, -radius - 31);
      ctx.stroke();
      ctx.fillStyle = "#ffd84d";
      ctx.shadowColor = "#ff6b12";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(12, -radius - 31, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const sprite = this.sprites.get(type.name);
    if (this.isReady(sprite)) {
      const visualScale = type.name === "strawberry" ? 1.13 : 1.08;
      const size = radius * 2 * visualScale;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "screen";
      const sheen = ctx.createRadialGradient(-radius * 0.28, -radius * 0.36, 0, -radius * 0.16, -radius * 0.22, radius * 0.72);
      sheen.addColorStop(0, "rgba(255,255,255,.32)");
      sheen.addColorStop(0.2, "rgba(255,255,255,.12)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    this.fruitPath(ctx, type);
    const skinGradient = ctx.createRadialGradient(-radius * 0.34, -radius * 0.38, 3, 0, 0, radius * 1.15);
    skinGradient.addColorStop(0, this.mix(type.skinColor, "#ffffff", 0.55));
    skinGradient.addColorStop(0.45, type.skinColor);
    skinGradient.addColorStop(1, this.mix(type.skinColor, "#000000", 0.2));
    ctx.fillStyle = skinGradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.save();
    this.fruitPath(ctx, type);
    ctx.clip();
    this.drawSkinDetails(ctx, type);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,.34)";
    ctx.beginPath();
    ctx.ellipse(-radius * 0.28, -radius * 0.34, radius * 0.2, radius * 0.34, -0.55, 0, Math.PI * 2);
    ctx.fill();
    this.drawLeaf(ctx, type);
    ctx.restore();
  }

  private isReady(image: HTMLImageElement | undefined): image is HTMLImageElement {
    return Boolean(image?.complete && image.naturalWidth > 0);
  }

  private drawFuseSparks(
    ctx: CanvasRenderingContext2D,
    radius: number,
    elapsedMs: number,
    id: number,
  ): void {
    const sparkX = radius * 0.56;
    const sparkY = -radius * 0.75;
    ctx.save();
    ctx.translate(sparkX, sparkY);
    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < 7; index += 1) {
      const phase = elapsedMs * 0.013 + id * 1.7 + index * 2.4;
      const distance = 9 + (index % 3) * 6;
      const x = Math.cos(phase) * distance;
      const y = Math.sin(phase * 1.23) * distance;
      ctx.fillStyle = index % 2 === 0 ? "#fff3a7" : "#ff6c32";
      ctx.shadowColor = "#ff6c32";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, 2.1 + (index % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private fruitPath(ctx: CanvasRenderingContext2D, type: FruitType): void {
    const r = type.radius;
    ctx.beginPath();
    if (type.name === "apple") {
      ctx.moveTo(0, -r * 0.72);
      ctx.bezierCurveTo(-r * 0.35, -r * 1.08, -r * 1.08, -r * 0.44, -r * 0.9, r * 0.2);
      ctx.bezierCurveTo(-r * 0.74, r * 0.96, -r * 0.18, r * 1.04, 0, r * 0.82);
      ctx.bezierCurveTo(r * 0.18, r * 1.04, r * 0.74, r * 0.96, r * 0.9, r * 0.2);
      ctx.bezierCurveTo(r * 1.08, -r * 0.44, r * 0.35, -r * 1.08, 0, -r * 0.72);
    } else if (type.name === "strawberry") {
      ctx.moveTo(0, r);
      ctx.bezierCurveTo(-r * 0.38, r * 0.56, -r, r * 0.08, -r * 0.76, -r * 0.54);
      ctx.bezierCurveTo(-r * 0.48, -r * 1.02, -r * 0.12, -r * 0.72, 0, -r * 0.55);
      ctx.bezierCurveTo(r * 0.12, -r * 0.72, r * 0.48, -r * 1.02, r * 0.76, -r * 0.54);
      ctx.bezierCurveTo(r, r * 0.08, r * 0.38, r * 0.56, 0, r);
    } else if (type.name === "lemon") {
      ctx.ellipse(0, 0, r * 1.14, r * 0.78, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.closePath();
  }

  private drawSkinDetails(ctx: CanvasRenderingContext2D, type: FruitType): void {
    const r = type.radius;
    if (type.name === "watermelon") {
      ctx.strokeStyle = "rgba(9,53,24,.65)";
      ctx.lineWidth = 6;
      for (let x = -r; x <= r; x += 15) {
        ctx.beginPath();
        ctx.moveTo(x, -r);
        ctx.quadraticCurveTo(x + 8, 0, x - 2, r);
        ctx.stroke();
      }
    } else if (type.name === "orange" || type.name === "lemon") {
      ctx.fillStyle = "rgba(255,255,255,.18)";
      for (let i = 0; i < 22; i += 1) {
        const angle = i * 2.41;
        const distance = r * 0.8 * Math.sqrt((i + 1) / 22);
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type.name === "kiwi") {
      ctx.strokeStyle = "rgba(35,20,8,.25)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 18; i += 1) {
        const angle = (i / 18) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r * 0.8, Math.sin(angle) * r * 0.8);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.stroke();
      }
    } else if (type.name === "strawberry") {
      ctx.fillStyle = type.accentColor;
      for (let i = 0; i < 14; i += 1) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        ctx.beginPath();
        ctx.ellipse((col - 1.5) * r * 0.32 + (row % 2) * 4, -r * 0.38 + row * r * 0.35, 1.7, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawLeaf(ctx: CanvasRenderingContext2D, type: FruitType): void {
    if (type.name === "orange" || type.name === "kiwi" || type.name === "watermelon" || type.name === "lemon") return;
    const r = type.radius;
    ctx.fillStyle = "#2f8a3b";
    ctx.beginPath();
    ctx.ellipse(-4, -r * 0.83, r * 0.2, r * 0.43, -0.62, 0, Math.PI * 2);
    ctx.fill();
    if (type.name === "apple") {
      ctx.strokeStyle = "#523119";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.72);
      ctx.lineTo(4, -r * 1.08);
      ctx.stroke();
    }
  }

  private drawHalves(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    for (const half of state.halves) {
      const r = half.type.radius;
      const radius = fruitRadiusForViewport(half.type, state.width, state.height) * (half.radiusScale ?? 1);
      const scale = radius / r;
      const alpha = Math.max(0, half.alpha);
      const sprite = this.sprites.get(half.type.name);
      const cached = this.halfSprites.get(this.halfSpriteKey(half.type, half.side));
      if (cached) {
        const shadow = this.getHalfShadowSprite(half.type, half.side, scale);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(half.x, half.y + 8);
        ctx.rotate(half.rotation);
        ctx.drawImage(
          shadow.canvas,
          -shadow.size / 2,
          -shadow.size / 2,
          shadow.size,
          shadow.size,
        );
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(half.x, half.y);
        ctx.rotate(half.rotation);
        ctx.scale(scale, scale);
        ctx.drawImage(cached.canvas, -cached.size / 2, -cached.size / 2, cached.size, cached.size);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(half.x, half.y);
        ctx.rotate(half.rotation);
        ctx.scale(scale, scale);
        ctx.shadowColor = "rgba(0,0,0,.5)";
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
        this.drawHalfBody(ctx, half.type, half.side, sprite);
        ctx.restore();
      }
    }
  }

  private prepareHalfShadowsForViewport(width: number, height: number): void {
    const reference = fruitTypeByName("orange");
    const scale = fruitRadiusForViewport(reference, width, height) / reference.radius;
    const scaleKey = scale.toFixed(4);
    if (this.preparedHalfShadowScale === scaleKey) return;
    this.preparedHalfShadowScale = scaleKey;
    if (this.halfShadowSprites.size >= 24) this.halfShadowSprites.clear();
    for (const name of Object.keys(FRUIT_SPRITES) as FruitType["name"][]) {
      if (name === "bomb") continue;
      const type = fruitTypeByName(name);
      this.getHalfShadowSprite(type, -1, scale);
      this.getHalfShadowSprite(type, 1, scale);
    }
  }

  private getHalfShadowSprite(type: FruitType, side: -1 | 1, scale: number): HalfSpriteCache {
    const key = `${type.name}:${side}:${scale.toFixed(4)}`;
    const cached = this.halfShadowSprites.get(key);
    if (cached) return cached;
    const radius = type.radius * scale;
    const blur = 18;
    const size = Math.ceil(radius * 2 + blur * 4 + 12);
    const canvas = document.createElement("canvas");
    canvas.width = size * HALF_CACHE_SCALE;
    canvas.height = size * HALF_CACHE_SCALE;
    const context = canvas.getContext("2d");
    if (context) {
      context.setTransform(
        HALF_CACHE_SCALE,
        0,
        0,
        HALF_CACHE_SCALE,
        canvas.width / 2,
        canvas.height / 2,
      );
      context.fillStyle = "#000000";
      context.shadowColor = "rgba(0,0,0,.5)";
      context.shadowBlur = blur;
      this.traceHalfSilhouette(context, radius, side);
      context.fill();
      context.globalCompositeOperation = "destination-out";
      context.shadowColor = "transparent";
      context.shadowBlur = 0;
      this.traceHalfSilhouette(context, radius, side);
      context.fill();
    }
    const result = { canvas, size };
    this.halfShadowSprites.set(key, result);
    return result;
  }

  private traceHalfSilhouette(
    ctx: CanvasRenderingContext2D,
    radius: number,
    side: -1 | 1,
  ): void {
    ctx.beginPath();
    if (side === -1) ctx.arc(0, 0, radius, Math.PI / 2, Math.PI * 1.5);
    else ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
  }

  private prepareHalfSprites(name: FruitType["name"]): void {
    if (name === "bomb") return;
    const image = this.sprites.get(name);
    if (!this.isReady(image)) return;
    const type = fruitTypeByName(name);
    this.createHalfSprite(type, -1, image);
    this.createHalfSprite(type, 1, image);
  }

  private createHalfSprite(type: FruitType, side: -1 | 1, image: HTMLImageElement): void {
    const key = this.halfSpriteKey(type, side);
    if (this.halfSprites.has(key)) return;
    const size = Math.ceil(type.radius * 2 + 16);
    const canvas = document.createElement("canvas");
    canvas.width = size * HALF_CACHE_SCALE;
    canvas.height = size * HALF_CACHE_SCALE;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(
      HALF_CACHE_SCALE,
      0,
      0,
      HALF_CACHE_SCALE,
      canvas.width / 2,
      canvas.height / 2,
    );
    context.save();
    this.drawHalfBody(context, type, side, image);
    context.restore();
    this.halfSprites.set(key, { canvas, size });
  }

  private drawHalfBody(
    ctx: CanvasRenderingContext2D,
    type: FruitType,
    side: -1 | 1,
    sprite: HTMLImageElement | undefined,
  ): void {
    const r = type.radius;
    ctx.beginPath();
    if (side === -1) ctx.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5);
    else ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    if (this.isReady(sprite)) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(sprite, -r * 1.08, -r * 1.08, r * 2.16, r * 2.16);
      ctx.restore();
    } else {
      const skin = ctx.createLinearGradient(-r, -r, r, r);
      skin.addColorStop(0, this.mix(type.skinColor, "#ffffff", 0.32));
      skin.addColorStop(0.55, type.skinColor);
      skin.addColorStop(1, this.mix(type.skinColor, "#000000", 0.3));
      ctx.fillStyle = skin;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.beginPath();
    if (side === -1) ctx.arc(0, 0, r * 0.84, Math.PI / 2, Math.PI * 1.5);
    else ctx.arc(0, 0, r * 0.84, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    const flesh = ctx.createRadialGradient(
      side * r * 0.12,
      -r * 0.22,
      2,
      side * r * 0.2,
      0,
      r * 0.94,
    );
    flesh.addColorStop(0, this.mix(type.fleshColor, "#ffffff", 0.48));
    flesh.addColorStop(0.52, type.fleshColor);
    flesh.addColorStop(1, this.mix(type.fleshColor, type.skinColor, 0.25));
    ctx.fillStyle = flesh;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.72)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.83);
    ctx.lineTo(0, r * 0.83);
    ctx.stroke();
    this.drawFleshDetails(ctx, type, side);

    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "rgba(255,255,255,.2)";
    ctx.beginPath();
    ctx.ellipse(side * r * 0.34, -r * 0.3, r * 0.17, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private halfSpriteKey(type: FruitType, side: -1 | 1): string {
    return `${type.name}:${side}`;
  }

  private drawFleshDetails(ctx: CanvasRenderingContext2D, type: FruitType, side: -1 | 1): void {
    const direction = side;
    const r = type.radius;
    if (type.name === "watermelon") {
      ctx.fillStyle = "#291314";
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.ellipse(direction * r * (0.2 + (i % 2) * 0.28), -r * 0.5 + i * r * 0.24, 2, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type.name === "kiwi") {
      ctx.fillStyle = "#f7f0c8";
      ctx.beginPath();
      ctx.ellipse(direction * r * 0.25, 0, r * 0.15, r * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#202010";
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.arc(direction * r * 0.48, -r * 0.48 + i * r * 0.2, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type.name === "orange" || type.name === "lemon") {
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(direction * r * 0.75, i * r * 0.28);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.beginPath();
      ctx.arc(direction * r * 0.08, 0, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else if (type.name === "apple") {
      ctx.fillStyle = "#6f3925";
      for (const y of [-0.2, 0.2]) {
        ctx.beginPath();
        ctx.ellipse(direction * r * 0.34, r * y, r * 0.045, r * 0.095, direction * -0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type.name === "strawberry") {
      ctx.fillStyle = "rgba(255,235,211,.9)";
      for (let index = 0; index < 7; index += 1) {
        const y = -r * 0.46 + index * r * 0.15;
        ctx.beginPath();
        ctx.ellipse(direction * r * (0.24 + (index % 2) * 0.18), y, r * 0.026, r * 0.052, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawTrails(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    const feverActive = (state.arcade?.feverTimer ?? 0) > 0;
    for (const blade of state.blades) {
      if (!blade.visible || blade.points.length === 0) continue;
      const points = blade.points;
      let recentSpeed = 0;
      for (const point of points) recentSpeed = Math.max(recentSpeed, point.speed);
      const color = feverActive ? "#ffd85e" : blade.color;
      if (points.length >= 3 && recentSpeed >= MIN_SLICE_SPEED * 0.55) {
        this.drawBladeRibbon(ctx, blade, points, recentSpeed, color, feverActive);
      }
      this.drawBladeTip(ctx, blade, points, color, feverActive);
    }
  }

  private drawBladeRibbon(
    ctx: CanvasRenderingContext2D,
    blade: BladeState,
    points: SlicePoint[],
    recentSpeed: number,
    color: string,
    feverActive: boolean,
  ): void {
    const first = points[0];
    const last = points[points.length - 1];
    const speedRatio = Math.min(1, Math.max(blade.targetSpeed, recentSpeed) / 1500);
    const gradient = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
    gradient.addColorStop(0, `${color}00`);
    gradient.addColorStop(0.28, `${color}24`);
    gradient.addColorStop(0.76, `${color}cc`);
    gradient.addColorStop(1, "#ffffff");

    const strokeInput = this.strokeInput;
    while (strokeInput.length < points.length) strokeInput.push([0, 0, 0]);
    strokeInput.length = points.length;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const sample = strokeInput[index];
      sample[0] = point.x;
      sample[1] = point.y;
      sample[2] = 0.3 + Math.min(0.4, point.speed / 3100);
    }
    const outline = getStroke(strokeInput, {
      size: 5.5 + speedRatio * 4.5 + (feverActive ? 3 : 0),
      thinning: 0.3,
      smoothing: 0.88,
      streamline: 0.05,
      simulatePressure: false,
      start: { cap: true, taper: 44 },
      end: { cap: false, taper: 10 },
      last: false,
    });
    if (outline.length < 3) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = gradient;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 + speedRatio * 8 + (feverActive ? 9 : 0);
    ctx.beginPath();
    this.traceStrokeOutline(ctx, outline);
    ctx.fill();

    const coreStart = Math.max(0, Math.floor(points.length * 0.34));
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = gradient;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 4;
    ctx.lineWidth = 0.9 + speedRatio * 0.9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    this.traceSmoothPath(ctx, points, coreStart);
    ctx.stroke();
    ctx.restore();
  }

  private drawBladeTip(
    ctx: CanvasRenderingContext2D,
    blade: BladeState,
    points: SlicePoint[],
    color: string,
    feverActive: boolean,
  ): void {
    const previous = points[Math.max(0, points.length - 2)];
    const angle = Math.atan2(blade.renderY - previous.y, blade.renderX - previous.x);
    const armed = blade.targetSpeed >= MIN_SLICE_SPEED;
    const speedRatio = Math.min(1, blade.targetSpeed / 1500);

    ctx.save();
    ctx.translate(blade.renderX, blade.renderY);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = armed ? "#ffffff" : color;
    ctx.shadowColor = color;
    ctx.shadowBlur = armed ? 9 + speedRatio * 9 + (feverActive ? 8 : 0) : 7;
    if (armed) {
      const length = 11 + speedRatio * 8;
      const width = 2 + speedRatio * 2.2;
      ctx.beginPath();
      ctx.moveTo(length * 0.64, 0);
      ctx.lineTo(-length * 0.42, -width);
      ctx.lineTo(-length * 0.12, 0);
      ctx.lineTo(-length * 0.42, width);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSlashBursts(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    for (const burst of state.slashBursts) {
      const progress = 1 - burst.life / burst.maxLife;
      const alpha = Math.pow(1 - progress, 1.8);
      const length = 72 + progress * 82;
      ctx.save();
      ctx.translate(burst.x, burst.y);
      ctx.rotate(burst.angle);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = burst.color;
      ctx.shadowColor = burst.color;
      ctx.shadowBlur = 12;
      ctx.lineCap = "round";
      ctx.lineWidth = 5 * (1 - progress) + 1;
      ctx.beginPath();
      ctx.moveTo(-length * 0.5, 0);
      ctx.quadraticCurveTo(0, -12 * (1 - progress), length * 0.5, 0);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.restore();
    }
  }

  private traceSmoothPath(
    ctx: CanvasRenderingContext2D,
    points: SlicePoint[],
    startIndex = 0,
  ): void {
    if (points.length <= startIndex) return;
    ctx.beginPath();
    ctx.moveTo(points[startIndex].x, points[startIndex].y);
    for (let index = startIndex; index < points.length - 1; index += 1) {
      const before = points[Math.max(startIndex, index - 1)];
      const current = points[index];
      const next = points[index + 1];
      const after = points[Math.min(points.length - 1, index + 2)];
      ctx.bezierCurveTo(
        current.x + (next.x - before.x) / 6,
        current.y + (next.y - before.y) / 6,
        next.x - (after.x - current.x) / 6,
        next.y - (after.y - current.y) / 6,
        next.x,
        next.y,
      );
    }
  }

  private traceStrokeOutline(ctx: CanvasRenderingContext2D, points: number[][]): void {
    if (points.length === 0) return;
    ctx.moveTo(points[0][0], points[0][1]);
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      ctx.quadraticCurveTo(
        current[0],
        current[1],
        (current[0] + next[0]) / 2,
        (current[1] + next[1]) / 2,
      );
    }
    const last = points[points.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.closePath();
  }

  private mix(colorA: string, colorB: string, amount: number): string {
    const parse = (color: string) => [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
    const a = parse(colorA);
    const b = parse(colorB);
    return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * amount)).join(",")})`;
  }
}


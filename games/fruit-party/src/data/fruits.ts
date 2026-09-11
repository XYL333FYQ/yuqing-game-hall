import { BOMB_RADIUS, FRUIT_RADIUS, type Fruit, type FruitType } from "../types";

export const FRUIT_TYPES: FruitType[] = [
  {
    name: "watermelon",
    skinColor: "#32a651",
    fleshColor: "#ff4964",
    accentColor: "#101d13",
    radius: FRUIT_RADIUS + 12,
    points: 3,
  },
  {
    name: "orange",
    skinColor: "#ff941f",
    fleshColor: "#ffc044",
    accentColor: "#fff2a8",
    radius: FRUIT_RADIUS + 1,
    points: 1,
  },
  {
    name: "apple",
    skinColor: "#ef3940",
    fleshColor: "#fff0bd",
    accentColor: "#7b1519",
    radius: FRUIT_RADIUS,
    points: 1,
  },
  {
    name: "lemon",
    skinColor: "#ffd62d",
    fleshColor: "#ffe981",
    accentColor: "#fff9c8",
    radius: FRUIT_RADIUS - 2,
    points: 1,
  },
  {
    name: "kiwi",
    skinColor: "#9a7448",
    fleshColor: "#aee657",
    accentColor: "#f2efb6",
    radius: FRUIT_RADIUS - 3,
    points: 2,
  },
  {
    name: "strawberry",
    skinColor: "#ef3551",
    fleshColor: "#ff7b88",
    accentColor: "#ffe5b8",
    radius: FRUIT_RADIUS - 5,
    points: 2,
  },
];

export function randomFruitType(): FruitType {
  return FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
}

export function fruitTypeByName(name: FruitType["name"]): FruitType {
  if (name === "bomb") return BOMB_TYPE;
  const type = FRUIT_TYPES.find((candidate) => candidate.name === name);
  if (!type) throw new Error(`未知水果类型：${name}`);
  return type;
}

/**
 * Keeps targets comfortably large on laptop screens without letting them
 * overwhelm ultrawide/fullscreen layouts. The reference art is authored for
 * 1280×720 and scales only within a deliberately narrow range.
 */
export function fruitRadiusForViewport(
  type: FruitType,
  width: number,
  height: number,
): number {
  const viewportScale = Math.min(width / 1280, height / 720);
  const scale = Math.min(1.22, Math.max(0.92, viewportScale));
  return type.radius * scale;
}

export function fruitRadiusForInstance(
  fruit: Pick<Fruit, "type" | "radiusScale">,
  width: number,
  height: number,
): number {
  return fruitRadiusForViewport(fruit.type, width, height) * (fruit.radiusScale ?? 1);
}

export const BOMB_TYPE: FruitType = {
  name: "bomb",
  skinColor: "#242424",
  fleshColor: "#111111",
  accentColor: "#ffb11b",
  radius: BOMB_RADIUS,
  points: 0,
};


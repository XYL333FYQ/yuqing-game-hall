/// <reference types="node" />
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

/**
 * 在隔离上下文里按浏览器的 `<script>` 顺序加载像素竞技场的真实源码，
 * 只替换 DOM / 存储等宿主对象。测到的是真正会跑在玩家浏览器里的文件。
 */
function loadArena() {
  const windowListeners = new Map<string, Array<(event: any) => void>>();
  const documentListeners = new Map<string, Array<() => void>>();
  const created: any[] = [];

  const add = (map: Map<string, Array<any>>, type: string, handler: any) => {
    const list = map.get(type) ?? [];
    list.push(handler);
    map.set(type, list);
  };
  const remove = (map: Map<string, Array<any>>, type: string, handler: any) => {
    const list = map.get(type);
    const index = list ? list.indexOf(handler) : -1;
    if (index >= 0) list!.splice(index, 1);
  };

  const canvas: any = {
    style: {},
    requestPointerLock() {
      document.pointerLockElement = canvas;
      fire(documentListeners, "pointerlockchange");
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }),
  };

  const document: any = {
    pointerLockElement: null,
    exitPointerLock() {
      document.pointerLockElement = null;
      fire(documentListeners, "pointerlockchange");
    },
    body: { appendChild: (node: any) => created.push(node) },
    createElement: () => ({ style: {}, id: "", textContent: "", addEventListener: () => {} }),
    addEventListener: (type: string, handler: any) => add(documentListeners, type, handler),
    removeEventListener: (type: string, handler: any) => remove(documentListeners, type, handler),
  };

  const storage: Record<string, string> = {};
  const localStorage = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value; },
  };
  const navigator = { getGamepads: () => [] };

  const context = createContext({
    window: { document, navigator, localStorage, setTimeout, clearTimeout },
    document,
    navigator,
    localStorage,
    console: { log: () => {}, info: () => {}, warn: () => {} },
  });

  // engine.js 太大，只注入 controls.js 真正用到的 DOM 辅助函数。
  context.DOM = {
    addEventListener: (node: any, type: string, handler: any) => {
      if (node === document) add(documentListeners, type, handler);
      else add(windowListeners, type, handler);
    },
    removeEventListener: (node: any, type: string, handler: any) => {
      if (node === document) remove(documentListeners, type, handler);
      else remove(windowListeners, type, handler);
    },
    createElement: () => document.createElement(),
    clone: (value: any) => JSON.parse(JSON.stringify(value)),
    generateRandomString: (chars: string, length: number) => chars.repeat(length).slice(0, length),
    getParameterByName: () => null,
  };

  for (const file of ["js/data.js", "js/qmath.js", "js/controls.js"]) {
    runInContext(source(`../public/games/pvp-arena/client/${file}`), context, { filename: file });
  }

  const Controls = (context as any).Controls;
  const instance = new Controls({ screenControls: "mouse" });
  instance.initialize(canvas);

  return {
    controls: instance as Record<string, any>,
    created,
    canvas,
    document,
    dispatchWindow(type: string, event: any) {
      fire(windowListeners, type, event);
    },
    windowListenerCount(type: string) {
      return (windowListeners.get(type) ?? []).length;
    },
  };
}

function fire(map: Map<string, Array<any>>, type: string, event?: any) {
  for (const handler of [...(map.get(type) ?? [])]) handler(event ?? {});
}

describe("pixel arena pointer lock split", () => {
  it("keeps the menu mouse working without any pointer lock", () => {
    const arena = loadArena();

    // 鼠标监听必须在初始化时就挂上，不能等 pointerlockchange。
    expect(arena.windowListenerCount("mousemove")).toBeGreaterThan(0);
    expect(arena.windowListenerCount("mousedown")).toBeGreaterThan(0);
    expect(arena.windowListenerCount("mouseup")).toBeGreaterThan(0);

    // 没有指针锁定时，菜单拿到的是画布内的真实鼠标位置。
    arena.dispatchWindow("mousemove", { clientX: 320, clientY: 200, movementX: 999, movementY: 999 });
    expect(arena.controls.isPointerLockActive()).toBe(false);
    expect(arena.controls.takeMenuPointer()).toEqual({ x: 160, y: 100, moved: true, seen: true });

    // 画布是等比缩放的：640x400 显示 320x200 的游戏画面，坐标按比例换算。
    arena.dispatchWindow("mousemove", { clientX: 160, clientY: 100 });
    expect(arena.controls.takeMenuPointer()).toMatchObject({ x: 80, y: 50 });
  });

  it("only asks for pointer lock in a real match and still allows menus when it fails", () => {
    const arena = loadArena();

    arena.controls.setPointerLockEnabled(false);
    arena.dispatchWindow("mousemove", { clientX: 320, clientY: 200 });
    expect(arena.controls.takeMenuPointer()).not.toBeNull();
    expect(arena.controls.isPointerLockWanted()).toBe(false);

    arena.controls.setPointerLockEnabled(true);
    expect(arena.controls.isPointerLockWanted()).toBe(true);
    // 还没拿到锁：菜单指针仍然可用，同时出现“点击继续”提示。
    expect(arena.controls.takeMenuPointer()).not.toBeNull();
    const hint = arena.created.find((node) => node.id === "pointer-lock-hint");
    expect(hint).toBeDefined();
    expect(hint.textContent).toContain("点击");
    expect(hint.style.display).toBe("block");

    // 拿到锁之后菜单改用相对位移，提示隐藏。
    arena.canvas.requestPointerLock();
    expect(arena.controls.isPointerLockActive()).toBe(true);
    expect(arena.controls.takeMenuPointer()).toBeNull();
    expect(hint.style.display).toBe("none");

    // 用户按 Esc：锁丢失，但菜单鼠标立刻恢复可用，不会“彻底失效”。
    arena.document.exitPointerLock();
    expect(arena.controls.isPointerLockActive()).toBe(false);
    expect(arena.controls.takeMenuPointer()).not.toBeNull();
    expect(hint.style.display).toBe("block");

    // 离开对局回到菜单时彻底关闭 Pointer Lock 需求。
    arena.controls.setPointerLockEnabled(false);
    expect(hint.style.display).toBe("none");
  });

  it("only enters the pointer-lock state for the FPS match", () => {
    const gamestate = source("../public/games/pvp-arena/client/js/gamestate.js");
    expect(gamestate).toContain("CONTROLS.setPointerLockEnabled(nextGameState===GAMESTATE_PLAY)");
    // 菜单必须走绝对指针路径。
    expect(source("../public/games/pvp-arena/client/js/gui-keymenu.js")).toContain("CONTROLS.takeMenuPointer");
  });
});

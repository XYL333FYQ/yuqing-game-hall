// Map: night-time factory complex. Layout & landmarks inspired by classic
// wave-survival factory maps; all textures CC0, all geometry built in code.
import * as THREE from 'three';
import { concreteTexture, brickTexture, metalTexture, woodTexture, textTexture, makeBox, pointInBox, rand, choice } from './utils.js';
import { assets } from './assets.js';
import { Sky } from './render/Sky.js';
import { SunShadow } from './render/SunShadow.js';
import { enhanceMaterial } from './render/Materials.js';
import { splatTexture } from './render/Particles.js';
import { BLOOD_DECAL_COLOR } from './fx.js';
import { decorateMap } from './map-props.js';
import { buildPerkMachine } from './props/perkMachine.js';
import { buildMysteryBox } from './props/mysteryBox.js';
import { buildPackAPunch, buildPapSignFrame } from './props/packAPunch.js';
import { signTexture as papSignTexture } from './props/materials.js';
import { buildTeleporter } from './props/teleporter.js';
import { buildPowerSwitch } from './props/powerSwitch.js';
import { buildWallBuy } from './props/wallbuy.js';
import { WEAPONS } from './weapons.js';
import { CFG } from './config.js';
import { buildDoorLeaf, buildDoorFrame, buildDoorLamp } from './props/door.js';
import { navInvalidate } from './navmesh.js';
import {
  MAP_ROOMS, MAP_DOOR_DEFS, MAP_RAMPS, MAP_NAV_LINKS, MAP_WALL_RUNS, cappedWallRuns,
  MAP_WALLBUYS, MAP_PERKS, MAP_TELEPORTERS, MAINFRAME_PLATFORM, MAINFRAME_STEPS,
  MAINFRAME_EAST_ENTRY_KEEP_CLEAR, MAP_TRAVERSAL_ZONES, FACTORY_CATWALK, PAP_ENERGY_VISUAL,
  INITIAL_MYSTERY_BOX, stairFlightColliders, auditInteractableApproaches, auditKeepClearZone,
  auditMapEgress, auditMapStructure,
} from './map-layout.js';

const WALL_T = 0.4;

// ---------------------------------------------------------------------------
// Art direction. One place to tune the whole look: the post stack reads this
// verbatim, so grading, fog and bloom stay consistent with the map's lighting.
// Moonlit industrial: cold cyan shadow, warm sodium practicals, heavy haze.
// ---------------------------------------------------------------------------
// Moon placement is shared by the sky shader, the key light and the post
// stack's in-scatter direction; one constant keeps all three in agreement.
export const MOON_DIR = new THREE.Vector3(0.46, 0.60, -0.65).normalize();

export const GRADE = {
  exposure: 2.45,
  bloomStrength: 0.55,
  bloomThreshold: 1.15,
  saturation: 1.10,
  contrast: 1.075,
  // Blacks are lifted, not crushed. AgX rolls the bottom end off hard, and
  // with the power off the factory interior went genuinely unnavigable — you
  // could not see a wall until it hit you. This keeps the night reading as
  // night while leaving enough separation to move through a dark room.
  lift: new THREE.Vector3(0.030, 0.040, 0.062),
  gamma: new THREE.Vector3(1.0, 1.0, 1.0),
  gain: new THREE.Vector3(1.045, 1.0, 0.955),     // sodium-warm highlights
  volDensity: 0.0125,
  volHeightFalloff: 0.14,
  volFogBase: -0.5,
  volAnisotropy: 0.76,
  volAmbient: 0.16,
  volAmbientColor: new THREE.Color(0x24344f),
};

export function buildMap(scene, opts = {}) {
  const group = new THREE.Group();
  const colliders = [];   // {minX,maxX,minZ,maxZ,y0,h,window?,shootOk?}
  // Assigned at the end of this builder. openDoor() and moveBox() run long after
  // that, and both need the map object itself to invalidate enemy navigation.
  let api;
  const barriers = [];
  const risers = [];
  const doors = [];
  const interact = [];
  const flickerLights = [];
  const fires = [];

  /**
   * Separable box blur over the RED channel of an RGBA ImageData, wrapping at
   * the edges so a tiling texture stays tiling. Returns a Float32Array of
   * heights, which is all the Sobel below needs.
   */
  function boxBlur(data, S, radius) {
    const src = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) src[i] = data[i * 4];
    const tmp = new Float32Array(S * S);
    const n = radius * 2 + 1;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let s = 0;
        for (let k = -radius; k <= radius; k++) s += src[y * S + ((x + k + S) % S)];
        tmp[y * S + x] = s / n;
      }
    }
    for (let x = 0; x < S; x++) {
      for (let y = 0; y < S; y++) {
        let s = 0;
        for (let k = -radius; k <= radius; k++) s += tmp[((y + k + S) % S) * S + x];
        src[y * S + x] = s / n;
      }
    }
    return src;
  }

  // ---------- code-drawn industrial brick (color + matching normal map) ----------
  // Regular running-bond courses — reads as factory brick, not rubble.
  function makeBrickMaps() {
    const S = 512, BW = 64, BH = 32, MORT = 3;
    const cc = document.createElement('canvas'); cc.width = cc.height = S;
    const hc = document.createElement('canvas'); hc.width = hc.height = S;
    const g = cc.getContext('2d'), h = hc.getContext('2d');
    // mortar
    g.fillStyle = '#4a453e'; g.fillRect(0, 0, S, S);
    h.fillStyle = '#303030'; h.fillRect(0, 0, S, S);
    // sooty brown-gray industrial brick (desaturated, wartime grime)
    const tones = ['#5e4f42', '#65564a', '#584a3f', '#6b5a4c', '#52453b', '#615245'];
    for (let row = 0; row < S / BH; row++) {
      const off = (row % 2) * (BW / 2);
      for (let col = -1; col < S / BW + 1; col++) {
        const x = col * BW + off, y = row * BH;
        const base = new THREE.Color(choice(tones));
        base.offsetHSL(rand(-0.012, 0.012), rand(-0.06, 0.05), rand(-0.045, 0.045));
        g.fillStyle = '#' + base.getHexString();
        g.fillRect(x + MORT / 2, y + MORT / 2, BW - MORT, BH - MORT);
        // per-brick speckle + tonal streaks
        for (let i = 0; i < 26; i++) {
          g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,235,210'},${rand(0.02, 0.08)})`;
          g.fillRect(x + MORT / 2 + rand(0, BW - MORT - 3), y + MORT / 2 + rand(0, BH - MORT - 2), rand(1, 4), rand(1, 2));
        }
        const hv = 200 + Math.floor(rand(-28, 28));
        h.fillStyle = `rgb(${hv},${hv},${hv})`;
        h.fillRect(x + MORT / 2, y + MORT / 2, BW - MORT, BH - MORT);
      }
    }
    // soot / grime wash
    for (let i = 0; i < 40; i++) {
      const gx = rand(0, S), gy = rand(0, S), r = rand(20, 90);
      const grad = g.createRadialGradient(gx, gy, 0, gx, gy, r);
      grad.addColorStop(0, `rgba(10,8,6,${rand(0.04, 0.12)})`); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
    // height -> normal (Sobel)
    //
    // Blur the height field first. Drawn straight, every brick edge is a
    // one-texel cliff from mortar (48) to face (200), and a Sobel across that
    // produces a normal that swings ~70 degrees between two adjacent texels.
    // No amount of mip filtering or anisotropy can band-limit a signal like
    // that: the mip chain averages the NORMALS, three renormalises whatever it
    // reads back, and the result flips direction with every sub-pixel step of
    // the camera. That is the crawling ladder of bright dashes along the mortar
    // lines. Real brickwork has a rounded arris anyway, so a two-texel bevel
    // costs nothing visually and makes the map resolvable.
    const hd = boxBlur(h.getImageData(0, 0, S, S).data, S, 2);
    const nc = document.createElement('canvas'); nc.width = nc.height = S;
    const ng = nc.getContext('2d');
    const out = ng.createImageData(S, S);
    const H = (x, y) => hd[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) / 255;
      const dy = (H(x, y + 1) - H(x, y - 1)) / 255;
      const inv = 1 / Math.hypot(dx * 2.2, dy * 2.2, 1);
      const i = (y * S + x) * 4;
      out.data[i] = (-dx * 2.2 * inv * 0.5 + 0.5) * 255;
      out.data[i + 1] = (dy * 2.2 * inv * 0.5 + 0.5) * 255;
      out.data[i + 2] = inv * 255;
      out.data[i + 3] = 255;
    }
    ng.putImageData(out, 0, 0);
    const map = new THREE.CanvasTexture(cc);
    map.colorSpace = THREE.SRGBColorSpace;
    const normalMap = new THREE.CanvasTexture(nc);
    // Anisotropy, same as the loaded CC0 sets get in assets.js. Every brick
    // wall in the map is a long surface you walk beside, so it is almost always
    // being minified far harder along the corridor than across it. At the
    // default anisotropy of 1 the sampler has to pick one mip for both axes,
    // and the mortar courses smear into a moire ladder as you move.
    for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; }
    return { map, normalMap };
  }
  const brickMaps = makeBrickMaps();

  // ---------- materials (CC0 PBR textures + generated brick) ----------
  const pbr = (key, rx, ry, opts = {}) => new THREE.MeshStandardMaterial({
    ...assets.texSet(key, rx, ry),
    roughness: 1.0, metalness: 0.05, ...opts,
  });
  const matFloor = pbr('concrete', 1, 1, { color: 0x4c5055 });
  // generated industrial brick — UVs are world-scaled in pushBox so density is uniform
  const matWall = new THREE.MeshStandardMaterial({
    map: brickMaps.map, normalMap: brickMaps.normalMap, normalScale: new THREE.Vector2(1.35, 1.35),
    color: 0x5f646a, roughness: 0.94, metalness: 0.02,
  });
  const matBrick = matWall;
  // Merged-bucket materials use world-scaled UVs (see solidGeos.*.uvScale), so
  // their texture repeat stays 1:1 — the tiling density is set in metres, not
  // per-face. Without this a 2x2 repeat spread one diamond-plate tile over four
  // metres of balcony soffit and the tread smeared into a lattice of bright
  // specular dashes across the whole ceiling.
  const matMetal = pbr('rust', 1, 1, { metalness: 0.5, roughness: 0.78, color: 0x686e75 });
  // Diamond tread on a large soffit is a specular-aliasing trap: every tread
  // edge is a tiny mirror, and from below under a sodium lamp the whole ceiling
  // fills with crawling bright dashes. Keep it rough and matte.
  const matPlate = pbr('plate', 1, 1, { metalness: 0.22, roughness: 0.88, color: 0x62676e, normalScale: new THREE.Vector2(0.28, 0.28) });
  const matWood = pbr('wood', 1, 1, { color: 0x7c736b, roughness: 0.92 });
  const matDirt = pbr('dirt', 40, 40, { color: 0x55534e });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 1 });
  const matConcrete = pbr('concrete', 4, 2, { color: 0x4a4e54 });
  // Ceilings need their own material. Sharing matConcrete meant one texture
  // tile was stretched to 2.2m x 11.4m across a corridor roof, so every pebble
  // in the normal map smeared into a long comma-shaped specular streak under
  // the sodium lamps — a lattice of bright dashes across the whole ceiling.
  // Here the UVs are world-scaled (see solidGeos.ceiling.uvScale) and the
  // surface is fully rough, because a concrete soffit has no gloss.
  const matCeiling = new THREE.MeshStandardMaterial({
    ...assets.texSet('concrete', 1, 1),
    color: 0x3c4045, roughness: 1.0, metalness: 0.0,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });

  // Triplanar micro-detail + macro variation on every large surface. Floors get
  // puddles; walls get the detail normal only (water does not cling to brick).
  enhanceMaterial(matFloor, { detailScale: 3.4, detailStrength: 0.72, macroAmount: 0.22, macroRough: 0.28, wetness: 0.9, wetScale: 0.30, wetHeight: 0.4 });
  enhanceMaterial(matDirt, { detailScale: 4.2, detailStrength: 0.8, macroAmount: 0.26, macroRough: 0.3, wetness: 0.6, wetScale: 0.38, wetHeight: 0.3 });
  enhanceMaterial(matWall, { detailScale: 5.5, detailStrength: 0.38, detailNear: 3, detailFar: 10, macroAmount: 0.19, macroRough: 0.22 });
  enhanceMaterial(matConcrete, { detailScale: 4.0, detailStrength: 0.42, detailNear: 2.5, detailFar: 8, macroAmount: 0.2, macroRough: 0.26 });
  enhanceMaterial(matCeiling, { detailScale: 3.0, detailStrength: 0.3, detailNear: 2, detailFar: 7, macroAmount: 0.24, macroRough: 0.16 });
  enhanceMaterial(matMetal, { detailScale: 7.0, detailStrength: 0.3, detailNear: 2.5, detailFar: 9, macroAmount: 0.22, macroRough: 0.3 });
  enhanceMaterial(matPlate, { detailScale: 7.0, detailStrength: 0.16, detailNear: 1.8, detailFar: 5.5, macroAmount: 0.14, macroRough: 0.22 });
  enhanceMaterial(matWood, { detailScale: 6.0, detailStrength: 0.45, macroAmount: 0.2, macroRough: 0.2 });

  const solidGeos = { wall: [], brick: [], metal: [], wood: [], dark: [], plate: [], concrete: [], ceiling: [] };
  // world-units per texture tile for each merged material (brick tile = 1.76m of wall)
  solidGeos.wall.uvScale = 1 / 1.76;
  solidGeos.brick.uvScale = 1 / 1.76;
  solidGeos.ceiling.uvScale = 1 / 2.4;   // one concrete tile every 2.4m
  solidGeos.plate.uvScale = 1 / 0.9;     // diamond tread reads at ~0.9m
  solidGeos.metal.uvScale = 1 / 1.4;
  solidGeos.wood.uvScale = 1 / 1.1;
  solidGeos.concrete.uvScale = 1 / 2.0;
  const tmpM = new THREE.Matrix4();

  // BoxGeometry UVs are 0..1 per face — rescale them to world units so every
  // wall/floor/crate has the same texel density regardless of its size.
  function worldUVs(geo, w, h, d, s) {
    const uv = geo.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
    for (let f = 0; f < 6; f++) {
      const [du, dv] = dims[f];
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, uv.getX(idx) * du * s, uv.getY(idx) * dv * s);
      }
    }
  }

  function pushBox(arr, cx, cy, cz, w, h, d, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (arr.uvScale) worldUVs(g, w, h, d, arr.uvScale);
    tmpM.makeRotationY(ry).setPosition(cx, cy, cz);
    g.applyMatrix4(tmpM);
    arr.push(g);
  }

  // ---------- wall builder (axis aligned) ----------
  // gap: {at (dist from start), w, kind:'door'|'window'}
  function wallRun(x1, z1, x2, z2, h, gaps = [], mat = 'wall', y0 = 0, capped = false) {
    const horiz = Math.abs(z2 - z1) < 0.001;
    const len = horiz ? x2 - x1 : z2 - z1;
    const sorted = [...gaps].sort((a, b) => a.at - b.at);
    let cur = 0;
    const segs = [];
    for (const gp of sorted) { segs.push([cur, gp.at - gp.w / 2, null]); segs.push([gp.at - gp.w / 2, gp.at + gp.w / 2, gp]); cur = gp.at + gp.w / 2; }
    segs.push([cur, len, null]);
    // An elevated run's brickwork starts SKIRT metres below its collider.
    //
    // Every stacked wall in the map has a ground run beneath it with the same
    // footprint, and a deck slab whose top is at the same height. Flush, that
    // put an upward-facing wall top and an upward-facing deck top in one plane
    // over as much as 16 metres — a strip of pure z-fight along the foot of the
    // wall, which is exactly the thin bright line players see where a wall
    // meets a floor. Dropping the visible box a few centimetres swallows both
    // of those faces inside solid geometry. Colliders and floorY still use the
    // authored y0, so nothing about movement changes.
    const skirt = y0 > 0 ? 0.06 : 0;
    // ...and a run with another run standing ON it sinks its own cap by the
    // same amount, so the joint disappears into the deck slab poured at that
    // height. Without this the cap, the deck and the upper run all shared one
    // upward-facing plane, and inside an elevated DOOR OPENING — where the
    // upper run is absent below the lintel — that plane was exposed right
    // across the threshold players walk over. See cappedWallRuns().
    const cap = capped ? 0.06 : 0;
    for (const [a, b, gp] of segs) {
      if (b - a < 0.01) continue;
      const mid = (a + b) / 2, w = b - a;
      const cx = horiz ? x1 + mid : x1;
      const cz = horiz ? z1 : z1 + mid;
      const bw = horiz ? w : WALL_T, bd = horiz ? WALL_T : w;
      if (!gp) {
        pushBox(solidGeos[mat], cx, y0 - skirt + (h + skirt - cap) / 2, cz, bw, h + skirt - cap, bd);
        colliders.push({ minX: cx - bw / 2, maxX: cx + bw / 2, minZ: cz - bd / 2, maxZ: cz + bd / 2, y0, h });
      } else if (gp.kind === 'window') {
        // sill + header
        pushBox(solidGeos[mat], cx, y0 - skirt + (0.9 + skirt) / 2, cz, bw, 0.9 + skirt, bd);
        colliders.push({ minX: cx - bw / 2, maxX: cx + bw / 2, minZ: cz - bd / 2, maxZ: cz + bd / 2, y0, h: 0.9, window: true });
        pushBox(solidGeos[mat], cx, y0 + 2.2 + (h - 2.2) / 2, cz, bw, h - 2.2, bd);
        colliders.push({ minX: cx - bw / 2, maxX: cx + bw / 2, minZ: cz - bd / 2, maxZ: cz + bd / 2, y0: y0 + 2.2, h: h - 2.2, shootOk: true });
        // The open aperture is for zombies and bullets, not players. Previously
        // a jump cleared the 0.9m sill, letting players phase through a visible
        // boarded window and escape the map shell.
        colliders.push({
          minX: cx - bw / 2, maxX: cx + bw / 2,
          minZ: cz - bd / 2, maxZ: cz + bd / 2,
          y0: y0 + 0.9, h: 1.3, playerOnly: true, noRaycast: true,
        });
        addBarrier(gp, cx, cz, horiz, y0);
      } else if (gp.kind === 'door' || gp.kind === 'passage') {
        // lintel above 3m
        if (h > 3) {
          pushBox(solidGeos[mat], cx, y0 + 3 + (h - 3) / 2, cz, bw, h - 3, bd);
          colliders.push({ minX: cx - bw / 2, maxX: cx + bw / 2, minZ: cz - bd / 2, maxZ: cz + bd / 2, y0: y0 + 3, h: h - 3, shootOk: true });
        }
      }
    }
  }

  // ---------- barriers ----------
  const boardGeoCache = new THREE.BoxGeometry(1.7, 0.16, 0.07);
  let barrierId = 0;
  function addBarrier(gp, cx, cz, horiz, y0 = 0) {
    // inward normal points into the room
    let inx = 0, inz = 0;
    if (horiz) inz = gp.in; else inx = gp.in;
    const b = {
      id: barrierId++, x: cx, z: cz, nx: inx, nz: inz,
      alcove: { x: cx - inx * 1.5, z: cz - inz * 1.5 },
      boards: 6, maxBoards: 6, room: gp.room,
      boardsMesh: new THREE.Group(), tearTimer: 0, occupant: null,
    };
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(boardGeoCache, matWood);
      const y = y0 + 1.0 + i * 0.22;
      m.position.set(cx + (horiz ? rand(-0.06, 0.06) : inx * 0.05), y, cz + (horiz ? inz * 0.05 : rand(-0.06, 0.06)));
      m.rotation.set(0, horiz ? rand(-0.14, 0.14) : Math.PI / 2 + rand(-0.14, 0.14), rand(-0.1, 0.1));
      b.boardsMesh.add(m);
    }
    updateBoardsVisual(b);
    group.add(b.boardsMesh);
    // alcove enclosure (brick shaft so it doesn't read as a black void)
    const ax = b.alcove.x, az = b.alcove.z;
    pushBox(solidGeos.concrete, ax, 0.05, az, 2.6, 0.1, 2.6);
    const wallD = 1.3;
    const sides = horiz
      ? [[ax - wallD, az, 0.12, 2.6], [ax + wallD, az, 0.12, 2.6], [ax, az - inz * wallD, 2.7, 0.12]]
      : [[ax, az - wallD, 2.6, 0.12], [ax, az + wallD, 2.6, 0.12], [ax - inx * wallD, az, 0.12, 2.7]];
    // These three panels are brickwork like any other, and until now they were
    // the only brickwork in the map with nothing behind it: no collider, so
    // players walked through them and bullets went through them.
    //
    // Sixteen of the seventeen alcoves hang off the OUTSIDE of the map shell
    // where nobody can reach them, which is why it went unnoticed. The two on
    // `animal_west` do not: that run separates two playable rooms, so its
    // windows face the Animal Lab and their alcoves stand 2.8m out into the
    // Generator Room, either side of Teleporter A's door — two free-standing
    // brick boxes you could run straight through.
    //
    // The pocket stays open on its window side only, which is the side the
    // occupant is meant to leave by. Zombies working a barrier already ignore
    // the `window` panel (see Zombies._colliders), and dedicated dog rounds
    // never claim a barrier at all, so nothing is sealed in here that was not
    // already committed to climbing out through the boards.
    for (const [sx, sz, sw, sd] of sides) {
      pushBox(solidGeos.brick, sx, 1.3, sz, sw, 2.6, sd);
      colliders.push({
        minX: sx - sw / 2, maxX: sx + sw / 2,
        minZ: sz - sd / 2, maxZ: sz + sd / 2,
        y0: 0, h: 2.6,
      });
    }
    barriers.push(b);
  }
  function updateBoardsVisual(b) {
    b.boardsMesh.children.forEach((m, i) => { m.visible = i < b.boards; });
  }

  // ---------- rooms (Waffenfabrik Der Riese — authentic floor plan) ----------
  const rooms = MAP_ROOMS;
  function roomAt(x, z, y = 0) {
    for (const r of rooms) {
      if (r.yMin !== undefined && y < r.yMin) continue;
      if (r.yMax !== undefined && y > r.yMax) continue;
      if (pointInBox(x, z, r.rect)) return r.id;
    }
    return null;
  }

  // ---------- walls ----------
  const H = 4.5, HH = 7;
  const structureAudit = auditMapStructure();
  if (!structureAudit.ok) throw new Error(`Map structure invariant failed: ${structureAudit.issues.join('; ')}`);
  // Ground-level shell below Chemical Testing is part of MAP_WALL_RUNS; keep
  // this named invariant because the former elevated-only shell exposed the
  // global dirt plane beside Double Tap.
  const cappedRuns = cappedWallRuns(MAP_WALL_RUNS);
  for (const wall of MAP_WALL_RUNS) {
    wallRun(wall.x1, wall.z1, wall.x2, wall.z2, wall.h, wall.gaps, wall.mat || 'wall', wall.y0 || 0, cappedRuns.has(wall.id));
  }

  // ---------- ceilings (indoor rooms; factory gets a broken skylight) ----------
  // Ceiling slabs ABUT; they must never overlap.
  //
  // Three pairs used to share 0.8m of footprint at the same height — the
  // animal lab against the generator room, the factory's north bay against its
  // west and east bays, and Chemical Testing against the garage balcony. An
  // overlap at equal y puts two soffits in one plane, and the soffit is the
  // face you are looking straight at from underneath. The animal-lab pair
  // alone was 11.8 square metres of pure z-fight directly over the doorway
  // between the two rooms. Abutting slabs share only an edge, and their side
  // faces are opposite-facing and buried above the wall head, so neither can
  // fight. Seams sit over a wall centre wherever possible.
  const ceil = (cx, cz, w, d, y, mat = 'ceiling') => pushBox(solidGeos[mat], cx, y, cz, w, 0.25, d);
  ceil(-10, 3, 8.8, 22.8, H);    // left corridor
  ceil(10, 3, 8.8, 22.8, H);     // garage entrance
  ceil(-23.4, -13, 18.0, 14.8, H); // animal lab          x -32.4 .. -14.4
  ceil(-10, -15, 8.8, 14.8, 6);    // lab balcony (over 2.9 floor)
  ceil(-38.4, -13, 12.0, 14.8, H); // generator room      x -44.4 .. -32.4
  ceil(23.4, -13, 18.0, 14.8, H); // auto garage          x 14.4 .. 32.4
  ceil(10, -14.6, 8.8, 14.0, 6);   // garage balcony      z -21.6 .. -7.6
  ceil(17, -30, 14.8, 16.8, 6);    // chem testing        z -38.4 .. -21.6
  ceil(0, -59, 28.8, 6.8, HH);   // factory (north)       z -62.4 .. -55.6
  ceil(0, -45, 28.8, 6.8, HH);   // factory (south)       z -48.4 .. -41.6
  ceil(-11, -52, 6.8, 7.2, HH);  // factory (west)        z -55.6 .. -48.4
  ceil(11, -52, 6.8, 7.2, HH);   // factory (east)        z -55.6 .. -48.4
  // skylight frame + moonlight shafts
  const skyFrameMat = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.6, metalness: 0.5 });
  for (const [fx, fz, fw, fd] of [[-8.1, -52, 0.3, 8.5], [8.1, -52, 0.3, 8.5], [0, -47.9, 16.5, 0.3], [0, -56.1, 16.5, 0.3]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.18, fd), skyFrameMat);
    f.position.set(fx, HH - 0.05, fz);
    group.add(f);
  }
  // Skylight shafts are no longer faked with additive quads. Two 4.5m x 9m
  // double-sided planes standing in the middle of the hall read as sheets of
  // glass, aliased hard along every edge they intersected, and flickered as
  // transparency sorting flipped when the camera moved. The raymarched
  // volumetric pass in the post stack produces the real shaft through the
  // skylight, shadow-mapped against the actual roof opening.

  // ---------- floor ----------
  const floorGeo = new THREE.PlaneGeometry(160, 160);
  const floor = new THREE.Mesh(floorGeo, matDirt);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-5, -0.01, -18);
  floor.receiveShadow = true;
  group.add(floor);
  // Room floor slabs get WORLD-SCALED UVs. Previously each slab was a unit-UV
  // plane sampling matFloor's 44x44 repeat, so a 26x20m courtyard tiled the
  // texture every 0.59m — far below one texel per pixel at any distance. The
  // resulting minification aliasing showed up as regular horizontal bands
  // marching across the ground as the player walked. One tile every 2.2m keeps
  // the floor inside the mip chain and makes texel density uniform between
  // rooms of different sizes.
  const FLOOR_TILE = 2.2;
  const OVERLAP = 0.10;
  // Height LEVELS for the overlapping slabs, assigned by graph colouring below.
  //
  // The stagger used to be 0.4mm per slab in placement order, on the reasoning
  // that it was "orders of magnitude larger than the depth precision". It is
  // not. With near = 0.15 and a 24-bit depth window one step is ~0.36mm at 30m
  // and ~1.0mm at 50m, and this map is 76 x 88m — so the near floor resolved
  // and the far floor still fought, which is exactly the "it flickers over
  // there but not here" shape of the report. A monotonic stagger also drifts
  // without bound, walking the visual floor away from the y = 0 the colliders,
  // floorY() and every floor decal are placed against.
  //
  // So: a slab takes the lowest level not already taken by a slab it actually
  // OVERLAPS. Rectangles in a plane need only a handful of levels, so the total
  // spread stays a few millimetres — no drift — while every overlapping pair is
  // guaranteed a full LEVEL_STEP of depth separation.
  const LEVEL_STEP = 0.002;
  const placed = [];
  for (const r of rooms) {
    // Elevated rooms (balconies, the bridge, the catwalk, chem testing) already
    // have their real floor built as an elevated slab in `floorZones`. Giving
    // them a SECOND slab down at y = 0.005 laid a coplanar surface exactly on
    // top of the ground room underneath — upstairsa over leftcorridor,
    // upstairsg over garageentrance, catwalk over factory — and the two
    // z-fought, which is the flickering/shimmering ground the player sees.
    if (r.yMin) continue;
    // Adjacent ground rooms share their rect edges exactly — 8 such pairs. Two
    // coplanar planes meeting on a shared edge leave a hairline where neither
    // wins the rasteriser's fill rule, and the global dirt plane 15mm below is
    // far darker than the concrete, so that hairline reads as a hard black line
    // ruled across the floor. That is the "horizontal black lines" the player
    // kept reporting, and why no post-process toggle ever changed it: it is
    // geometry, not a pass.
    //
    // OVERLAP the slabs so there is no shared edge to crack. Because they
    // overlap rather than abut, a height step between two of them opens no hole
    // — the lower slab simply continues underneath — so the step costs nothing
    // visually and buys a deterministic depth winner across the whole band.
    const w = (r.rect.maxX - r.rect.minX) + OVERLAP * 2;
    const d = (r.rect.maxZ - r.rect.minZ) + OVERLAP * 2;
    const box = {
      minX: r.rect.minX - OVERLAP, maxX: r.rect.maxX + OVERLAP,
      minZ: r.rect.minZ - OVERLAP, maxZ: r.rect.maxZ + OVERLAP,
    };
    const taken = new Set();
    for (const p of placed) {
      if (p.minX < box.maxX && p.maxX > box.minX && p.minZ < box.maxZ && p.maxZ > box.minZ) {
        taken.add(p.level);
      }
    }
    let level = 0;
    while (taken.has(level)) level++;
    placed.push({ ...box, level });
    const slabGeo = new THREE.PlaneGeometry(w, d);
    const uv = slabGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * w / FLOOR_TILE, uv.getY(i) * d / FLOOR_TILE);
    }
    const slab = new THREE.Mesh(slabGeo, matFloor);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(
      (r.rect.minX + r.rect.maxX) / 2,
      0.005 + level * LEVEL_STEP,
      (r.rect.minZ + r.rect.maxZ) / 2,
    );
    slab.receiveShadow = true;
    group.add(slab);
  }

  // ---------- elevation: floor zones + ramps ----------
  const floorZones = [
    MAINFRAME_PLATFORM,                                         // mainframe platform (clear of both 750 doors at x=±8)
    ...MAINFRAME_STEPS,                                         // individually walkable/jumpable spawn steps
    { minX: -14, maxX: -6, minZ: -22, maxZ: -8, y: 2.9, holes: [{ minX: -13.2, maxX: -8.8, minZ: -13.2, maxZ: -10.8 }] },      // lab balcony (stairwell hole)
    { minX: 6, maxX: 14, minZ: -22, maxZ: -8, y: 2.9, holes: [{ minX: 8.8, maxX: 13.2, minZ: -13.2, maxZ: -10.8 }] },        // garage balcony (stairwell hole)
    { minX: 10, maxX: 24, minZ: -38, maxZ: -22, y: 2.9 },      // chem testing
    { minX: -6, maxX: 6, minZ: -13, maxZ: -11, y: 2.9 },       // bridge
    FACTORY_CATWALK,                                            // factory catwalk begins at the stair landing
  ];
  const ramps = MAP_RAMPS;
  function floorY(x, z, curY = 0, tol = 1.6) {
    let y = 0;
    for (const r of ramps) {
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      const tt = r.axis === 'x' ? (r.dir > 0 ? (x - r.minX) / (r.maxX - r.minX) : (r.maxX - x) / (r.maxX - r.minX))
                                : (r.dir > 0 ? (z - r.minZ) / (r.maxZ - r.minZ) : (r.maxZ - z) / (r.maxZ - r.minZ));
      const ry = r.y0 + (r.y1 - r.y0) * Math.min(1, Math.max(0, tt));
      if (ry > y && curY >= ry - tol) y = ry;
    }
    for (const zn of floorZones) {
      if (x < zn.minX || x > zn.maxX || z < zn.minZ || z > zn.maxZ) continue;
      if (zn.holes) {
        let inHole = false;
        for (const h of zn.holes) if (x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ) { inHole = true; break; }
        if (inHole) continue;
      }
      if (zn.y > y && curY >= zn.y - tol) y = zn.y;
    }
    return y;
  }

  // ---------- elevated floors: balcony slabs (stairwell holes), chem, bridge ----
  const slabHole = (x0, x1, z0, z1, hx0, hx1, hz0, hz1, y) => {
    pushBox(solidGeos.plate, (x0 + hx0) / 2, y, (z0 + z1) / 2, hx0 - x0, 0.25, z1 - z0);
    pushBox(solidGeos.plate, (hx1 + x1) / 2, y, (z0 + z1) / 2, x1 - hx1, 0.25, z1 - z0);
    pushBox(solidGeos.plate, (hx0 + hx1) / 2, y, (z0 + hz0) / 2, hx1 - hx0, 0.25, hz0 - z0);
    pushBox(solidGeos.plate, (hx0 + hx1) / 2, y, (hz1 + z1) / 2, hx1 - hx0, 0.25, z1 - hz1);
  };
  slabHole(-14, -6, -22, -8, -13.2, -8.8, -13.2, -10.8, 2.775);   // lab balcony
  slabHole(6, 14, -22, -8, 8.8, 13.2, -13.2, -10.8, 2.775);       // garage balcony
  pushBox(solidGeos.plate, 17, 2.775, -30, 14, 0.25, 16);          // chem testing floor
  pushBox(solidGeos.plate, 0, 2.775, -12, 12, 0.25, 2.2);          // bridge deck
  colliders.push({ minX: -6, maxX: 6, minZ: -13, maxZ: -11, y0: 2.65, h: 0.25, prop: true }); // bridge underside
  // The bridge is now a true upper connector. Continuous rails close the old
  // fall-through mouths into the purposeless underbridge pocket; players enter
  // through the two deliberate balcony doors at its east and west ends.
  {
    const railMat = matMetal.clone();
    for (const rz of [-12.95, -11.05]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 0.05), railMat);
      rail.position.set(0, 3.85, rz);
      const railMid = rail.clone(); railMid.position.y = 3.4;
      group.add(rail, railMid);
      colliders.push({
        minX: -6, maxX: 6,
        minZ: rz - 0.08, maxZ: rz + 0.08,
        y0: 2.9, h: 1.1, prop: true,
      });
      for (const x of [-5.8, -3.7, -1.25, 1.25, 3.7, 5.8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.05), railMat);
        post.position.set(x, 3.4, rz);
        group.add(post);
      }
    }
  }
  // mainframe platform steps (visual) + the actual raised platform deck
  // (narrower than the wall span: the two 750 doorways at x=±8 stay at ground level)
  pushBox(solidGeos.concrete, 0, 0.45, 16.25, 12, 0.9, 4.5);    // the spawn platform (visible!)
  pushBox(solidGeos.concrete, 0, 0.3, 19.2, 12, 0.6, 1.1);
  pushBox(solidGeos.concrete, 0, 0.15, 20.4, 12, 0.3, 1.1);
  // Step nosings. Each riser faces south, away from the moon, so it renders at
  // roughly half the luminance of the treads either side of it (measured 31 vs
  // 65). Three of those, each spanning the full 12m and perfectly straight,
  // stack up into what reads as black bars painted across the screen rather
  // than as steps — this is the first thing every player sees at spawn.
  //
  // A nosing lip fixes it the way real architecture does: the lip's top face
  // is UPWARD, so it catches the sky and draws a bright line along each step
  // edge, breaking the dark band and giving the eye the cue that this is a
  // stair. Purely visual — the colliders and floorY ramp are untouched.
  //
  // The lip stands 4mm PROUD of the tread. Flush with it, its top face and the
  // concrete's top face were the same plane over 12m x 0.16m, and the depth
  // buffer picked a winner per pixel per frame — so the nosing meant to break
  // up the dark band drew its own hard line across all three steps instead. A
  // real nosing stands proud anyway.
  for (const [ny, nz] of [[0.9, 18.55], [0.6, 18.68], [0.3, 19.79]]) {
    pushBox(solidGeos.plate, 0, ny - 0.021, nz, 12, 0.05, 0.16);
  }
  // The platform sides are intentionally open. floorY() drops a player cleanly
  // to the surrounding courtyard when they run or jump over an edge. One-way
  // fascia colliders still stop a ground-level player walking through the slab.
  // Match each fascia collider to the actual deck/step height. Previously the
  // full stair run inherited the 0.9m deck wall, so only the top stair could
  // be jumped off. Each step now remains solid from ground level while its own
  // ledge can be deliberately jumped or vaulted in either direction.
  for (const [ex0, ez0, ex1, ez1, h, deckTop] of [
    // Tall player-only side volumes keep a lower-tier jump from clearing the
    // collision test at its apex; oneWayDeckTop still releases outward travel
    // for players who actually launched from the 0.9m deck.
    [-6.12, 14, -6, 18.5, 2.2, MAINFRAME_PLATFORM.y],
    [6, 14, 6.12, 18.5, 2.2, MAINFRAME_PLATFORM.y],
    [-6.12, 18.5, -6, 19.75, 0.65],
    [6, 18.5, 6.12, 19.75, 0.65],
  ]) colliders.push({
    minX: ex0, maxX: ex1, minZ: ez0, maxZ: ez1,
    y0: 0, h, playerOnly: true, oneWayPlatformSide: true,
    ...(Number.isFinite(deckTop) ? { oneWayDeckTop: deckTop } : {}),
  });
  // The lowest 0.3m step is deliberately a true step: it has no vertical side
  // collider, so players can run onto it from the front, sides, or diagonals.

  // Close in a stair flight that climbs along X. The geometry itself lives in
  // map-layout.js (Three-free) so scripts/validate-movement-feel.mjs can walk a
  // real player circle up a real flight instead of asserting on source text.
  const encloseStairFlight = (flight) => colliders.push(
    ...stairFlightColliders({ ...flight, playerRadius: CFG.PLAYER_RADIUS }),
  );

  // Balcony flight treads. The movement scaffolding around them is `bulletPass`
  // (see stairFlightColliders) precisely because it is invisible, so the treads
  // have to carry the flight's bullet collision themselves: without this a shot
  // would pass through the visible plates as well as the open air around them.
  // `shootOk` is the bullet-only tier — players, zombies and the navmesh all
  // ignore it, which is right, because the plates are drawn geometry the
  // scaffolding already handles physically.
  const stairTread = (cx, cy) => colliders.push({
    minX: cx - 0.275, maxX: cx + 0.275, minZ: -13.1, maxZ: -10.9,
    y0: cy - 0.18, h: 0.36, shootOk: true,
  });
  for (let i = 0; i < 8; i++) {
    pushBox(solidGeos.plate, -12.9 + i * 0.55, 0.18 + i * 0.35, -12, 0.55, 0.36, 2.2);
    stairTread(-12.9 + i * 0.55, 0.18 + i * 0.35);
  }
  for (let i = 0; i < 8; i++) {
    pushBox(solidGeos.plate, 12.9 - i * 0.55, 0.18 + i * 0.35, -12, 0.55, 0.36, 2.2);
    stairTread(12.9 - i * 0.55, 0.18 + i * 0.35);
  }
  // Both balcony flights sit in a hole in the slab and had no colliders at
  // all: you could walk in from either side or from under the landing and end
  // up inside the staircase. Their treads span x -13.175..-8.775 (mirrored for
  // the garage) and z -13.1..-10.9, climbing 2.9m in 8 steps.
  encloseStairFlight({ xLow: -13.175, xHigh: -8.775, zMin: -13.1, zMax: -10.9, yTop: 2.9, steps: 8, closeHighEnd: true });
  encloseStairFlight({ xLow: 13.175, xHigh: 8.775, zMin: -13.1, zMax: -10.9, yTop: 2.9, steps: 8, closeHighEnd: true });
  // balcony drop ledge trims (reads as an opening you can drop from)
  pushBox(solidGeos.plate, -10, 2.95, -22, 2.2, 0.1, 0.5);
  pushBox(solidGeos.plate, 8, 2.95, -22, 2.2, 0.1, 0.5);
  pushBox(solidGeos.plate, 10, 2.95, -30, 0.5, 0.1, 2.4); // Chemical Testing -> courtyard escape

  // ---------- doors ----------
  const doorDefs = MAP_DOOR_DEFS;
  for (const dd of doorDefs) {
    const w = dd.w || 1.9;
    const dy = dd.y || 0; // elevated doors sit on their floor, not at ground level
    const isHoriz = !dd.vert;
    // Riveted steel blast door in a channel-iron jamb (js/props/door.js): a
    // chained, padlocked leaf with a barred vision slit and an enamel cost
    // plate on both faces. Deliberately non-neon so the factory stays a factory.
    const mesh = buildDoorLeaf(w, dd.cost);
    if (!isHoriz) mesh.rotation.y = Math.PI / 2;
    mesh.position.set(dd.x, dy + 1.5, dd.z);
    const frame = buildDoorFrame(w, isHoriz);
    frame.position.set(dd.x, dy, dd.z);
    group.add(frame);
    const doorLamp = buildDoorLamp();
    doorLamp.group.position.set(dd.x, dy + 2.80, dd.z);
    if (!isHoriz) doorLamp.group.rotation.y = Math.PI / 2;
    group.add(doorLamp.group);
    const practical = new THREE.PointLight(0xe0ae67, 0.42, 4.2, 2);
    practical.position.set(dd.x, dy + 2.74, dd.z);
    group.add(practical);
    group.add(mesh);
    const col = { minX: dd.x - (isHoriz ? w / 2 : 0.12), maxX: dd.x + (isHoriz ? w / 2 : 0.12), minZ: dd.z - (isHoriz ? 0.12 : w / 2), maxZ: dd.z + (isHoriz ? 0.12 : w / 2), y0: dy, h: 3, door: dd.id };
    const door = { ...dd, open: false, mesh, collider: col, animT: 0, baseY: dy + 1.5 };
    if (dd.preOpen) {
      door.open = true; door.animT = 1; mesh.visible = false; // open balcony drops
    } else {
      colliders.push(col);
      if (dd.auto) {
        // power-sealed door: hazard bolt marker, opens with the power switch
        const hzTex = textTexture('⚡', { w: 128, h: 64, bg: '#171412', fg: '#ffd24a', font: 'bold 40px Georgia, serif' });
        for (const s of [0, Math.PI]) {
          const hz = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: hzTex, transparent: true }));
          hz.position.set(dd.x + (isHoriz ? 0 : 0.11), dy + 3.3, dd.z + (isHoriz ? 0.11 : 0));
          hz.rotation.y = s + (isHoriz ? 0 : Math.PI / 2);
          group.add(hz);
        }
      } else {
        interact.push({ id: dd.id, kind: 'door', pos: { x: dd.x, y: dy + 1.4, z: dd.z }, radius: 2.4, door });
      }
    }
    doors.push(door);
  }

  // ---------- navigation (doors + stair/drop nav links) ----------
  // stair links work both ways; drop links are one-way (ledge drops)
  const navLinks = MAP_NAV_LINKS;
  const egressAudit = auditMapEgress({ rooms, doors: doorDefs, navLinks, ramps });
  if (!egressAudit.ok) throw new Error(`Map egress invariant failed: ${egressAudit.issues.join('; ')}`);
  function findPath(fromRoom, toRoom) {
    if (fromRoom === toRoom) return [];
    const edges = [];
    for (const d of doors) {
      if (!d.open) continue;
      edges.push({ a: d.rooms[0], b: d.rooms[1], x: d.x, z: d.z });
      edges.push({ a: d.rooms[1], b: d.rooms[0], x: d.x, z: d.z });
    }
    for (const l of navLinks) edges.push({ a: l.from, b: l.to, x: l.x, z: l.z });
    const prev = new Map([[fromRoom, null]]);
    const q = [fromRoom];
    while (q.length) {
      const cur = q.shift();
      if (cur === toRoom) break;
      for (const e of edges) {
        if (e.a !== cur) continue;
        if (!prev.has(e.b)) { prev.set(e.b, e); q.push(e.b); }
      }
    }
    if (!prev.has(toRoom)) return null;
    const path = [];
    let cur = toRoom;
    while (cur !== fromRoom) {
      const e = prev.get(cur);
      path.unshift({ x: e.x, z: e.z, door: e.door });
      cur = e.a;
    }
    return path;
  }

  // ---------- props ----------
  function crate(x, z, s = 1) {
    pushBox(solidGeos.wood, x, s / 2, z, s, s, s, rand(-0.2, 0.2));
    colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, y0: 0, h: s, prop: true });
  }
  function barrel(x, z, fire = false) {
    pushBox(solidGeos.metal, x, 0.55, z, 0.7, 1.1, 0.7);
    colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35, y0: 0, h: 1.1, prop: true });
    if (fire) fires.push({ x, y: 1.15, z, light: null, t: rand(10) });
  }
  function sandbags(x, z, w, ry = 0) {
    pushBox(solidGeos.dark, x, 0.35, z, w, 0.7, 0.9, ry);
    pushBox(solidGeos.dark, x, 0.85, z, w * 0.8, 0.35, 0.7, ry);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - 0.5, maxZ: z + 0.5, y0: 0, h: 1.0, prop: true });
  }
  function machine(x, z, ry = 0) {
    pushBox(solidGeos.metal, x, 0.7, z, 2.2, 1.4, 1.1, ry);
    pushBox(solidGeos.metal, x, 1.55, z, 1.4, 0.35, 0.7, ry);
    colliders.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - 0.6, maxZ: z + 0.6, y0: 0, h: 1.7, prop: true });
  }
  // animal cage (steel frame + bars)
  function cage(x, z, ry = 0) {
    const frame = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.7 });
    const cg = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.8), frame); top.position.y = 0.88;
    const bot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.8), frame); bot.position.y = 0.08;
    cg.add(top, bot);
    for (let i = 0; i < 7; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 4), frame);
      bar.position.set(-0.5 + i * 0.167, 0.48, 0.38);
      const bar2 = bar.clone(); bar2.position.z = -0.38;
      cg.add(bar, bar2);
    }
    for (const sx of [-0.52, 0.52]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.84, 0.05), frame);
      post.position.set(sx, 0.48, 0.37);
      const post2 = post.clone(); post2.position.z = -0.37;
      cg.add(post, post2);
    }
    cg.position.set(x, 0, z); cg.rotation.y = ry;
    group.add(cg);
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.45, maxZ: z + 0.45, y0: 0, h: 0.95, prop: true });
  }
  // big chemical vat with glowing sight-glass
  function chemVat(x, z, baseY = 0) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 2.6, 16), matMetal.clone());
    body.position.set(x, baseY + 1.3, z); body.castShadow = true;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 0.5, 16), matMetal.clone());
    lid.position.set(x, baseY + 2.85, z);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a1a10, emissive: 0x2aff70, emissiveIntensity: 0.9, roughness: 0.2 }));
    glass.position.set(x + 1.15, baseY + 1.3, z);
    group.add(body, lid, glass);
    colliders.push({ minX: x - 1.2, maxX: x + 1.2, minZ: z - 1.2, maxZ: z + 1.2, y0: baseY, h: 2.9, prop: true });
  }
  // the courtyard generator (power switch hides on its far side)
  function bigGenerator(x, z) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.7, 1.8), matMetal.clone());
    base.position.set(x, 0.85, z); base.castShadow = true;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 18), matPlate.clone());
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x - 1.9, 1.0, z);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.2, 10), matMetal.clone());
    stack.position.set(x + 1.2, 2.6, z);
    const hum = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.9), matDark);
    hum.position.set(x + 0.6, 1.95, z);
    group.add(base, wheel, stack, hum);
    colliders.push({ minX: x - 1.8, maxX: x + 1.8, minZ: z - 1.0, maxZ: z + 1.0, y0: 0, h: 2.2, prop: true });
  }

  // Mainframe courtyard: keep Pack-a-Punch and both 750-point approaches
  // unobstructed. The paired boxes at (8,24)/(8.7,24) and the barrel directly
  // behind d_mainR were removed; none communicated gameplay and all narrowed
  // this primary route.
  sandbags(-5, 15.2, 3);
  {
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1c140d, roughness: 1 });
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 3.6, 7), treeMat);
    trunk.position.y = 1.8; trunk.rotation.z = 0.08; trunk.castShadow = true;
    tree.add(trunk);
    const branch = (x, y, z, len, rz, rx, r = 0.06) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r, len, 5), treeMat);
      b.position.set(x, y, z); b.rotation.set(rx, 0, rz); b.castShadow = true;
      tree.add(b);
    };
    branch(0.5, 3.6, 0, 1.6, -0.9, 0.2);
    branch(-0.55, 3.4, 0.1, 1.4, 0.85, -0.3);
    branch(0.15, 4.1, -0.3, 1.2, -0.25, 0.8, 0.05);
    branch(1.1, 4.3, 0.25, 0.9, -1.3, 0.4, 0.035);
    branch(-1.1, 4.0, 0.2, 0.8, 1.25, -0.5, 0.035);
    tree.position.set(7.4, 0, 20.5);
    group.add(tree);
    colliders.push({ minX: 7.1, maxX: 7.7, minZ: 20.2, maxZ: 20.8, y0: 0, h: 2.5, prop: true });
  }
  // rubble in the courtyard corners
  for (const [rx, rz] of [[-14.5, -24], [8, -40.5], [-13, -40]]) {
    for (let i = 0; i < 5; i++) {
      pushBox(solidGeos.concrete, rx + rand(-0.7, 0.7), rand(0.06, 0.22), rz + rand(-0.7, 0.7), rand(0.25, 0.7), rand(0.12, 0.45), rand(0.25, 0.7), rand(0, 3));
    }
  }
  // left corridor: pipes + junk
  machine(-12.5, 6, Math.PI / 2); barrel(-7, 12.5); crate(-12.8, -4, 0.9);
  // garage entrance: tires + crates
  {
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
    // The old (12.6, 12.4) stack occupied Speed Cola's only approach lane.
    for (const [tx, tz, n] of [[7.4, -5.2, 2]]) {
      for (let i = 0; i < n; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.14, 8, 16), tireMat);
        t.position.set(tx + rand(-0.1, 0.1), 0.16 + i * 0.3, tz + rand(-0.1, 0.1));
        t.rotation.x = Math.PI / 2;
        group.add(t);
      }
      colliders.push({ minX: tx - 0.45, maxX: tx + 0.45, minZ: tz - 0.45, maxZ: tz + 0.45, y0: 0, h: 0.9, prop: true });
    }
  }
  crate(7.4, 12.6, 1); barrel(12.8, -5.4);
  // animal testing lab: cages, table, shelves
  cage(-28, -8.2, 0.1); cage(-26.4, -8.4, -0.12); cage(-27.2, -9.6, 0.05); cage(-18, -18.8, Math.PI / 2);
  {
    const tableMat = matMetal.clone();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.9), tableMat);
    top.position.set(-22, 0.82, -13); top.castShadow = true;
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.8), tableMat); l1.position.set(-22.9, 0.4, -13);
    const l2 = l1.clone(); l2.position.x = -21.1;
    group.add(top, l1, l2);
    colliders.push({ minX: -23, maxX: -21, minZ: -13.5, maxZ: -12.5, y0: 0, h: 0.85, prop: true });
  }
  crate(-30.5, -18.5, 1); barrel(-15.2, -7.2);
  // generator room: generators + teleporter A
  machine(-41.5, -8.5); machine(-41.5, -17.5); barrel(-33.2, -18.8);
  // auto garage: car wreck + furnace
  {
    const carMat = pbr('rust', 1.2, 1.2, { metalness: 0.35 });
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 1.9), carMat);
    carBody.position.set(23, 0.55, -10.5); carBody.rotation.y = 0.18; carBody.rotation.z = 0.03;
    const carCab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 1.7), carMat);
    carCab.position.set(22.6, 1.4, -10.5); carCab.rotation.y = 0.18;
    group.add(carBody, carCab);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
    for (const [wx, wz] of [[21.5, -11.4], [21.5, -9.5], [24.5, -11.4], [24.5, -9.5]]) {
      const wh = new THREE.Mesh(wheelGeo, wheelMat);
      wh.position.set(wx, 0.42, wz); wh.rotation.x = Math.PI / 2; wh.rotation.y = 0.18;
      group.add(wh);
    }
    colliders.push({ minX: 20.7, maxX: 25.3, minZ: -11.6, maxZ: -9.4, y0: 0, h: 1.6, prop: true });
  }
  pushBox(solidGeos.brick, 29, 1.6, -18.6, 3.4, 3.2, 1.8);
  pushBox(solidGeos.brick, 29, 3.9, -19.1, 1.2, 2.2, 1.0);
  colliders.push({ minX: 27.3, maxX: 30.7, minZ: -19.5, maxZ: -17.7, y0: 0, h: 3.2, prop: true });
  {
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshStandardMaterial({ color: 0x1a0c06, emissive: 0xff5511, emissiveIntensity: 1.5 }));
    mouth.position.set(29, 0.95, -17.68);
    group.add(mouth);
    fires.push({ x: 29, y: 1.0, z: -17.6, light: null, t: 3 });
  }
  machine(16.5, -18, 0); crate(30.5, -7.5, 0.9);
  // balconies: military clutter. The old right-side sandbag stack at
  // (8, -20.8) sat directly in the Double Tap courtyard-door approach and
  // looked like a second blockade after the paid route was added.
  // Three props used to stand in the corridor at the foot of the balcony
  // stairs: crate(12.8, -9.6) against the east wall in the run-up to the garage
  // flight, and machine(7, -9.4) / crate(-7, -9.5) directly across the hallway
  // from each stair mouth. Together they pinched both corridors to a chicane at
  // the one point you most want to be running. The band across each corridor in
  // front of its flight is now a declared traversal zone (labStairsMouth,
  // garageStairsMouth), so nothing can be put back there.
  sandbags(-8, -20.8, 2.6); barrel(-13, -20.8);
  // chem testing: vats + desks
  const chemFloorY = 2.9;
  chemVat(14, -34.5, chemFloorY); chemVat(20, -34.5, chemFloorY);
  {
    const deskMat = matWood.clone();
    for (const [dx, dz, ry] of [[13, -24, 0.1], [21, -24.2, -0.15]]) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.9), deskMat);
      top.position.set(dx, chemFloorY + 0.78, dz); top.rotation.y = ry;
      const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.85), deskMat);
      l1.position.set(dx - 0.8, chemFloorY + 0.38, dz); l1.rotation.y = ry;
      const l2 = l1.clone(); l2.position.x = dx + 0.8;
      group.add(top, l1, l2);
      colliders.push({ minX: dx - 0.9, maxX: dx + 0.9, minZ: dz - 0.5, maxZ: dz + 0.5, y0: chemFloorY, h: 0.8, prop: true });
    }
  }
  // courtyard: generator + switch, fire barrel, sandbags
  // Offset laterally from the power switch at (-4, -27.6) rather than sitting
  // squarely in front of it. The switch is meant to read as belonging to this
  // generator, but at dead centre the 2.2m hull hid the knife blades and the
  // enamel plate completely from the courtyard approach — you walked up to a
  // machine you could not see.
  bigGenerator(-7.2, -26);
  barrel(7.5, -39.5, true);
  sandbags(-14, -34, 3, Math.PI / 2);
  // factory: machines, crates, catwalk, chains, pipes
  machine(-10, -46); machine(10, -46); machine(0, -58, Math.PI / 2); machine(-6, -54, 0.3);
  crate(-12, -43.5, 1.1); crate(11.5, -60.5, 1); barrel(-12.5, -60.5, true); sandbags(6, -43.4, 3);
  {
    // catwalk across the hall (visual landmark, like the original bridge)
    const cwY = FACTORY_CATWALK.y, cwZ = (FACTORY_CATWALK.minZ + FACTORY_CATWALK.maxZ) / 2;
    const cwWidth = FACTORY_CATWALK.maxX - FACTORY_CATWALK.minX;
    const cwCenterX = (FACTORY_CATWALK.minX + FACTORY_CATWALK.maxX) / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(cwWidth, 0.12, FACTORY_CATWALK.maxZ - FACTORY_CATWALK.minZ), matPlate);
    deck.position.set(cwCenterX, cwY, cwZ); deck.castShadow = true; deck.receiveShadow = true;
    group.add(deck);
    // The long edges are a KNEE-HIGH trip rail, not a handrail. A jump clears
    // CFG.JUMP_VEL^2 / 2*GRAVITY = 0.78m of feet travel, so at the old
    // chest-high 1.05m the rail read as a wall you were being asked to hop —
    // the vault colliders below let you through, but nothing you could see
    // said you were allowed to. RAIL_TOP sits comfortably under the apex so
    // the geometry itself tells you the sides are an exit.
    const RAIL_TOP = 0.6;
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(cwWidth, 0.05, 0.05), matMetal.clone());
      rail.position.set(cwCenterX, cwY + RAIL_TOP, cwZ + side * 1.05);
      const railMid = rail.clone(); railMid.position.y = cwY + 0.26;
      group.add(rail, railMid);
      for (let i = FACTORY_CATWALK.minX + 0.4; i <= FACTORY_CATWALK.maxX - 0.4; i += 2.4) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, RAIL_TOP, 0.05), matMetal.clone());
        post.position.set(i, cwY + RAIL_TOP / 2, cwZ + side * 1.05);
        group.add(post);
      }
    }
    // Support columns. The westmost used to stand at x=-8, which is only 0.4m
    // past the stair landing: its collider top is the deck height, so it went
    // inert only once your feet were already above 3.1m, and the last 12cm of
    // the ramp (x -8.55..-8.43) is still below that. Walking up the middle of
    // the flight you hit an invisible post one step from the top and had to
    // jump to finish the climb. Keep the columns clear of the stair approach.
    for (const px of [-7, 0, 8]) {
      const col2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, cwY, 0.35), matMetal.clone());
      col2.position.set(px, cwY / 2, cwZ);
      group.add(col2);
      // The columns holding the catwalk up are real posts on the factory
      // floor, not scenery to walk through. The collider stops just under the
      // deck so standing on the deck can never re-activate it on a rounding
      // error — the mesh still meets the underside.
      colliders.push({
        minX: px - 0.2, maxX: px + 0.2,
        minZ: cwZ - 0.2, maxZ: cwZ + 0.2,
        y0: 0, h: cwY - 0.06, prop: true,
      });
    }
    // stair flight up to the catwalk (west end) — wide, clear runway
    // Treads span the catwalkStairs ramp exactly: 9 steps from x -12.6 to -8.4
    // (4.2m) rising 3.1m. Keep these in step with the ramp in map-layout.js —
    // the ramp is what the player actually walks on, these are what they see.
    const STEP_N = 9, STEP_W = 4.2 / STEP_N, STEP_H = 3.1 / STEP_N;
    for (let i = 0; i < STEP_N; i++) {
      pushBox(solidGeos.plate, -12.6 + STEP_W * (i + 0.5), STEP_H * (i + 0.5), cwZ, STEP_W, STEP_H, 2.6);
    }
    // Close the flight's two long sides. The steps themselves are only visual
    // geometry — height comes from the `catwalkStairs` ramp in floorY, and that
    // ramp accepts anyone standing within 1.6m of the tread. So without these,
    // walking at the STAIRCASE SIDE from the factory floor silently lifted you
    // up to three metres onto the middle of the flight, straight through the
    // stringer. No high-end wall: this flight tops out onto the catwalk deck,
    // and the floor under that deck is real factory floor you walk through.
    encloseStairFlight({
      xLow: -12.6, xHigh: -8.4, zMin: cwZ - 1.3, zMax: cwZ + 1.3,
      yTop: FACTORY_CATWALK.y, steps: STEP_N,
    });
    // Catwalk gates. The two long edges are vault colliders: solid to anyone
    // standing on the deck (and to zombies, which never check the flag — they
    // still have to take the stairs), inert the instant you leave the ground.
    // That is the whole escape route off this deck, so the sides carry NO
    // second always-on collider — one used to sit here alongside them and it
    // quietly made the rail unjumpable in both directions.
    //
    // The heights match the meshes above so the collision agrees with what the
    // player is looking at.
    colliders.push({ minX: FACTORY_CATWALK.minX, maxX: FACTORY_CATWALK.maxX, minZ: cwZ - 1.18, maxZ: cwZ - 1.02, y0: 3.1, h: RAIL_TOP, prop: true, vault: true, keepClearExempt: true });
    colliders.push({ minX: FACTORY_CATWALK.minX, maxX: FACTORY_CATWALK.maxX, minZ: cwZ + 1.02, maxZ: cwZ + 1.18, y0: 3.1, h: RAIL_TOP, prop: true, vault: true, keepClearExempt: true });
    // The east end is the opposite: a hard backstop. Past x=12 the deck simply
    // stops, with a two-metre drop to the factory floor before the east wall —
    // and this is the corner you retreat into when the box lands up here, so
    // backing into it while shooting must never dump you off the edge. No
    // `vault`, and tall enough (top 4.2m) that the collider is still active at
    // the 0.78m apex of a jump, so it cannot be cleared from the deck either.
    colliders.push({ minX: 11.9, maxX: 12.06, minZ: cwZ - 1.1, maxZ: cwZ + 1.1, y0: 3.1, h: 1.1, prop: true, keepClearExempt: true });
    {
      // …and it needs to be VISIBLE, or it is an invisible wall. A solid plate
      // panel, chest high — deliberately taller than the knee-high side rails,
      // so one look tells you which edges you may leave by and which you can
      // plant your back against.
      const gate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.06, 2.2), matPlate);
      gate.position.set(11.95, cwY + 0.53, cwZ);
      gate.castShadow = true; gate.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 2.24), matMetal.clone());
      cap.position.set(11.95, cwY + 1.09, cwZ);
      group.add(gate, cap);
      for (const side of [-1, 1]) {
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.12, 0.1), matMetal.clone());
        stile.position.set(11.95, cwY + 0.56, cwZ + side * 1.05);
        group.add(stile);
      }
    }
    // hanging chains + hooks
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.8 });
    for (const [cx, cz, len] of [[-5, -48, 1.6], [4, -50, 2.2], [-2, -56, 1.2], [7, -58, 1.9], [-8, -55, 1.5]]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 5), chainMat);
      chain.position.set(cx, HH - len / 2, cz);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 10, Math.PI * 1.4), chainMat);
      hook.position.set(cx, HH - len - 0.08, cz);
      hook.rotation.z = Math.PI * 0.8;
      group.add(chain, hook);
    }
    // wall pipes + valves
    const pipeMat = matMetal.clone();
    for (const px of [-13.6, 13.6]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 16, 8), pipeMat);
      pipe.rotation.x = Math.PI / 2; pipe.position.set(px, 3.4, -52);
      group.add(pipe);
      for (const vz of [-48, -56]) {
        const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8), pipeMat);
        drop.position.set(px, 2.1, vz);
        const valve = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 12), new THREE.MeshStandardMaterial({ color: 0x7a2020, roughness: 0.5, metalness: 0.4 }));
        valve.position.set(px + (px < 0 ? 0.14 : -0.14), 1.6, vz);
        valve.rotation.y = Math.PI / 2;
        group.add(drop, valve);
      }
    }
    // roof beams
    for (let i = 0; i < 4; i++) pushBox(solidGeos.metal, 0, HH - 0.5, -45 - i * 5, 27.5, 0.3, 0.5);
  }

  // ---------- telephone poles + sagging wires (exterior silhouettes) ----------
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 1 });
  const wireMat = new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.9 });
  const poleTops = [];
  // Keep utility silhouettes deeper in the map; the two poles immediately
  // behind the spawn platform were visual clutter in the player's first view.
  const poleDefs = [[-20, -3.5], [20, -3.5], [-19, -33], [13, -44.5]];
  for (const [px, pz] of poleDefs) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7.5, 7), poleMat);
    pole.position.set(px, 3.75, pz);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), poleMat);
    cross.position.set(px, 6.9, pz);
    group.add(pole, cross);
    poleTops.push([px, 6.9, pz]);
  }
  for (const [a, b] of [[0, 1], [0, 2], [1, 3]]) {
    const [x1, y1, z1] = poleTops[a], [x2, y2, z2] = poleTops[b];
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * 0.9, z1 + (z2 - z1) * t));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    const pts2 = pts.map((p) => new THREE.Vector3(p.x + 0.25, p.y - 0.15, p.z));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), wireMat));
  }
  // sagging wires across the mainframe courtyard
  for (const [wz, sag] of [[17, 0.7], [21, 0.9], [24.5, 0.6]]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new THREE.Vector3(-10 + 20 * t, H + 0.4 - Math.sin(t * Math.PI) * sag, wz + Math.sin(t * Math.PI) * 0.3));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }
  // wires across the factory courtyard
  for (const [wz, sag] of [[-26, 0.8], [-33, 0.65], [-39, 0.9]]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new THREE.Vector3(-16 + 26 * t, H + 1.2 - Math.sin(t * Math.PI) * sag, wz + Math.sin(t * Math.PI) * 0.4));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }

  // ---------- old blood on the floor ----------
  // Dried, not fresh: the same splat texture and the same near-black maroon the
  // FX pool stamps when something bleeds (js/fx.js `blood`), so the map's
  // standing blood and a kill from ten seconds ago are the same substance. The
  // CC0 Quaternius blood models used to sit here, but they were lit, glossy and
  // bright red, and read as a different fluid entirely from the fx decals
  // landing beside them.
  {
    const bloodSpots = [
      [0, 19, 1.4], [-6, 16, 1.0], [-10, 2, 1.5], [10, 5, 1.1],
      [-22, -13, 1.2], [17, -30, 1.6], [-4, -30, 1.0], [0, -50, 1.4],
      [22, -12, 1.2], [-38, -12, 1.0], [8, -14, 0.9],
    ];
    // A handful of shapes so eleven pools aren't eleven copies of one blot.
    const splats = [splatTexture(0), splatTexture(1), splatTexture(2), splatTexture(3)];
    const quad = new THREE.PlaneGeometry(1, 1);
    for (const [bx, bz, bs] of bloodSpots) {
      const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({
        map: choice(splats), color: BLOOD_DECAL_COLOR, transparent: true, opacity: 0.92,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rand(Math.PI * 2);
      m.position.set(bx, 0.018, bz);
      m.scale.setScalar(bs);
      m.renderOrder = 1;
      group.add(m);
    }
  }

  // ---------- wall buys (authentic placements & prices) ----------
  const wallbuys = [];
  function wallbuy(x, y, z, nx, nz, weapon, price) {
    // Chalked straight onto the brick, on a lit surface (js/props/wallbuy.js) —
    // it takes the sodium light and dies with the power instead of floating.
    // Label from the weapon's REAL display name, not its internal id. The id is
    // an abbreviation ("kar98", "trench", "dbshotgun") and uppercasing it chalked
    // "KAR98" on the wall for a Kar98k, and "TRENCH" for an M1897 Trench Gun.
    const m = buildWallBuy(weapon, price, (WEAPONS[weapon]?.name || weapon).toUpperCase());
    m.position.set(x + nx * 0.05, y + 1.55, z + nz * 0.05);
    m.lookAt(x + nx * 3, y + 1.55, z + nz * 3);
    group.add(m);
    const wb = { id: 'wb_' + weapon, weapon, price, pos: { x, y: y + 1.4, z } };
    wallbuys.push(wb);
    interact.push({ id: wb.id, kind: 'wallbuy', pos: wb.pos, radius: 2.2, wb });
  }
  for (const wb of MAP_WALLBUYS) wallbuy(wb.x, wb.y || 0, wb.z, wb.nx, wb.nz, wb.weapon, wb.price);

  // ---------- perk machines ----------
  // Period enamelled-steel dispensers (js/props/perkMachine.js): chipped paint,
  // a backlit marquee, real bottles behind a dirty pane, coin mech and tray.
  const perks = [];
  const perkDefs = MAP_PERKS;
  for (const pd of perkDefs) {
    // Solo Quick Revive is charged at 500 (game.js), so the cabinet has to say
    // 500 too — otherwise the marquee argues with the prompt in front of it.
    const displayPrice = (pd.id === 'qr' && opts.mode === 'solo') ? 500 : pd.price;
    const machine = buildPerkMachine(pd, { displayPrice });
    const g = machine.group;
    const lamp = machine.lamp;
    g.position.set(pd.x, 0, pd.z);
    g.rotation.y = pd.ry;
    group.add(g);
    const perk = { ...pd, group: g, lamp, panel: machine.panel, machine, jingleId: 'jingle_' + pd.id };
    perks.push(perk);
    colliders.push({ minX: pd.x - 0.6, maxX: pd.x + 0.6, minZ: pd.z - 0.5, maxZ: pd.z + 0.5, y0: 0, h: 2.4, prop: true });
    interact.push({ id: 'perk_' + pd.id, kind: 'perk', pos: { x: pd.x, y: 1.2, z: pd.z }, radius: 2.2, perk });
  }

  // ---------- power switch (behind the courtyard generator) ----------
  // Open-blade knife switch on a slate panel (js/props/powerSwitch.js). The
  // blade assembly keeps the old lever's pivot, so the reach target and the
  // cinematic throw animation are unchanged.
  const powerProp = buildPowerSwitch();
  const powerGroup = powerProp.group;
  const lever = powerProp.lever;
  powerGroup.position.set(-4, 0, -27.6);
  group.add(powerGroup);
  const power = { pos: { x: -4, y: 1.4, z: -27.6 }, on: false, lever, group: powerGroup };
  interact.push({ id: 'power', kind: 'power', pos: power.pos, radius: 2.6, power });

  // ---------- teleporters ----------
  const teleporters = [];
  for (const td of MAP_TELEPORTERS) {
    // Electromagnetic apparatus (js/props/teleporter.js): bolted collar with
    // hazard striping, a grated deck, coil-wound I-beam columns and cabling.
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x3366aa, emissiveIntensity: 0.15, roughness: 0.4, metalness: 0.6 });
    const g = buildTeleporter(td, ringMat).group;
    g.position.set(td.x, td.y, td.z);
    group.add(g);
    const tele = {
      ...td, group: g, ringMat, linked: false, charging: false, cooldown: 0,
      pos: { x: td.x, y: td.y + 1, z: td.z },
    };
    teleporters.push(tele);
    interact.push({ id: td.id, kind: 'tele', pos: tele.pos, radius: 1.9, tele });
  }
  // Mainframe teleport destination. Keep only the unmistakable destination
  // pad: the former blocky green machine bank looked like an unexplained box
  // and needlessly occupied the spawn platform.
  const mf = new THREE.Group();
  const mfPad = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 24), matMetal.clone());
  mfPad.position.set(0, 0.95, 17.5);
  mf.add(mfPad);
  group.add(mf);
  const mainframe = { x: 0, z: 17.5 };

  // ---------- pack-a-punch (at the mainframe, like the original) ----------
  const papG = new THREE.Group();
  // Cast-iron cabinet, riveted columns, brass gear, vacuum tubes and a caged
  // intake collar (js/props/packAPunch.js). The collar projects forward of the
  // face so the containment field lives inside a mouth behind bars.
  const papMachine = buildPackAPunch();
  const papBody = papMachine.group;
  // Containment haze filling the intake collar around the field. Its emissive
  // is the machine's state read-out, driven by the tick below.
  const papSlot = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.56, 0.22), new THREE.MeshStandardMaterial({
    color: 0x09060e, emissive: 0x6644aa, emissiveIntensity: 0.5,
    transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
  }));
  papSlot.position.set(0, 1.0, 0.5);
  // Lightweight dark-matter/electric field: low-poly meshes and static line
  // buffers animated in the existing map tick (no post-processing or shaders).
  const papEnergy = new THREE.Group();
  papEnergy.position.set(0, PAP_ENERGY_VISUAL.centerY, PAP_ENERGY_VISUAL.centerZ);
  const papCoreMat = new THREE.MeshStandardMaterial({ color: 0x07030d, emissive: 0x6e22aa, emissiveIntensity: 1.35, roughness: 0.18, metalness: 0.5 });
  const papCore = new THREE.Mesh(new THREE.SphereGeometry(PAP_ENERGY_VISUAL.coreRadius, 12, 8), papCoreMat);
  papCore.position.z = PAP_ENERGY_VISUAL.coreOffsetZ;
  papEnergy.add(papCore);
  const papRingMat = new THREE.MeshBasicMaterial({ color: 0xb76cff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(PAP_ENERGY_VISUAL.ringRadii[i], PAP_ENERGY_VISUAL.ringTube, PAP_ENERGY_VISUAL.tubeSegments, PAP_ENERGY_VISUAL.ringSegments), papRingMat.clone());
    ring.rotation.set(i ? Math.PI / 2 : 0.35, i ? 0.4 : Math.PI / 2, 0);
    papEnergy.add(ring);
  }
  const papArcMat = new THREE.LineBasicMaterial({ color: 0x82c8ff, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let arc = 0; arc < PAP_ENERGY_VISUAL.arcCount; arc++) {
    const points = [];
    for (let i = 0; i < PAP_ENERGY_VISUAL.arcPoints; i++) {
      const t = i / (PAP_ENERGY_VISUAL.arcPoints - 1);
      points.push(new THREE.Vector3(
        -PAP_ENERGY_VISUAL.boltHalfWidth + t * PAP_ENERGY_VISUAL.boltHalfWidth * 2,
        Math.sin((t + arc * 0.17) * Math.PI * 3) * 0.04,
        PAP_ENERGY_VISUAL.boltDepth + (i % 2 ? 0.018 : -0.018) + arc * 0.006,
      ));
    }
    const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), papArcMat.clone());
    bolt.rotation.z = arc * Math.PI / PAP_ENERGY_VISUAL.arcCount;
    papEnergy.add(bolt);
  }
  // Enamel wall plate in a bracketed steel housing, not a floating decal.
  const papSignTex = papSignTexture('PACK-A-PUNCH');
  const papSignMat = new THREE.MeshStandardMaterial({
    map: papSignTex, emissiveMap: papSignTex, emissive: 0xffffff, emissiveIntensity: 0.42,
    color: 0x0d0c10, roughness: 0.46, metalness: 0.0,
  });
  const papSign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.4), papSignMat);
  papSign.position.set(0, 2.1, 0.5);
  const papSignFrame = buildPapSignFrame(2.2, 0.4);
  papSignFrame.position.set(0, 2.1, 0.49);
  // Field spill out of the intake mouth. It sits inside the collar so the light
  // reads as coming from the containment, not from a lamp bolted to the front.
  const papLamp = new THREE.PointLight(0x8a5cff, 18, 5.5, 2);
  papLamp.position.set(0, 1.0, 0.62);
  papG.add(papBody, papSlot, papEnergy, papSign, papSignFrame, papLamp);
  papG.position.set(4, 0.9, 14.7);
  group.add(papG);
  colliders.push({ minX: 3.1, maxX: 4.9, minZ: 14.25, maxZ: 15.15, y0: 0.9, h: 1.7, prop: true });
  const pap = {
    pos: { x: 4, y: 2.1, z: 14.7 }, slot: papSlot,
    energy: papEnergy, coreMat: papCoreMat, lamp: papLamp, machine: papMachine,
    busy: false, processing: false, ready: false,
  };
  interact.push({ id: 'pap', kind: 'pap', pos: pap.pos, radius: 2.6, pap });

  // ---------- mystery box (initial spawn: courtyard, in front of the generator) ----------
  const boxLocations = [
    { ...INITIAL_MYSTERY_BOX },    // courtyard (initial)
    { x: 28, z: -8 },             // automobile garage, near the furnace
    { x: 20.5, z: -25, y: 2.9 },  // chemical testing
    { x: -19, z: -18.7 },         // animal lab, across from the trench gun
    { x: -10, z: -19, y: 2.9 },   // lab balcony
    { x: 11, z: -52, y: 3.1 },    // main factory, end of the catwalk
  ];
  // Banded shipping crate + volumetric beacon (js/props/mysteryBox.js). The lid
  // pivots on its real hinge line at the back top edge.
  const boxProp = buildMysteryBox();
  const boxG = boxProp.group;
  const boxLid = boxProp.lid;
  boxG.position.set(boxLocations[0].x, boxLocations[0].y || 0, boxLocations[0].z);
  group.add(boxG);
  // baseYaw is set from the room below, once roomAt/rooms exist (see boxYawAt).
  const box = { group: boxG, lid: boxLid, locations: boxLocations, locIdx: 0, baseYaw: 0, pos: { x: boxLocations[0].x, y: 0.9 + (boxLocations[0].y || 0), z: boxLocations[0].z }, state: 'idle', uses: 0, currentWeapon: null, spinT: 0, takeT: 0 };
  interact.push({ id: 'box', kind: 'box', pos: box.pos, radius: 2.2, box });
  colliders.push({
    minX: boxLocations[0].x - 0.75, maxX: boxLocations[0].x + 0.75,
    minZ: boxLocations[0].z - 0.45, maxZ: boxLocations[0].z + 0.45,
    y0: boxLocations[0].y || 0, h: 0.9, prop: true, boxCollider: true,
  });

  // ---------- traps (electro-shock defenses at the debris chokepoints) ----------
  const traps = [];
  for (const [tx, tz, px] of [[-14, -12, -12.6], [14, -12, 15.4]]) {
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), matMetal.clone());
    post1.position.set(tx, 1.3, tz - 1.1);
    const post2 = post1.clone(); post2.position.z = tz + 1.1;
    group.add(post1, post2);
    const zone = { minX: tx - 1.4, maxX: tx + 1.4, minZ: tz - 1.2, maxZ: tz + 1.2 };
    const trap = { id: 'trap' + tx, zone, x: tx, z: tz, active: false, t: 0, cd: 0, panel: { x: px, y: 1.3, z: tz + 2.5 } };
    traps.push(trap);
    interact.push({ id: trap.id, kind: 'trap', pos: trap.panel, radius: 2.2, trap });
  }

  // ---------- gramophone switch (Beauty of Annihilation easter egg) ----------
  {
    const gg = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.4), matWood.clone());
    stand.position.y = 0.55;
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.28, 0.45, 14), new THREE.MeshStandardMaterial({ color: 0xc8a038, metalness: 0.85, roughness: 0.3 }));
    horn.position.set(0, 1.35, 0); horn.rotation.x = -0.6;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 18), new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.4 }));
    disc.position.y = 1.12;
    const glow = new THREE.PointLight(0xffb050, 7, 5, 1.8);
    glow.position.set(0, 1.5, 0.2);
    gg.add(stand, horn, disc, glow);
    gg.position.set(-6.5, 0, -41.2);
    group.add(gg);
    const songSwitch = { pos: { x: -6.5, y: 1.2, z: -41.2 }, glow, disc };
    interact.push({ id: 'song', kind: 'song', pos: songSwitch.pos, radius: 2.2, songSwitch });
    colliders.push({ minX: -6.8, maxX: -6.2, minZ: -41.5, maxZ: -40.9, y0: 0, h: 1.2, prop: true });
  }

  // ---------- radio (music easter egg) ----------
  const radioMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.25), matWood.clone());
  // Wall-mount it on a clear solid panel. It previously occupied the same
  // footprint as the stacked spawn crates at (8,24).
  radioMesh.position.set(-7.5, 1.05, 25.72);
  group.add(radioMesh);
  interact.push({ id: 'radio', kind: 'radio', pos: { x: -7.5, y: 1.1, z: 25.72 }, radius: 2.0 });

  // ---------- environment art: trim, clutter, practical lighting ----------
  // Solid props (crates, drums, machines, benches, sandbags) register real
  // colliders, so this must run BEFORE the clearance audits below — those are
  // what guarantee the dressing never walls off an interactable or a route.
  // Everything a player must reach or pass through is listed as keep-clear.
  const props = decorateMap(group, {
    materials: {
      metal: matMetal, wood: matWood, plate: matPlate,
      concrete: matConcrete, dark: matDark, brick: matBrick,
    },
    colliders,
    // Snapshot of the STRUCTURAL colliders only (walls, doors, platform edges)
    // taken before any prop registers its own. Dressing must prove it is
    // actually against one of these before it is placed, so nothing ends up
    // standing in an open doorway or a corridor mouth.
    wallColliders: colliders.filter((c) => !c.prop && !c.shootOk && (c.h === undefined || c.h > 1.2)).map((c) => ({
      minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ,
    })),
    keepClear: [
      // interactables need a standing approach on every side
      ...interact.map((i) => ({ x: i.pos.x, z: i.pos.z, r: (i.radius || 2) + 1.6 })),
      // doorways must stay walkable
      ...doors.map((d) => ({ x: d.x, z: d.z, r: 3.2 })),
      // window barriers are where zombies enter and players rebuild
      ...barriers.map((b) => ({ x: b.x, z: b.z, r: 2.8 })),
      // ground-spawn risers must stay open
      ...risers.map((r) => ({ x: r.x, z: r.z, r: 2.6 })),
      // wall-buys, perk machines, teleporters and the box need frontage
      ...wallbuys.map((w) => ({ x: w.x, z: w.z, r: 3.0 })),
      ...perks.map((k) => ({ x: k.x, z: k.z, r: 3.2 })),
      ...teleporters.map((t) => ({ x: t.x, z: t.z, r: 3.6 })),
      ...box.locations.map((l) => ({ x: l.x, z: l.z, r: 3.2 })),
      { x: mainframe.x, z: mainframe.z, r: 4.5 },
      { x: pap.x, z: pap.z, r: 4.0 },
      // player spawns
      { x: 0, z: 16, r: 4.5 },
    ],
  });

  // Build-time fail-fast audit over the actual generated colliders and every
  // current interaction position. This catches props that visually exist but
  // leave no legal standing point inside the gameplay use radius.
  const interactionApproachAudit = auditInteractableApproaches({ interactables: interact, colliders, roomAt, floorY });
  if (!interactionApproachAudit.ok) {
    throw new Error(`Interactable clearance invariant failed: ${interactionApproachAudit.issues.join('; ')}`);
  }
  const mainEntranceAudit = auditKeepClearZone(MAINFRAME_EAST_ENTRY_KEEP_CLEAR, colliders);
  if (!mainEntranceAudit.ok) {
    throw new Error(`Mainframe east entrance obstructed by ${mainEntranceAudit.blockers.length} prop collider(s)`);
  }
  // Stairs, their aprons, and the wall openings that are routes. Dressing avoids
  // these at placement time; this is what catches a hand-placed prop, since
  // those never went through the placer's clearance tests at all.
  const blockedRoutes = MAP_TRAVERSAL_ZONES
    .map((zone) => ({ zone, audit: auditKeepClearZone(zone, colliders) }))
    .filter(({ audit }) => !audit.ok);
  if (blockedRoutes.length) {
    throw new Error(`Traversal route obstructed: ${blockedRoutes
      .map(({ zone, audit }) => `${zone.id} (${audit.blockers.length} prop collider(s))`).join('; ')}`);
  }

  // ---------- risers (outdoor ground spawns) ----------
  function riser(x, z, room) {
    // A ground spawn is a broken slab, not a brown sticker. The old unlit
    // MeshBasicMaterial disc ignored every light in the scene and read as a
    // flat decal; this is lit geometry that sits in the world.
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1b1610'; g.fillRect(0, 0, 256, 256);
    // Radial cracks running out from the centre of the breach.
    g.strokeStyle = '#0a0806'; g.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const a = rand(Math.PI * 2);
      g.lineWidth = rand(1.5, 5);
      g.beginPath(); g.moveTo(128, 128);
      let px = 128, py = 128, ang = a;
      for (let seg = 0; seg < 5; seg++) {
        ang += rand(-0.5, 0.5);
        px += Math.cos(ang) * rand(12, 30); py += Math.sin(ang) * rand(12, 30);
        g.lineTo(px, py);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(9,7,5,0.85)';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rand(20, 236), rand(20, 236), rand(3, 16), 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;   // a ground decal is always seen at a glancing angle
    const riserMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.98, metalness: 0.0, color: 0x8a8a8a });
    const m = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), riserMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.022, z);
    m.receiveShadow = true;
    group.add(m);
    // Displaced slab fragments around the rim so it reads in silhouette.
    const chunkMat = matConcrete;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand(-0.25, 0.25);
      const d = rand(1.0, 1.45);
      const s = rand(0.16, 0.4);
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), chunkMat);
      chunk.position.set(x + Math.cos(a) * d, rand(0.03, 0.12), z + Math.sin(a) * d);
      chunk.rotation.set(rand(Math.PI), rand(Math.PI), rand(Math.PI));
      chunk.scale.y = rand(0.35, 0.7);
      chunk.castShadow = true; chunk.receiveShadow = true;
      group.add(chunk);
    }
    risers.push({ x, z, room });
  }
  riser(-3.5, 18, 'mainframe'); riser(3.5, 17.5, 'mainframe');
  riser(-10, -26, 'courtyard'); riser(5, -28, 'courtyard'); riser(-6, -36, 'courtyard'); riser(3, -40, 'courtyard');
  riser(-6, -50, 'factory'); riser(6, -54, 'factory');

  // ---------- atmosphere: drifting ground fog + skylight dust ----------
  const fogPlaneTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(180,195,220,0.045)');
    grad.addColorStop(0.6, 'rgba(160,175,205,0.022)');
    grad.addColorStop(1, 'rgba(150,165,195,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  const fogMat = new THREE.MeshBasicMaterial({ map: fogPlaneTex, transparent: true, depthWrite: false, fog: true });
  const fogPatches = [];
  // Raymarched volumetric fog in the post stack now carries the atmosphere.
  // These alpha planes remain only as a faint near-ground wisp layer.
  const fogSpots = [
    [0, 20, 16, 10], [-6, 16, 12, 8], [7, 23, 12, 8],           // mainframe courtyard
    [-8, -28, 16, 10], [4, -34, 16, 10], [-4, -40, 14, 9],      // factory courtyard
    [0, -52, 18, 10],                                            // factory floor
  ];
  // Intentionally not instantiated: the raymarched volumetric pass in the post
  // stack replaces these, and layering both produced visible banded planes.
  void fogSpots; void fogMat;
  // dust motes falling through the factory skylight
  const dustGeo = new THREE.BufferGeometry();
  const dustN = 90, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = rand(-8, 8); dustPos[i * 3 + 1] = rand(0.2, 6.8); dustPos[i * 3 + 2] = rand(-56, -48);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x9db4dd, size: 0.02, transparent: true, opacity: 0.55, sizeAttenuation: true }));
  group.add(dust);

  // ---------- sky ----------
  // Shader atmosphere: moon disc with limb darkening and halo, drifting
  // stratus, procedural stars, horizon haze. Also the source of the IBL bake.
  const sky = new Sky({
    moonDir: MOON_DIR.clone(),
    moonColor: 0xd6e4ff,
    moonSize: 0.0026,
    zenith: 0x040711,
    horizon: 0x1a2740,
    ground: 0x04060a,
    starDensity: 0.022,
    cloud: 0.5,
    skyExposure: 1.15,
  });
  group.add(sky.mesh);

  // ---------- lights (physical units: r160) ----------
  // Sky IBL replaces most of the old flat hemisphere fill; what remains is a
  // small bounce term so pure-shadow interiors never go fully black.
  // Sky IBL supplies the directional ambient; this is the bounce floor that
  // stops unlit interiors going to pure black with the power off.
  // The ground half of the hemisphere is BOUNCE, and it has to look like the
  // surface actually doing the bouncing. It was 0x171512 — near-black brown —
  // while every floor in the level is pale concrete, so any surface facing away
  // from the sky received almost nothing. On the spawn platform's steps that
  // turned each riser into a hard black band between two lit treads: measured
  // 16 luminance on the risers against 48 on the treads, which reads as
  // horizontal black lines painted across the screen rather than as steps.
  //
  // A neutral concrete bounce lifts exactly those crushed vertical and
  // downward faces and barely touches sky-facing surfaces, so overall exposure
  // is essentially unchanged.
  const hemi = new THREE.HemisphereLight(0x36496e, 0x3a3b3d, 3.6);
  group.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xa8c0f0, 2.6);
  moonLight.position.copy(MOON_DIR).multiplyScalar(90);
  moonLight.castShadow = true;
  group.add(moonLight, moonLight.target);
  moonLight.target.position.set(0, 0, -20);
  const sunShadow = new SunShadow(moonLight, { extent: 32, distance: 70, resolution: 2048 });

  // Room lamps (dim until power). Sodium practicals are the only warm source in
  // the map, so they carry the color contrast against the blue moonlight.
  const lamps = [];
  const lampDefs = [
    [-10, 3, 0xffb765], [10, 3, 0xffb765],           // corridors
    [-23, -13, 0xffb765], [23, -13, 0xffb765],       // labs / garage
    [-10, -15, 0xffb765, 5.4], [10, -15, 0xffb765, 5.4], // balconies (elevated)
    [-38, -13, 0x9dc4ff], [17, -30, 0x9dc4ff, 5.4],  // generator / chemical (cool)
    [-7, -52, 0xffb765], [7, -52, 0xffb765],         // factory (high)
  ];
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2a2723, roughness: 0.62, metalness: 0.55, side: THREE.DoubleSide });
  for (const [lx, lz, lc, ly0] of lampDefs) {
    const isHall = lz === -52;
    const ly = ly0 || (isHall ? 6.2 : 3.9);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({ color: 0x201c16, emissive: lc, emissiveIntensity: 0.4, roughness: 0.25 }));
    bulb.position.set(lx, ly, lz);
    // Conical enamel shade: gives the pool of light a hard top edge and reads
    // as a real fixture in silhouette instead of a floating dot.
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.26, 14, 1, true), shadeMat);
    shade.position.set(lx, ly + 0.14, lz);
    shade.castShadow = false;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8), matDark);
    cord.position.set(lx, ly + 0.62, lz);
    const pl = new THREE.PointLight(lc, 5, 22, 2);
    pl.position.set(lx, ly - 0.08, lz);
    group.add(bulb, shade, cord, pl);
    lamps.push({ pl, bulb, shade, base: lc, flicker: Math.random() < 0.35, t: rand(10) });
  }
  // fire lights
  for (const f of fires) {
    f.light = new THREE.PointLight(0xff7028, 52, 13, 2);
    f.light.position.set(f.x, f.y + 0.4, f.z);
    group.add(f.light);
  }

  // ---------- painted factory signage (weathered stencil, original art) ----------
  function wallSign(text, x, y, z, w, ry = 0, opts = {}) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 128;
    const g2 = c.getContext('2d');
    g2.clearRect(0, 0, 1024, 128);
    const fontSize = opts.fontSize || 84;
    g2.font = `bold ${fontSize}px "Arial Narrow", Arial, sans-serif`;
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    // Always reserve paint margin. Canvas fillText otherwise clips long copy at
    // the texture edge, which was cutting the final S from DER KOLOSS.
    const maxTextWidth = 920;
    const measured = g2.measureText(text).width;
    if (measured > maxTextWidth) {
      g2.font = `bold ${Math.floor(fontSize * maxTextWidth / measured)}px "Arial Narrow", Arial, sans-serif`;
    }
    // weathered paint: stamp the text many times at low alpha, then erase scratches
    for (let i = 0; i < (opts.stamps || 7); i++) {
      const paint = opts.paint || '214,208,190';
      const paintAlpha = opts.paintAlpha || 0.05;
      g2.fillStyle = `rgba(${paint},${paintAlpha + Math.random() * paintAlpha})`;
      g2.fillText(text, 512 + rand(-2, 2), 66 + rand(-2, 2), maxTextWidth);
    }
    g2.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < (opts.scratches ?? 260); i++) {
      g2.fillStyle = `rgba(0,0,0,${rand(0.2, 0.7)})`;
      g2.fillRect(rand(0, 1024), rand(20, 110), rand(1, 6), rand(1, 3));
    }
    g2.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Signage is painted along a wall, so it is read edge-on more often than
    // face-on. Without anisotropy the stencil dissolves into a shimmering band
    // the moment you walk past it.
    tex.anisotropy = 16;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: opts.opacity ?? 0.85 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
  }
  wallSign('WAFFENFABRIK  DER  KOLOSS', -1, 5.6, -41.78, 16);
  wallSign('CREATED BY VESPER.INC', -1, 4.35, -41.775, 5.2, 0, {
    fontSize: 54, opacity: 0.9, scratches: 120, stamps: 7,
    paint: '255,255,255', paintAlpha: 0.11,
  });
  wallSign('SEKTOR  A', -13.78, 3.4, 20, 7, Math.PI / 2);
  wallSign('HALLE  3', 13.78, 3.6, -52, 8, -Math.PI / 2);
  wallSign('LABOR', -31.78, 3.2, -13, 5, Math.PI / 2);
  wallSign('HALLE  1', -13.78, 3.2, 6, 6, Math.PI / 2);
  wallSign('HALLE  2', 13.78, 3.2, 6, 6, -Math.PI / 2);
  wallSign('KRAFTWERK', -15.78, 3.4, -26, 7, Math.PI / 2);
  wallSign('COURTYARD  EXIT', 10.22, 5.35, -30, 4.2, Math.PI / 2);
  // Eye-level wayfinding on the Double Tap side, directly over the 1000-point
  // door at x=8. This is intentionally readable before the player reaches it.
  wallSign('COURTYARD  GATE   1000', 7.7, 3.72, -21.78, 5.4, 0);
  // The neighboring upper door is not a duplicate courtyard entrance: it is
  // the paid garage-balcony route into Chemical Testing and Teleporter B.
  wallSign('TELEPORTER  B   750', 12, 5.55, -21.78, 4.6, 0);

  // merge static geometry
  const matFor = { wall: matWall, brick: matBrick, metal: matMetal, wood: matWood, dark: matDark, plate: matPlate, concrete: matConcrete, ceiling: matCeiling };
  for (const key of Object.keys(solidGeos)) {
    const arr = solidGeos[key];
    if (!arr.length) continue;
    // manual merge (BufferGeometryUtils-free)
    let total = 0;
    for (const g of arr) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), norm = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const idx = [];
    let vo = 0;
    for (const g of arr) {
      pos.set(g.attributes.position.array, vo * 3);
      norm.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx.push(gi[i] + vo);
      vo += g.attributes.position.count;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    merged.setIndex(idx);
    const mesh = new THREE.Mesh(merged, matFor[key]);
    // Named so a coplanar-face audit can say WHICH bucket is fighting which,
    // instead of reporting two anonymous material uuids.
    mesh.name = `solid_${key}`;
    mesh.castShadow = key !== 'dark';
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  scene.add(group);

  // ---------- runtime update ----------
  let time = 0;
  function update(dt, powerOn, focus = null) {
    time += dt;
    sky.update(time);
    props.update(dt, time, powerOn);
    // Keep the tight shadow box on the player; snapping happens inside.
    if (focus) sunShadow.update(focus);
    for (const l of lamps) {
      l.t += dt;
      let target = powerOn ? 70 : 34;
      // A failing tube is unsteady, not a strobe. The dip used to be assigned
      // instantly and only the recovery was damped, so a flickering lamp cut to
      // 20% in a single frame and crawled back — across ten lamps that reads as
      // the whole map convulsing every time the mains come up. Both directions
      // now go through the same damped approach, so the gate never fully
      // resolves before it lifts and the lamp wavers instead of banging.
      if (l.flicker && Math.sin(l.t * 23) + Math.sin(l.t * 7.3) > 1.2) target *= 0.2;
      l.pl.intensity += (target - l.pl.intensity) * Math.min(1, dt * 9);
      l.bulb.material.emissiveIntensity = l.pl.intensity / 5 + 0.3;
    }
    for (const f of fires) {
      f.t += dt;
      f.light.intensity = 52 + Math.sin(f.t * 11) * 14 + Math.sin(f.t * 27.7) * 9;
    }
    // Machine emissives follow their own practical, so a marquee, its bottle
    // backlight and the glow it throws on the wall all die with the power.
    for (const k of perks) k.machine?.update(dt, time);
    papMachine.update(powerOn ? 1 : 0, dt);
    powerProp.update(power.on, dt);
    for (const t of teleporters) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      const target = powerOn ? (t.charging ? 2.4 : (t.linked ? 1.6 : 0.7)) : 0.12;
      t.ringMat.emissiveIntensity += (target - t.ringMat.emissiveIntensity) * Math.min(1, dt * 3);
      t.ringMat.emissive.setHex(t.linked ? 0x55aaff : 0x3366aa);
    }
    // Game state drives the existing low-cost PaP energy. Dormant/ready states
    // remain subtle; only the eight-second processing cycle blooms and spins.
    const papProcessing = pap.processing;
    const papReady = pap.ready;
    papEnergy.rotation.z = time * (papProcessing ? 2.15 : 0.16);
    papEnergy.rotation.y = Math.sin(time * (papProcessing ? 2.1 : 0.52)) * (papProcessing ? 0.42 : 0.1);
    const papPulse = papProcessing
      ? 1.12 + Math.sin(time * 7.2) * 0.13
      : (papReady ? 0.82 + Math.sin(time * 2.2) * 0.025 : 0.68 + Math.sin(time * 1.4) * 0.018);
    papCore.scale.setScalar(papPulse);
    papCoreMat.emissiveIntensity = papProcessing
      ? 2.2 + Math.sin(time * 8.3) * 0.65
      : (papReady ? 0.42 : 0.2);
    papSlot.material.emissiveIntensity = papProcessing
      ? 1.15 + Math.sin(time * 7.5) * 0.42
      : (papReady ? 0.72 : 0.24);
    for (let i = 1; i < papEnergy.children.length; i++) {
      const energyPart = papEnergy.children[i];
      energyPart.rotation.z += dt * (papProcessing ? (i % 2 ? 2.4 : -1.9) : (i % 2 ? 0.24 : -0.18));
      if (energyPart.material?.opacity !== undefined) {
        energyPart.material.opacity = papProcessing
          ? 0.72 + Math.sin(time * 8.1 + i) * 0.22
          : (papReady ? 0.2 : 0.09);
      }
    }
    // doors anim
    for (const d of doors) {
      if (d.open && d.animT < 1) {
        d.animT = Math.min(1, d.animT + dt / 0.9);
        d.mesh.position.y = (d.baseY ?? 1.5) - 3.05 * d.animT;
        if (d.animT >= 1) d.mesh.visible = false;
      }
    }
    // box float/glow. The sway ADDS to the placement yaw — it used to assign
    // it outright, which pinned the crate to a single +Z facing at all six
    // locations and left it showing its hinged back wherever the player
    // approaches from the other side.
    boxG.rotation.y = box.baseYaw + Math.sin(time * 0.4) * 0.03;
    boxProp.update(dt, time);
    // ground fog drift
    for (const f of fogPatches) {
      f.t += dt;
      f.m.position.x = f.x0 + Math.sin(f.t * 0.11) * f.r;
      f.m.position.z = f.z0 + Math.cos(f.t * 0.073) * f.r * 0.7;
      f.m.material.opacity = 0.75 + Math.sin(f.t * 0.21) * 0.25;
    }
    // skylight dust fall
    {
      const arr = dust.geometry.attributes.position.array;
      for (let i = 0; i < dustN; i++) {
        arr[i * 3 + 1] -= dt * 0.14;
        arr[i * 3] += Math.sin(time * 0.4 + i) * dt * 0.05;
        if (arr[i * 3 + 1] < 0.15) arr[i * 3 + 1] = 6.8;
      }
      dust.geometry.attributes.position.needsUpdate = true;
    }
  }

  function openDoor(door) {
    if (door.open) return;
    door.open = true;
    const idx = colliders.indexOf(door.collider);
    if (idx >= 0) colliders.splice(idx, 1);
    // Enemy navigation is derived from these colliders, so a doorway that has
    // just become passable must be re-derived. Without this the horde keeps
    // routing around a wall that no longer exists — and the routes it would take
    // instead are the long way round, or nothing at all.
    const dc = door.collider;
    if (dc) navInvalidate(api, dc.minX, dc.minZ, dc.maxX, dc.maxZ);
    // The wide Courtyard gate is a readable open passage, not a sinking brick
    // panel players can walk through. Remove its leaf in the same tick that its
    // collider is removed so visual and physical state always agree.
    if (door.openingStyle === 'wide-passage') {
      door.animT = 1;
      door.mesh.visible = false;
    }
  }

  /**
   * Face the crate's front (its local +Z, where the hasp is and where the lid
   * opens toward) at the open middle of whatever room it landed in, so players
   * always meet the front rather than the hinges. Hand-authoring a yaw per
   * location would drift the moment a location moved; deriving it from the room
   * rect cannot.
   */
  function boxYawAt(l) {
    const room = rooms.find((r) => r.id === roomAt(l.x, l.z, (l.y || 0) + 0.5));
    if (!room) return 0;
    const cx = (room.rect.minX + room.rect.maxX) / 2;
    const cz = (room.rect.minZ + room.rect.maxZ) / 2;
    const dx = cx - l.x, dz = cz - l.z;
    if (Math.abs(dx) < 0.05 && Math.abs(dz) < 0.05) return 0;
    return Math.atan2(dx, dz);          // yaw that points local +Z at (cx, cz)
  }

  function moveBox(locIdx) {
    // Bail BEFORE mutating. This used to assign box.locIdx and then dereference
    // box.locations[locIdx], so an out-of-range index threw with the crate's
    // index already pointing at nothing while its mesh, collider and navmesh
    // stayed where they were. It is reachable from the wire (`box_move`).
    // Normalised, not just range-checked. `locations['2']` resolves fine by
    // array-index coercion, so a string index used to be stored verbatim — and
    // the "pick a different spot" filter compares with !==, so '2' !== 2 left
    // the current location in the candidate list and the crate could move to
    // where it already was.
    const idx = Math.trunc(Number(locIdx));
    const l = Number.isInteger(idx) ? box.locations[idx] : undefined;
    if (!l) return;
    box.locIdx = idx;
    boxG.position.set(l.x, l.y || 0, l.z);
    box.baseYaw = boxYawAt(l);
    box.pos.x = l.x; box.pos.z = l.z; box.pos.y = 0.9 + (l.y || 0);
    const bc = colliders.find(c => c.boxCollider);
    if (bc) {
      // Both ends have to be re-derived: the crate stops blocking where it was
      // and starts blocking where it landed, and the navigation grid is built
      // from these rectangles.
      const was = { minX: bc.minX, minZ: bc.minZ, maxX: bc.maxX, maxZ: bc.maxZ };
      bc.minX = l.x - 0.75; bc.maxX = l.x + 0.75;
      bc.minZ = l.z - 0.45; bc.maxZ = l.z + 0.45;
      bc.y0 = l.y || 0;
      navInvalidate(api, was.minX, was.minZ, was.maxX, was.maxZ);
      navInvalidate(api, bc.minX, bc.minZ, bc.maxX, bc.maxZ);
    }
  }

  // Face the crate correctly at its STARTING location too, not only after it
  // teleports. boxYawAt needs `rooms` and `roomAt`, so this runs here rather
  // than at construction.
  box.baseYaw = boxYawAt(box.locations[0]);
  boxG.rotation.y = box.baseYaw;

  // Named, because openDoor() and moveBox() have to hand this exact object to
  // navInvalidate() — the navigation grid is keyed on the map instance.
  api = {
    group, colliders, barriers, risers, rooms, doors, interact,
    wallbuys, perks, power, teleporters, mainframe, pap, box, traps,
    playerSpawns: [{ x: -2, z: 16.4 }, { x: 2, z: 16.4 }, { x: -2, z: 15.4 }, { x: 2, z: 15.4 }],
    roomAt, floorY, floorZones, ramps, navLinks, findPath, update, openDoor, moveBox,
    moonLight, sunShadow, sky, props, grade: GRADE, lamps, fires,
    // Coarse emergency clamp around the actual building shell. Fine-grained
    // containment is enforced by roomAt() in the local player controller.
    bounds: { minX: -44, maxX: 32, minZ: -62, maxZ: 26 },
  };
  return api;
}

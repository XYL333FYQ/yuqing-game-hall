// Purchasable gate: a riveted steel blast door in a channel-iron jamb.
//
// The leaf carries pressed stiffener ribs, a border of dome rivets, a barred
// vision slit, a lever handle with a lock wheel, and a chain and padlock across
// the middle — it is visibly *shut* rather than a coloured panel. The jamb is a
// bolted channel section with a lintel plate and a caged bulkhead lamp.
import * as THREE from 'three';
import { Kit } from './build.js';
import { ironMaterial, brassMaterial, enamelMaps, signTexture, propMaterial } from './materials.js';
import { DOOR_FIT } from '../map-layout.js';

let sharedMats = null;
function getShared() {
  if (sharedMats) return sharedMats;
  const paint = enamelMaps(0x4a4f56, 203, { chips: 150, rust: 0.62, grime: 0.62, relief: 1.5 });
  sharedMats = {
    steel: propMaterial({
      map: paint.map, normalMap: paint.normalMap, roughnessMap: paint.roughnessMap,
      color: 0xb9bec6, metalness: 0.72, roughness: 0.6,
      normalScale: new THREE.Vector2(0.95, 0.95),
    }),
    iron: ironMaterial({ color: 0xe8ecf1, roughness: 0.58, metalness: 0.5 }),
    brass: brassMaterial({ roughness: 0.44 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.95, metalness: 0.1 }),
  };
  return sharedMats;
}

/**
 * The moving leaf. Authored in the door's own local frame: X across the
 * opening, +Z out of the face.
 * @param {number} w opening width
 */
export function buildDoorLeaf(w, cost) {
  const g = new THREE.Group();
  const S = getShared();
  const mats = { steel: S.steel, iron: S.iron, brass: S.brass, dark: S.dark };
  const k = new Kit(1.1);
  // The leaf is deliberately SMALLER than the opening it fills. At exactly `w`
  // its edges were coplanar with the brick cut faces the wall builder leaves at
  // ±w/2, and its top was coplanar with the lintel soffit at y=3 — three
  // surfaces in one plane, fighting for the depth buffer down both jambs and
  // across the head of every door in the map. The inset tucks the leaf inside
  // the jamb rebate, where a real blast door sits anyway.
  const LW = w - DOOR_FIT.leafInset;
  const HW = LW / 2, T = 0.09;

  k.box('steel', LW, 2.96, T * 2, 0, -0.02, 0);

  // Everything pressed onto the leaf's face is laid in a band: `sink` metres
  // buried in the steel, `relief` metres proud of it, on both faces at once.
  //
  // The three plate types CROSS each other — the centre rib runs through both
  // stiffeners and through the vision-slit surround — so if they all start at
  // the skin their back faces land in one plane, and if they are all given
  // about the same thickness their fronts do too. That is what they did: six
  // planes within a millimetre of each other down the middle of every door.
  // Distinct sinks separate the buried faces; distinct reliefs are real relief.
  const plate = (key, pw, ph, y, sink, relief) => {
    for (const sz of [-1, 1]) {
      k.box(key, pw, ph, sink + relief, 0, y, sz * (T + (relief - sink) / 2));
    }
  };
  const RIB_SINK = 0.006, RIB_RELIEF = 0.0345;      // horizontal stiffeners
  const SPINE_SINK = 0.012, SPINE_RELIEF = 0.030;   // vertical centre rib
  const SLIT_SINK = 0.018, SLIT_RELIEF = 0.024;     // vision-slit surround

  // pressed stiffener ribs
  for (const y of [-1.18, 1.18]) plate('iron', LW - 0.10, 0.10, y, RIB_SINK, RIB_RELIEF);
  // vertical centre rib
  plate('iron', 0.10, 2.9, 0, SPINE_SINK, SPINE_RELIEF);
  // dome rivets around the border
  const rivetsX = Math.max(3, Math.round(LW / 0.26));
  for (let i = 0; i < rivetsX; i++) {
    const x = -HW + 0.10 + i * ((LW - 0.20) / (rivetsX - 1));
    for (const sz of [-1, 1]) {
      const face = sz > 0 ? 'z' : '-z';
      k.rivet('iron', 0.019, x, 1.40, sz * (T + 0.012), face);
      k.rivet('iron', 0.019, x, -1.40, sz * (T + 0.012), face);
    }
  }
  for (let i = 0; i < 11; i++) {
    const y = -1.4 + i * 0.28;
    for (const sx of [-HW + 0.09, HW - 0.09]) for (const sz of [-1, 1]) {
      k.rivet('iron', 0.019, sx, y, sz * (T + 0.012), sz > 0 ? 'z' : '-z');
    }
  }
  // vision slit with bars, at eye height
  const SW = Math.min(0.44, LW * 0.32);
  k.box('dark', SW, 0.16, 0.02, 0, 0.78, 0);
  plate('iron', SW + 0.10, 0.05, 0.87, SLIT_SINK, SLIT_RELIEF);
  plate('iron', SW + 0.10, 0.05, 0.69, SLIT_SINK, SLIT_RELIEF);
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      k.cyl('iron', 0.011, 0.011, 0.18, 6, -SW / 2 + 0.06 + i * (SW - 0.12) / 3, 0.78, sz * (T + 0.01));
    }
  }
  // lever handle + lock wheel
  for (const sz of [-1, 1]) {
    k.box('iron', 0.10, 0.10, 0.05, HW - 0.24, -0.02, sz * (T + 0.025));
    k.cyl('iron', 0.024, 0.024, 0.30, 8, HW - 0.24, -0.14, sz * (T + 0.055), { rz: 0.35 });
    k.cyl('brass', 0.035, 0.035, 0.05, 10, HW - 0.30, -0.28, sz * (T + 0.055));
    k.torus('brass', 0.13, 0.02, 5, 14, HW - 0.24, 0.42, sz * (T + 0.04), { rx: sz > 0 ? 0 : Math.PI });
    for (let i = 0; i < 3; i++) {
      k.cyl('brass', 0.011, 0.011, 0.26, 6, HW - 0.24, 0.42, sz * (T + 0.04), { rz: i * Math.PI / 3 });
    }
  }
  // chain and padlock slung across the leaf
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      k.torus('iron', 0.028, 0.008, 4, 8, -HW + 0.18 + t * (LW - 0.36), -0.80 - Math.sin(t * Math.PI) * 0.10,
        sz * (T + 0.03), { rx: i % 2 ? Math.PI / 2 : 0, rz: 0.2 });
    }
    k.box('iron', 0.075, 0.10, 0.03, 0, -0.92, sz * (T + 0.05));
    k.torus('iron', 0.032, 0.009, 5, 10, 0, -0.85, sz * (T + 0.05), { arc: Math.PI });
  }
  k.finish(g, mats, { receiveShadow: true });

  // cost plate, both faces
  const tex = signTexture(`ÖFFNEN`, {
    w: 512, h: 200, seed: 300 + cost, bg: '#c8a13c', fg: '#171208',
    sub: `${cost} PUNKTE`, subColor: 'rgba(23,18,8,0.82)',
    font: '"Arial Narrow", Arial, sans-serif', fontSize: 82,
  });
  const plateMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });
  for (const sz of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.0, LW - 0.3), 0.39), plateMat);
    plate.position.set(0, 0.14, sz * (T + 0.028));
    plate.rotation.y = sz > 0 ? 0 : Math.PI;
    plate.castShadow = false; plate.receiveShadow = true;
    g.add(plate);
  }
  return g;
}

/** The static jamb: channel-iron posts, lintel plate, caged bulkhead lamp. */
export function buildDoorFrame(w, isHoriz) {
  const g = new THREE.Group();
  const S = getShared();
  const mats = { iron: S.iron, dark: S.dark };
  const k = new Kit(1.1);
  const HW = w / 2;
  const { jambRebate: REB, postWidth: PW, postDepth: PD } = DOOR_FIT;

  // The lintel plate hangs 4cm below the wall's 3m soffit: at exactly 3.0 its
  // underside was coplanar with the brick above the opening.
  const LINTEL_Y = 3.08, LINTEL_H = 0.28;
  const LINTEL_SOFFIT = LINTEL_Y - LINTEL_H / 2;
  const POST_BASE = -0.03;

  for (const sx of [-1, 1]) {
    // The post is REBATED into the opening: its inner face sits `REB` past the
    // brick cut plane at ±HW, so the wall's cut face is hidden behind iron
    // instead of fighting it for the same pixels. Everything else on the jamb
    // hangs off this one number.
    const inner = HW - REB;
    const x = sx * (inner + PW / 2);
    // The post DIES ON the lintel's soffit rather than running up behind it.
    // Post and lintel share a depth (both PD) and, at w + 0.44, the same outer
    // x — so every centimetre the post overlapped the lintel put its front,
    // back AND outer faces in the lintel's own planes. That was 0.34m² of
    // flicker on the most-looked-at surface in the map, on every door.
    k.box('iron', PW, LINTEL_SOFFIT - POST_BASE, PD, x, (LINTEL_SOFFIT + POST_BASE) / 2, 0);
    // The stop bead overruns the post by 5mm at BOTH ends, so its two end caps
    // are buried — one inside the lintel, one below the floor — instead of
    // landing in the same planes as the post's own caps, which it laps in x.
    const beadTop = LINTEL_SOFFIT + 0.005, beadBase = POST_BASE - 0.005;
    k.box('iron', 0.09, beadTop - beadBase, PD + 0.10,
      x + sx * (PW / 2 - 0.01), (beadTop + beadBase) / 2, 0);
    for (let i = 0; i < 9; i++) k.rivet('iron', 0.021, x, 0.25 + i * 0.36, PD / 2 + 0.005);
    for (let i = 0; i < 9; i++) k.rivet('iron', 0.021, x, 0.25 + i * 0.36, -(PD / 2 + 0.005), '-z');
  }
  k.box('iron', w + 0.44, LINTEL_H, PD, 0, LINTEL_Y, 0);
  k.box('iron', w + 0.52, 0.07, 0.42, 0, 3.26, 0);
  const nx = Math.max(4, Math.round((w + 0.4) / 0.28));
  for (let i = 0; i < nx; i++) {
    const x = -(w + 0.36) / 2 + i * ((w + 0.36) / (nx - 1));
    k.rivet('iron', 0.021, x, 3.10, 0.175);
    k.rivet('iron', 0.021, x, 3.10, -0.175, '-z');
  }
  // caged bulkhead lamp on the lintel
  k.box('iron', 0.30, 0.14, 0.22, 0, 2.86, 0.16);
  k.box('iron', 0.30, 0.14, 0.22, 0, 2.86, -0.16);
  k.finish(g, mats, { receiveShadow: true });

  if (!isHoriz) g.rotation.y = Math.PI / 2;
  return g;
}

/** Caged sodium fixture over the doorway. Returns the emissive material too. */
export function buildDoorLamp() {
  const g = new THREE.Group();
  const S = getShared();
  const k = new Kit(1.6);
  const mats = { iron: S.iron };
  k.box('iron', 0.34, 0.06, 0.26, 0, 0.09, 0);
  for (let i = 0; i < 4; i++) {
    k.cyl('iron', 0.008, 0.008, 0.16, 5, -0.12 + i * 0.08, 0.01, 0);
  }
  for (const sz of [-0.11, 0.11]) k.cyl('iron', 0.008, 0.008, 0.30, 5, 0, -0.05, sz, { rz: Math.PI / 2 });
  k.finish(g, mats, { receiveShadow: false, castShadow: false });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x241a0c, emissive: 0xd6a85b, emissiveIntensity: 0.55, roughness: 0.42, metalness: 0.0,
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.24, 12), glassMat);
  glass.rotation.z = Math.PI / 2;
  glass.position.y = 0.0;
  glass.castShadow = false;
  g.add(glass);
  return { group: g, glassMat };
}

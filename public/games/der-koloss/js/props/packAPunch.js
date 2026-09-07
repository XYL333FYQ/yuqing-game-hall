// Pack-a-Punch: the arcane press bolted together in a 1945 weapons factory.
//
// Cast-iron frame with riveted corner columns, a caged intake aperture behind
// armoured glass, brass valve gear and pressure gauges, a rack of vacuum tubes
// on ceramic standoffs, armoured cabling sagging off the transformer hood, and
// enamelled high-voltage warnings.
//
// The aperture is a real hole through the front skin with a matte-black liner,
// so the dark-energy field authored in map.js sits *inside* the machine behind
// a cage instead of being painted onto its face.
import * as THREE from 'three';
import { Kit, cableGeometry, helixGeometry } from './build.js';
import { ironMaterial, brassMaterial, castIronMaps, stencilTexture, signTexture, shared, propMaterial } from './materials.js';

/**
 * Builds the cabinet. The caller keeps ownership of the energy group, the
 * intake pane and the sign so the existing gameplay hooks stay intact.
 */
export function buildPackAPunch() {
  const g = new THREE.Group();

  const iron = castIronMaps(41, { base: '#8a8d93' });
  const ironMat = propMaterial({
    map: iron.map, normalMap: iron.normalMap, roughnessMap: iron.roughnessMap,
    color: 0xd2d6dc, metalness: 0.42, roughness: 0.66,
    normalScale: new THREE.Vector2(1.15, 1.15),
  });
  const brassMat = brassMaterial({ roughness: 0.4 });
  const copperMat = brassMaterial({ copper: true, roughness: 0.52 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.95, metalness: 0.05 });
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xa89a84, roughness: 0.35, metalness: 0.0 });
  const tubeGlassMat = new THREE.MeshStandardMaterial({
    color: 0x2b2a26, roughnessMap: shared.glassRough, roughness: 0.08, metalness: 0.0,
    transparent: true, opacity: 0.3, depthWrite: false,
  });
  const filamentMat = new THREE.MeshStandardMaterial({
    color: 0x120c04, emissive: 0xffa63c, emissiveIntensity: 0.35, roughness: 0.4,
  });

  const mats = {
    iron: ironMat, brass: brassMat, copper: copperMat, dark: darkMat,
    ceramic: ceramicMat, filament: filamentMat,
  };
  const k = new Kit(0.9);

  // ---- geometry constants --------------------------------------------------
  const HW = 0.90, H = 1.70, FZ = 0.45, CZ = 0.10;   // half-width, height, front, core front
  const SKIN_Z = (FZ + CZ) / 2, SKIN_D = FZ - CZ;
  const AX = 0.48, A0 = 0.70, A1 = 1.30;             // aperture half-width, y range

  // ---- base and core -------------------------------------------------------
  k.box('iron', HW * 2 + 0.12, 0.10, 1.02, 0, 0.05, 0);            // bed plate
  for (const sx of [-0.78, 0.78]) for (const sz of [-0.40, 0.40]) {
    k.cyl('iron', 0.035, 0.035, 0.055, 8, sx, 0.10, sz);           // anchor bolts
    k.rivet('iron', 0.032, sx, 0.128, sz, 'y');
  }
  // Core mass. It stops exactly ON the core-front plane, because the front skin
  // starts there and the two share a width and a height: any overshoot puts the
  // core's side and top faces in the SAME plane as the skin's own side and top,
  // and coplanar same-facing surfaces flicker (RENDERING.md §3a). Deriving the
  // depth from anything but CZ is how that happened — it ran 0.125m proud, for
  // 0.4m² of fighting cabinet side and 0.225m² of fighting cabinet top, and it
  // also filled the intake cavity with iron so the matte liner never showed.
  const CORE_BACK = -0.575;
  k.box('iron', HW * 2, H - 0.10, CZ - CORE_BACK, 0, 0.10 + (H - 0.10) / 2, (CZ + CORE_BACK) / 2);
  // front skin frame around the aperture
  const skin = (x0, x1, y0, y1) => k.box('iron', x1 - x0, y1 - y0, SKIN_D, (x0 + x1) / 2, (y0 + y1) / 2, SKIN_Z);
  skin(-HW, HW, A1, H);
  skin(-HW, HW, 0.10, A0);
  skin(-HW, -AX, A0, A1);
  skin(AX, HW, A0, A1);

  // riveted corner columns
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.box('iron', 0.17, H - 0.06, 0.17, sx * (HW - 0.02), 0.10 + (H - 0.16) / 2, sz * (FZ - 0.05));
    for (let i = 0; i < 7; i++) {
      k.rivet('iron', 0.022, sx * (HW + 0.06), 0.26 + i * 0.20, sz * (FZ - 0.05), sx > 0 ? 'x' : '-x');
    }
  }
  // horizontal strapping across the front skin
  for (const y of [0.28, 1.52]) {
    k.box('iron', HW * 2 + 0.02, 0.075, 0.035, 0, y, FZ + 0.012);
    for (let i = 0; i < 7; i++) k.rivet('iron', 0.019, -0.72 + i * 0.24, y, FZ + 0.034);
  }

  // ---- intake aperture -----------------------------------------------------
  // A cast collar projects forward of the face, so the containment volume has
  // somewhere to live: the field is inside a mouth, behind bars, not stuck on
  // the outside of a slab. MZ is the front plane the energy must stay behind.
  const MZ = 0.62;
  // Matte liner from the back of the cavity out to the mouth. The four walls
  // BUTT: the side walls are cut to the clear height between the top and bottom
  // walls, and the back plate tucks inside all four, so no corner of the box is
  // covered twice. Lapping them instead — every member given the full span —
  // is the same coplanar defect as a lapped frame anywhere else.
  const linerD = MZ - CZ;
  const linerZ = (MZ + CZ) / 2;
  const linerT = 0.016;
  k.box('dark', AX * 2 - linerT * 2, A1 - A0 - linerT * 2, 0.014, 0, (A0 + A1) / 2, CZ + 0.008);
  k.box('dark', AX * 2, linerT, linerD, 0, A1 - linerT / 2, linerZ);
  k.box('dark', AX * 2, linerT, linerD, 0, A0 + linerT / 2, linerZ);
  for (const sx of [-AX + linerT / 2, AX - linerT / 2]) {
    k.box('dark', linerT, A1 - A0 - linerT * 2, linerD, sx, (A0 + A1) / 2, linerZ);
  }
  // Collar walls. Head and sill run the full width; the jambs are cut to the
  // CLEAR height between them so the four members butt at the corners. Given
  // the full height instead, each jamb laps the head and the sill, and a lap
  // puts two faces of equal depth in one plane on all three exposed sides.
  const collarD = MZ - FZ;
  const collarZ = (MZ + FZ) / 2;
  const collarT = 0.12;
  k.box('iron', AX * 2 + collarT * 2, collarT, collarD, 0, A1 + collarT / 2, collarZ);
  k.box('iron', AX * 2 + collarT * 2, collarT, collarD, 0, A0 - collarT / 2, collarZ);
  for (const sx of [-(AX + collarT / 2), AX + collarT / 2]) {
    k.box('iron', collarT, A1 - A0, collarD, sx, (A0 + A1) / 2, collarZ);
  }
  // Brass mouth ring, riveted on. Same butt joint; its head overhangs the jambs
  // rather than sitting flush with them, so the clear height is derived from
  // where the head's own inner face lands, not assumed.
  const ringT = 0.075, ringOff = 0.062;
  k.box('brass', AX * 2 + 0.26, ringT, 0.05, 0, A1 + ringOff, MZ + 0.01);
  k.box('brass', AX * 2 + 0.26, ringT, 0.05, 0, A0 - ringOff, MZ + 0.01);
  for (const sx of [-(AX + ringOff), AX + ringOff]) {
    k.box('brass', ringT, A1 - A0 + ringOff * 2 - ringT, 0.05, sx, (A0 + A1) / 2, MZ + 0.01);
  }
  for (const sx of [-(AX + 0.062), AX + 0.062]) for (let i = 0; i < 4; i++) {
    k.rivet('brass', 0.014, sx, A0 + 0.08 + i * 0.15, MZ + 0.038);
  }
  // containment cage across the mouth: vertical bars, two horizontal ties
  // The bars socket 2cm INTO the collar at each end. Cut to the clear height
  // instead, their end caps land exactly on the collar's inner face and fight
  // the liner's top and bottom in that plane — and a socketed bar is what a
  // cage actually is anyway.
  for (let i = 0; i < 9; i++) {
    const x = -AX + 0.06 + i * ((AX * 2 - 0.12) / 8);
    k.cyl('iron', 0.014, 0.014, A1 - A0 + 0.04, 6, x, (A0 + A1) / 2, MZ - 0.012);
  }
  for (const y of [A0 + 0.15, A1 - 0.15]) {
    k.cyl('iron', 0.015, 0.015, AX * 2, 6, 0, y, MZ + 0.012, { rz: Math.PI / 2 });
  }

  // ---- brass gear on the front --------------------------------------------
  // valve handwheel, right of the aperture
  k.cyl('brass', 0.035, 0.035, 0.16, 10, 0.70, 0.48, FZ + 0.02, { rx: Math.PI / 2 });
  k.torus('brass', 0.15, 0.022, 6, 16, 0.70, 0.48, FZ + 0.10);
  for (let i = 0; i < 4; i++) {
    k.cyl('brass', 0.014, 0.014, 0.30, 6, 0.70, 0.48, FZ + 0.10, { rz: i * Math.PI / 4, rx: 0 });
  }
  k.cyl('brass', 0.045, 0.045, 0.05, 10, 0.70, 0.48, FZ + 0.115, { rx: Math.PI / 2 });
  // two pressure gauges, left of the aperture
  for (const gy of [0.55, 0.30]) {
    k.cyl('brass', 0.10, 0.10, 0.05, 14, -0.58, gy, FZ + 0.03, { rx: Math.PI / 2 });
    k.cyl('dark', 0.085, 0.085, 0.012, 14, -0.58, gy, FZ + 0.058, { rx: Math.PI / 2 });
    k.torus('brass', 0.10, 0.014, 5, 14, -0.58, gy, FZ + 0.055);
    k.box('filament', 0.008, 0.07, 0.006, -0.58, gy + 0.028, FZ + 0.066, { rz: 0.7 });
    k.cyl('brass', 0.016, 0.016, 0.09, 6, -0.58, gy - 0.13, FZ + 0.03);
  }
  // conduit and junction box down the left of the front skin
  k.box('iron', 0.13, 0.24, 0.09, -0.72, 1.10, FZ + 0.05);
  k.cyl('copper', 0.024, 0.024, 0.62, 8, -0.72, 0.78, FZ + 0.05);
  k.cyl('copper', 0.024, 0.024, 0.34, 8, -0.72, 1.40, FZ + 0.05);

  // ---- transformer hood, insulators, coils ---------------------------------
  k.box('iron', HW * 2 - 0.08, 0.26, 0.86, 0, H + 0.13, -0.03);
  k.box('iron', HW * 2 + 0.06, 0.05, 0.94, 0, H + 0.27, -0.03);
  for (let i = 0; i < 8; i++) k.rivet('iron', 0.018, -0.74 + i * 0.21, H + 0.13, FZ - 0.06);
  for (const sx of [-0.52, 0, 0.52]) {
    k.cyl('ceramic', 0.055, 0.075, 0.07, 12, sx, H + 0.33, -0.03);
    k.cyl('ceramic', 0.045, 0.062, 0.07, 12, sx, H + 0.40, -0.03);
    k.cyl('ceramic', 0.036, 0.05, 0.07, 12, sx, H + 0.47, -0.03);
    k.cyl('brass', 0.026, 0.026, 0.05, 8, sx, H + 0.52, -0.03);
  }
  // copper windings around the hood ends
  for (const sx of [-0.62, 0.62]) {
    k.put('copper', helixGeometry(0.13, 0.20, 4, 0.017, 56, 5), sx, H + 0.02, -0.03);
  }

  // ---- vacuum tube rack ----------------------------------------------------
  // On a shelf directly above the intake collar. The obvious home was the top
  // of the cabinet, but the wall sign sits in front of that and hid the whole
  // rack; here it is at eye level, right where the player is already looking.
  const TUBE_Y = A1 + 0.10, TUBE_Z = FZ + 0.16;
  k.box('iron', 0.78, 0.035, 0.20, 0, TUBE_Y, TUBE_Z);
  k.box('iron', 0.78, 0.05, 0.03, 0, TUBE_Y + 0.03, TUBE_Z + 0.10);
  // Bracket tops finish INSIDE the shelf, clear of the brass ring's top face
  // just below them; ending level with it put the two in one plane 0.5mm apart.
  for (const sx of [-0.36, 0.36]) k.box('iron', 0.04, 0.15, 0.16, sx, TUBE_Y - 0.065, TUBE_Z);
  for (let i = 0; i < 4; i++) {
    const tx = -0.24 + i * 0.16;
    k.cyl('brass', 0.033, 0.036, 0.05, 10, tx, TUBE_Y + 0.04, TUBE_Z);
    k.cyl('filament', 0.008, 0.008, 0.10, 6, tx, TUBE_Y + 0.12, TUBE_Z);
    k.cyl('filament', 0.020, 0.020, 0.015, 6, tx, TUBE_Y + 0.09, TUBE_Z);
  }

  // ---- armoured cabling ----------------------------------------------------
  const a = new THREE.Vector3(-0.86, H + 0.16, -0.30);
  const b = new THREE.Vector3(-1.55, 1.05, -0.30);
  k.put('dark', cableGeometry(a, b, 0.22, 0.032, 12, 5), 0, 0, 0);
  k.put('dark', cableGeometry(
    new THREE.Vector3(0.86, H + 0.16, -0.34),
    new THREE.Vector3(1.52, 0.90, -0.34), 0.26, 0.028, 12, 5), 0, 0, 0);
  k.put('dark', cableGeometry(
    new THREE.Vector3(-0.72, 0.48, FZ + 0.05),
    new THREE.Vector3(-1.05, 0.06, 0.22), 0.14, 0.022, 10, 5), 0, 0, 0);
  for (const sx of [-1.55, 1.52]) {
    k.cyl('iron', 0.06, 0.075, 0.16, 10, sx, 0.08, sx < 0 ? -0.30 : -0.34);
  }

  k.finish(g, mats, { receiveShadow: true, noShadow: ['filament'] });

  // ---- glass tube envelopes (transparent, drawn after the solids) ----------
  const tubeGeos = [];
  for (let i = 0; i < 4; i++) {
    const tx = -0.24 + i * 0.16;
    const t = new THREE.CylinderGeometry(0.031, 0.031, 0.15, 10, 1, false);
    t.applyMatrix4(new THREE.Matrix4().makeTranslation(tx, TUBE_Y + 0.12, TUBE_Z));
    tubeGeos.push(t);
  }
  const tubes = new THREE.Mesh(mergeSimple(tubeGeos), tubeGlassMat);
  tubes.castShadow = false;
  tubes.renderOrder = 2;
  g.add(tubes);

  // ---- enamelled warning plate --------------------------------------------
  const warnTex = signTexture('HOCHSPANNUNG', {
    w: 512, h: 200, seed: 43, bg: '#c9a52a', fg: '#161208',
    sub: 'LEBENSGEFAHR — NICHT BERÜHREN', subColor: 'rgba(22,18,8,0.8)',
    font: '"Arial Narrow", Arial, sans-serif', fontSize: 76,
  });
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.18), new THREE.MeshStandardMaterial({
    map: warnTex, roughness: 0.42, metalness: 0.0,
  }));
  warn.position.set(0.16, 0.50, FZ + 0.005);
  warn.castShadow = false; warn.receiveShadow = true;
  g.add(warn);

  const numTex = stencilTexture(['115'], { w: 256, h: 128, seed: 47, paint: '226,214,180', fontSize: 100, wear: 200 });
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshStandardMaterial({
    map: numTex, transparent: true, roughness: 0.85, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  num.position.set(-0.30, 1.48, FZ + 0.004);
  num.castShadow = false; num.receiveShadow = true;
  g.add(num);

  // ---- work lamp -----------------------------------------------------------
  // The machine stands on an open platform under moonlight only, so without a
  // practical of its own the cast iron and brass read as a black cut-out and
  // all the modelling is wasted. A gooseneck task lamp on a bracket is both the
  // period answer and the reason the front face is legible at all.
  // A swan-neck arm carries the head out *in front* of the cabinet. A lamp flat
  // against the face only grazes it — the front skin's normal is +Z, so the
  // source has to stand off it to give the iron and brass any modelling at all.
  // It reaches past the wall sign's right edge so it never crosses the copy,
  // and stops short of the collider so the player can never walk into it.
  const LX = HW + 0.35;
  const lampKit = new Kit(1.6);
  lampKit.box('iron', 0.11, 0.11, 0.13, LX, H + 0.30, -0.06);
  lampKit.cyl('iron', 0.028, 0.028, 0.50, 8, LX, H + 0.52, -0.06);
  lampKit.cyl('iron', 0.024, 0.024, 0.78, 8, LX + 0.05, H + 0.72, 0.36, { rx: -1.25 });
  lampKit.cyl('iron', 0.022, 0.022, 0.22, 8, LX + 0.10, H + 0.63, 0.86, { rx: -1.9 });
  lampKit.finish(g, { iron: ironMat }, { receiveShadow: true });
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x565046, roughness: 0.58, metalness: 0.42, side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.17, 14, 1, true), shadeMat);
  shade.position.set(LX + 0.10, H + 0.53, 0.94);
  shade.rotation.set(-0.42, 0, -0.55);
  g.add(shade);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x241c12, emissive: 0xffc07a, emissiveIntensity: 0.4, roughness: 0.3 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bulbMat);
  bulb.position.set(LX + 0.06, H + 0.45, 0.96);
  bulb.castShadow = false;
  g.add(bulb);
  const work = new THREE.PointLight(0xffb87a, 0, 5.2, 2);
  work.position.set(LX + 0.04, H + 0.40, 0.98);
  g.add(work);

  let litSmooth = 0;
  const update = (lit, dt = 0.016) => {
    litSmooth += (lit - litSmooth) * Math.min(1, dt * 3.5);
    filamentMat.emissiveIntensity = 0.06 + litSmooth * 0.45;
    // The work lamp runs off the mains like everything else, but keeps a low
    // ember with the power down so the machine is still findable.
    work.intensity = 5 + litSmooth * 28;
    bulbMat.emissiveIntensity = 0.3 + litSmooth * 2.4;
  };

  return { group: g, update, ironMat, workLight: work };
}

/** Bracketed steel housing for the wall sign above the machine. */
export function buildPapSignFrame(width, height) {
  const g = new THREE.Group();
  const k = new Kit(1.4);
  const mats = { iron: ironMaterial({ color: 0x9aa0a8, roughness: 0.55, metalness: 0.85 }) };
  // Head and sill run the full width; the stiles are cut to the CLEAR height
  // between them so the four members butt. Given `height + T` instead, each
  // stile lapped both the head and the sill, and since all four share a 0.06
  // section that lap put two faces in one plane on the front, the back and the
  // outer edge of every corner.
  const T = 0.07;
  k.box('iron', width + T * 2, T, 0.06, 0, height / 2 + T / 2, 0);
  k.box('iron', width + T * 2, T, 0.06, 0, -height / 2 - T / 2, 0);
  for (const sx of [-(width / 2 + T / 2), width / 2 + T / 2]) k.box('iron', T, height, 0.06, sx, 0, 0);
  for (const sx of [-(width / 2 + 0.035), width / 2 + 0.035]) for (const sy of [-height / 2, height / 2]) {
    k.rivet('iron', 0.016, sx, sy, 0.034);
  }
  // hood over the top edge
  k.box('iron', width + 0.18, 0.04, 0.16, 0, height / 2 + 0.10, 0.07, { rx: 0.35 });
  // stand-off brackets back to the wall
  for (const sx of [-(width / 2 - 0.2), width / 2 - 0.2]) {
    k.box('iron', 0.05, 0.05, 0.14, sx, -height / 2 - 0.02, -0.09);
    k.box('iron', 0.05, 0.05, 0.14, sx, height / 2 + 0.02, -0.09);
  }
  k.finish(g, mats, { receiveShadow: true });
  return g;
}

function mergeSimple(geos) {
  let total = 0, idxTotal = 0;
  for (const gm of geos) { total += gm.attributes.position.count; idxTotal += gm.index.count; }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const idx = new Uint32Array(idxTotal);
  let vo = 0, io = 0;
  for (const gm of geos) {
    pos.set(gm.attributes.position.array, vo * 3);
    nor.set(gm.attributes.normal.array, vo * 3);
    uv.set(gm.attributes.uv.array, vo * 2);
    const gi = gm.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    io += gi.length;
    vo += gm.attributes.position.count;
    gm.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

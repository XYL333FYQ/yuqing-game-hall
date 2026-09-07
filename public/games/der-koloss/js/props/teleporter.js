// Teleporter pad — heavy electromagnetic apparatus.
//
// A bolted cast collar with hazard striping around a grated deck, two riveted
// I-beam columns wound with copper coils, ceramic insulators and a transformer
// can on the gantry, and armoured cable draping from the head down to the pad.
//
// The walkable centre stays clear: everything that reads as machinery is either
// in the collar, on the columns behind, or overhead.
import * as THREE from 'three';
import { Kit, helixGeometry, cableGeometry } from './build.js';
import { ironMaterial, brassMaterial, hazardTexture, stencilTexture, signTexture } from './materials.js';

const PAD_R = 1.5;

let sharedMats = null;
function getShared() {
  if (sharedMats) return sharedMats;
  sharedMats = {
    iron: ironMaterial({ color: 0xeef1f5, roughness: 0.62, metalness: 0.45 }),
    copper: brassMaterial({ copper: true, roughness: 0.5 }),
    brass: brassMaterial({ roughness: 0.42 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.95, metalness: 0.1 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xa4917a, roughness: 0.33, metalness: 0.0 }),
    hazard: new THREE.MeshStandardMaterial({
      map: hazardTexture({ w: 512, h: 64, pitch: 34, seed: 55 }),
      roughness: 0.68, metalness: 0.2, side: THREE.DoubleSide,
    }),
  };
  return sharedMats;
}

/**
 * @param {{id:string,label:string,frameHeight?:number}} td
 * @param {THREE.Material} ringMat emissive containment ring material (owned by map.js)
 */
export function buildTeleporter(td, ringMat) {
  const g = new THREE.Group();
  const S = getShared();
  const FH = td.frameHeight || 3.2;
  const mats = { iron: S.iron, copper: S.copper, brass: S.brass, dark: S.dark, ceramic: S.ceramic };
  const k = new Kit(1.2);

  // ---- deck ----------------------------------------------------------------
  k.cyl('dark', PAD_R - 0.14, PAD_R - 0.14, 0.10, 28, 0, 0.05, 0);          // sunken floor
  k.cyl('iron', PAD_R, PAD_R, 0.05, 30, 0, 0.025, 0);                        // base plate
  // Grating: radial spokes landed on a hub, over concentric ties.
  //
  // Fourteen full-diameter bars all cross at the centre, which puts 0.35 m2 of
  // their top faces in one plane — the worst z-fight on this prop by an order
  // of magnitude, and it is the surface the player stands on and looks down at.
  // Two 45mm strips crossing at the 12.86 degree spoke pitch still overlap
  // 0.20m out from the centre, so ending them inside the brass boss is not
  // enough: they have to land on a hub that is solid out to the radius where
  // neighbouring spokes first touch. Inside that radius the old bars had
  // already merged into unbroken metal, so the hub puts metal where metal was.
  const BAR_W = 0.045, BAR_H = 0.035, BAR_Y = 0.105;
  const SPOKE_N = 28;                                        // fourteen bars, both ends
  const SPOKE_STEP = (Math.PI * 2) / SPOKE_N;
  const SPOKE_R1 = PAD_R - 0.16;                             // outer end, unchanged
  // One hub facet per spoke, so a spoke's end cap butts a flat instead of
  // lapping a curve and opening a hairline at its corners. Radius: where two
  // neighbours touch, plus enough that the facet chord is wider than the bar
  // that lands on it.
  const HUB_R = (BAR_W / 2) / Math.sin(SPOKE_STEP / 2) + 0.004;
  const SPOKE_R0 = HUB_R * Math.cos(SPOKE_STEP / 2);         // the facet plane
  const hub = k.cyl('iron', HUB_R, HUB_R, BAR_H, SPOKE_N, 0, BAR_Y, 0, { ry: -SPOKE_STEP / 2 });
  // A cylinder cap's own UVs run 0..1 across the disc and k.cyl scales them by
  // the wall height, which would smear the iron across the band of hub the
  // boss does not cover. Re-lay the caps in world units, as the spokes are.
  const hubUV = hub.attributes.uv, hubPos = hub.attributes.position, hubNrm = hub.attributes.normal;
  for (let i = 0; i < hubUV.count; i++) {
    if (Math.abs(hubNrm.getY(i)) > 0.99) hubUV.setXY(i, hubPos.getX(i) * k.density, hubPos.getZ(i) * k.density);
  }
  for (let i = 0; i < SPOKE_N; i++) {
    const a = i * SPOKE_STEP, rMid = (SPOKE_R0 + SPOKE_R1) / 2;
    k.box('iron', BAR_W, BAR_H, SPOKE_R1 - SPOKE_R0, Math.sin(a) * rMid, BAR_Y, Math.cos(a) * rMid, { ry: a });
  }
  for (const r of [0.42, 0.86, 1.24]) k.torus('iron', r, 0.022, 5, 26, 0, 0.105, 0, { rx: Math.PI / 2 });
  k.cyl('brass', 0.16, 0.16, 0.05, 14, 0, 0.13, 0);                          // centre boss
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.rivet('brass', 0.02, Math.cos(a) * 0.11, 0.155, Math.sin(a) * 0.11, 'y');
  }
  // cast collar with bolt heads
  k.cyl('iron', PAD_R + 0.06, PAD_R + 0.10, 0.20, 30, 0, 0.10, 0, { open: true });
  k.torus('iron', PAD_R + 0.05, 0.05, 6, 30, 0, 0.20, 0, { rx: Math.PI / 2 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    k.rivet('iron', 0.026, Math.cos(a) * (PAD_R + 0.02), 0.20, Math.sin(a) * (PAD_R + 0.02), 'y');
  }

  // ---- columns: riveted I-beams with copper coils ---------------------------
  const FLANGE_Z = 0.14, FLANGE_T = 0.05;            // flange centreline offset, plate thickness
  // The web is cut to the CLEAR span between the flanges rather than run 5mm
  // into each of them. All three members rise the full height of the column,
  // so a lap anywhere along them lands three top caps in one plane under the
  // gantry head — and their inner faces in the flanges' too.
  const WEB_D = 2 * FLANGE_Z - FLANGE_T;
  for (const sx of [-1.5, 1.5]) {
    // I-beam: two flanges and a web
    for (const sz of [-FLANGE_Z, FLANGE_Z]) k.box('iron', 0.34, FH, FLANGE_T, sx, FH / 2, -0.8 + sz);
    k.box('iron', 0.09, FH, WEB_D, sx, FH / 2, -0.8);
    // base shoe
    k.box('iron', 0.46, 0.09, 0.46, sx, 0.045, -0.8);
    for (const bx of [-0.16, 0.16]) for (const bz of [-0.16, 0.16]) k.rivet('iron', 0.024, sx + bx, 0.09, -0.8 + bz, 'y');
    for (let i = 0; i < Math.floor(FH / 0.3); i++) {
      k.rivet('iron', 0.018, sx - 0.14, 0.22 + i * 0.3, -0.8 + 0.17);
      k.rivet('iron', 0.018, sx + 0.14, 0.22 + i * 0.3, -0.8 + 0.17);
    }
    // coil packs
    for (const cy of [FH * 0.30, FH * 0.66]) {
      k.cyl('ceramic', 0.13, 0.13, 0.06, 12, sx, cy - 0.06, -0.8);
      k.cyl('ceramic', 0.13, 0.13, 0.06, 12, sx, cy + 0.42, -0.8);
      k.put('copper', helixGeometry(0.20, 0.40, 7, 0.021, 84, 5), sx, cy - 0.03, -0.8);
    }
  }

  // ---- gantry head ---------------------------------------------------------
  k.box('iron', 3.4, 0.30, 0.46, 0, FH + 0.02, -0.8);
  k.box('iron', 3.5, 0.06, 0.56, 0, FH + 0.20, -0.8);
  for (let i = 0; i < 12; i++) k.rivet('iron', 0.02, -1.55 + i * 0.28, FH + 0.02, -0.575);
  // Transformer can + insulators on top. Teleporter B runs a compact 2.5m
  // gantry under Chemical Testing's low soffit, so the stack is only fitted
  // where there is headroom for it.
  if (FH >= 3.0) {
    k.cyl('iron', 0.26, 0.28, 0.34, 14, 0, FH + 0.40, -0.8);
    k.torus('iron', 0.27, 0.03, 5, 14, 0, FH + 0.50, -0.8, { rx: Math.PI / 2 });
    for (const sx of [-0.13, 0.13]) {
      k.cyl('ceramic', 0.045, 0.06, 0.06, 10, sx, FH + 0.60, -0.8);
      k.cyl('ceramic', 0.036, 0.05, 0.06, 10, sx, FH + 0.66, -0.8);
      k.cyl('brass', 0.022, 0.022, 0.05, 8, sx, FH + 0.71, -0.8);
    }
  } else {
    k.box('iron', 0.7, 0.16, 0.40, 0, FH + 0.28, -0.8);
    for (const sx of [-0.2, 0.2]) k.cyl('ceramic', 0.05, 0.062, 0.09, 10, sx, FH + 0.40, -0.8);
  }
  // lattice bracing between the columns
  for (const sx of [-1, 1]) {
    k.box('iron', 0.06, 1.35, 0.06, sx * 0.75, FH - 0.55, -0.8, { rz: sx * 0.72 });
  }

  // ---- cabling -------------------------------------------------------------
  k.put('dark', cableGeometry(
    new THREE.Vector3(-1.5, FH - 0.1, -0.62), new THREE.Vector3(-1.05, 0.24, -0.9), 0.35, 0.034, 14, 5), 0, 0, 0);
  k.put('dark', cableGeometry(
    new THREE.Vector3(1.5, FH - 0.1, -0.62), new THREE.Vector3(1.05, 0.24, -0.9), 0.35, 0.030, 14, 5), 0, 0, 0);
  k.put('dark', cableGeometry(
    new THREE.Vector3(-1.5, FH * 0.34, -0.58), new THREE.Vector3(1.5, FH * 0.34, -0.58), 0.42, 0.026, 16, 5), 0, 0, 0);
  // control box on the right column
  k.box('iron', 0.26, 0.34, 0.18, 1.5, 1.05, -0.55);
  k.cyl('brass', 0.055, 0.055, 0.03, 12, 1.5, 1.14, -0.47, { rx: Math.PI / 2 });
  k.cyl('dark', 0.045, 0.045, 0.012, 12, 1.5, 1.14, -0.455, { rx: Math.PI / 2 });
  k.box('brass', 0.03, 0.11, 0.03, 1.5, 0.94, -0.44, { rx: -0.5 });

  k.finish(g, mats, { receiveShadow: true });

  // ---- hazard band around the collar ---------------------------------------
  const band = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R + 0.11, PAD_R + 0.13, 0.13, 30, 1, true), S.hazard);
  band.position.y = 0.115;
  band.castShadow = false; band.receiveShadow = true;
  const bandUV = band.geometry.attributes.uv;
  for (let i = 0; i < bandUV.count; i++) bandUV.setX(i, bandUV.getX(i) * 6);
  g.add(band);

  // ---- containment rings (the emissive one is owned by map.js) -------------
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.055, 8, 34), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.235;
  ring.castShadow = false;
  g.add(ring);

  // ---- gantry name plate ---------------------------------------------------
  const plateTex = signTexture(td.label, {
    w: 256, h: 256, seed: 67 + td.label.charCodeAt(0),
    bg: '#20242b', fg: '#cfe0ff', fontSize: 168, sub: 'TELEPORTER', subColor: 'rgba(190,210,240,0.7)',
  });
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTex, emissiveMap: plateTex, emissive: 0xffffff, emissiveIntensity: 0.10,
    color: 0x14171c, roughness: 0.5, metalness: 0.1,
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), plateMat);
  plate.position.set(0, FH - 0.5, -0.55);
  plate.castShadow = false;
  g.add(plate);

  const stencilMat = new THREE.MeshStandardMaterial({
    map: stencilTexture([`FELD ${td.label}`], { w: 512, h: 96, seed: 73, paint: '226,214,180', fontSize: 62, wear: 200 }),
    transparent: true, roughness: 0.85, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const stencil = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), stencilMat);
  stencil.position.set(0, FH + 0.02, -0.568);
  stencil.castShadow = false;
  g.add(stencil);

  return { group: g, plateMat };
}

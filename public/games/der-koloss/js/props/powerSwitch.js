// Main breaker: a period open-blade knife switch on a slate panel.
//
// Cast-iron enclosure, ceramic standoffs carrying copper busbars, three
// porcelain fuse cans, an enamelled high-voltage plate, conduit running up out
// of the top, and a bakelite-handled triple-pole blade that actually swings the
// copper into the jaws.
import * as THREE from 'three';
import { Kit } from './build.js';
import { ironMaterial, brassMaterial, signTexture, stencilTexture } from './materials.js';

export function buildPowerSwitch() {
  const g = new THREE.Group();
  const ironMat = ironMaterial({ color: 0xeef1f5, roughness: 0.6, metalness: 0.44 });
  const copperMat = brassMaterial({ copper: true, roughness: 0.44 });
  const brassMat = brassMaterial({ roughness: 0.4 });
  const slateMat = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.62, metalness: 0.1 });
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xb0a289, roughness: 0.3, metalness: 0.0 });
  const bakeliteMat = new THREE.MeshStandardMaterial({ color: 0x3a1410, roughness: 0.36, metalness: 0.05 });
  const mats = {
    iron: ironMat, copper: copperMat, brass: brassMat,
    slate: slateMat, ceramic: ceramicMat, bakelite: bakeliteMat,
  };

  const k = new Kit(1.3);
  // enclosure carcass and slate panel
  k.box('iron', 1.02, 1.46, 0.28, 0, 1.42, -0.06);
  k.box('slate', 0.90, 1.32, 0.03, 0, 1.42, 0.09);
  // frame with rivets
  // Head and sill run the full width, so the jambs are cut to the CLEAR span
  // between them and all four members butt. Running the jambs the full 1.6
  // outer height instead doubles up both corners, and because every member
  // shares the 0.34 depth that lap lands two faces in the frame's front plane
  // (z 0.13), its back plane (z -0.21) and the head's top plane (y 2.22).
  // Derived from FRAME_T so the two can never drift apart.
  const FRAME_T = 0.08;            // head/sill thickness
  const FRAME_H = 1.6;             // frame outer height, sill underside to head top
  k.box('iron', 1.06, FRAME_T, 0.34, 0, 2.18, -0.04);
  k.box('iron', 1.06, FRAME_T, 0.34, 0, 0.66, -0.04);
  for (const sx of [-0.51, 0.51]) k.box('iron', 0.08, FRAME_H - 2 * FRAME_T, 0.34, sx, 1.42, -0.04);
  for (const sx of [-0.51, 0.51]) for (let i = 0; i < 6; i++) k.rivet('iron', 0.016, sx, 0.78 + i * 0.26, 0.12);
  // ceramic standoffs and copper busbars behind the blades
  for (const sx of [-0.26, 0, 0.26]) {
    k.cyl('ceramic', 0.045, 0.055, 0.07, 10, sx, 1.86, 0.14, { rx: Math.PI / 2 });
    k.cyl('ceramic', 0.045, 0.055, 0.07, 10, sx, 1.30, 0.14, { rx: Math.PI / 2 });
    k.box('copper', 0.055, 0.16, 0.022, sx, 1.86, 0.185);      // upper jaw block
    k.box('copper', 0.055, 0.16, 0.022, sx, 1.30, 0.185);      // hinge block
    k.box('copper', 0.035, 0.44, 0.012, sx, 1.06, 0.16);       // riser to the fuses
  }
  // porcelain fuse cans along the bottom
  // The can is 10mm longer than the hole it fills and sits back by half that,
  // so its rear cap lands at z 0.065 — clear of the slate's own back face at
  // z 0.075, which the can would otherwise share a plane with, and 15mm inside
  // the iron carcass (solid to z 0.08), which hides the cap completely. The
  // front cap stays at z 0.225 under the brass ferrule, so nothing moves.
  const CAN_BURY = 0.010;
  for (const sx of [-0.26, 0, 0.26]) {
    k.cyl('ceramic', 0.07, 0.07, 0.15 + CAN_BURY, 12, sx, 0.86, 0.15 - CAN_BURY / 2, { rx: Math.PI / 2 });
    k.cyl('brass', 0.05, 0.05, 0.02, 10, sx, 0.86, 0.235, { rx: Math.PI / 2 });
  }
  // conduit out of the top into the wall
  k.cyl('iron', 0.05, 0.05, 0.7, 10, 0.3, 2.45, -0.06);
  k.torus('iron', 0.09, 0.05, 5, 10, 0.3, 2.22, 0.03, { rx: Math.PI / 2, arc: Math.PI / 2 });
  k.cyl('iron', 0.036, 0.036, 0.5, 8, -0.34, 0.42, 0.02);
  k.finish(g, mats, { receiveShadow: true });

  // enamel warning plate
  const warnTex = signTexture('HAUPTSCHALTER', {
    w: 512, h: 176, seed: 83, bg: '#b8232a', fg: '#f2ead4',
    sub: 'HOCHSPANNUNG — LEBENSGEFAHR', subColor: 'rgba(242,234,212,0.78)',
    font: '"Arial Narrow", Arial, sans-serif', fontSize: 74,
  });
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.21), new THREE.MeshStandardMaterial({
    map: warnTex, roughness: 0.4, metalness: 0.0,
  }));
  warn.position.set(0, 2.02, 0.108);
  warn.castShadow = false; warn.receiveShadow = true;
  g.add(warn);

  const stencilMat = new THREE.MeshStandardMaterial({
    map: stencilTexture(['AUS', 'EIN'], { w: 256, h: 256, seed: 89, paint: '224,214,186', fontSize: 66, wear: 150 }),
    transparent: true, roughness: 0.85, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const stencil = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), stencilMat);
  stencil.position.set(-0.34, 1.58, 0.108);
  stencil.castShadow = false;
  g.add(stencil);

  // ---- the blade assembly: this is `power.lever` -----------------------------
  // Pivot stays exactly where the old lever pivoted so the reach target and the
  // cinematic's throw animation are unchanged.
  const lever = new THREE.Group();
  lever.position.set(0, 1.55, 0.22);
  lever.rotation.x = -0.7;
  const lk = new Kit(1.6);
  for (const sx of [-0.26, 0, 0.26]) {
    lk.box('copper', 0.05, 0.58, 0.014, sx, 0.29, 0);          // blade
    lk.cyl('brass', 0.018, 0.018, 0.07, 8, sx, 0.02, 0, { rz: Math.PI / 2 });
  }
  lk.box('bakelite', 0.70, 0.045, 0.045, 0, 0.56, 0.02);        // tie bar
  lk.cyl('bakelite', 0.035, 0.045, 0.20, 12, 0, 0.66, 0.02);    // handle
  lk.cyl('bakelite', 0.05, 0.038, 0.05, 12, 0, 0.77, 0.02);
  lk.finish(lever, mats, { receiveShadow: true });
  g.add(lever);

  // indicator lamp above the panel
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x2a1608, emissive: 0xffb04a, emissiveIntensity: 0.02, roughness: 0.3,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lampMat);
  bulb.position.set(0.30, 1.94, 0.14);
  bulb.castShadow = false;
  g.add(bulb);
  const glow = new THREE.PointLight(0xffb04a, 0, 3.2, 2);
  glow.position.set(0.30, 1.96, 0.28);
  g.add(glow);

  const update = (on, dt = 0.016) => {
    const t = on ? 1 : 0;
    const k = Math.min(1, dt * 5);
    lampMat.emissiveIntensity += (0.02 + t * 0.9 - lampMat.emissiveIntensity) * k;
    glow.intensity += (t * 3.2 - glow.intensity) * k;
  };

  return { group: g, lever, update };
}

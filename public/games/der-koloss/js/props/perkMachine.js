// Perk vending machine.
//
// A 1940s enamelled-steel dispenser that has spent a war in a factory: pressed
// body with rounded corner posts, a backlit marquee, a bottle window with real
// pressed-glass bottles on three shelves behind a dirty pane, a coin mechanism,
// a hinged dispensing flap, and rust weeping up from the kick plate.
//
// The whole machine is merged down to eight draw calls. Only the marquee, the
// interior backlight and the bottles are emissive, and they are driven from the
// machine's practical light so everything dies together when the power drops.
import * as THREE from 'three';
import { Kit, bottleProfile } from './build.js';
import { enamelMaps, ironMaterial, brassMaterial, shared, signTexture, stencilTexture, propMaterial } from './materials.js';

const FRONT = 0.31;          // front face of the cabinet body, local +Z
let sharedMats = null;

function getShared() {
  if (sharedMats) return sharedMats;
  sharedMats = {
    // Painted-and-chipped pressed steel, not bare metal: full metalness reads
    // as a black void in a room lit by two sodium bulbs.
    iron: ironMaterial({ color: 0xb4b9c1, roughness: 0.54, metalness: 0.5 }),
    brass: brassMaterial({ roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.92, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x2a3138, roughnessMap: shared.glassRough, roughness: 0.06, metalness: 0.0,
      transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide,
    }),
  };
  return sharedMats;
}

/**
 * @param {{id:string,name:string,price:number,color:number}} pd perk definition
 * @param {{displayPrice?:number}} [opts] override the price painted on the cabinet.
 *   Solo Quick Revive is charged at 500, not the roster's 1500, and the marquee
 *   the player is standing in front of must not contradict the buy prompt.
 * @returns {{group:THREE.Group, lamp:THREE.PointLight, panel:THREE.Mesh, update:Function}}
 */
export function buildPerkMachine(pd, opts = {}) {
  const g = new THREE.Group();
  const S = getShared();
  const shownPrice = opts.displayPrice ?? pd.price;
  const tint = new THREE.Color(pd.color);

  // Enamel is a saturated colour that has been indoors under sodium light for
  // years — pull it toward the wall rather than leaving it a UI swatch.
  const bodyTint = tint.clone().lerp(new THREE.Color(0x2a2b2e), 0.34).multiplyScalar(0.78);
  const enamel = enamelMaps(bodyTint.getHex(), 101, { chips: 130, rust: 0.55, grime: 0.6 });
  const enamelMat = propMaterial({
    map: enamel.map, normalMap: enamel.normalMap, roughnessMap: enamel.roughnessMap,
    color: 0xffffff, metalness: 0.35, roughness: 0.62,
    normalScale: new THREE.Vector2(0.9, 0.9),
  });

  // Backlit enamel marquee: the perk's colour is the field, the name is
  // knocked out in cream. That is where the colour identity lives, so the
  // cabinet itself can stay a grubby factory object.
  const marqueeTex = signTexture(pd.name.toUpperCase(), {
    w: 512, h: 148, seed: pd.id.charCodeAt(0) * 17 + 3,
    bg: '#' + tint.clone().lerp(new THREE.Color(0x120f0c), 0.34).getHexString(),
    fg: '#f4ecd6', borderColor: 'rgba(246,238,214,0.55)',
    sub: `${shownPrice} PUNKTE`, subColor: 'rgba(246,238,214,0.66)',
    fontSize: 74,
  });
  // Near-black albedo: the sign is lit from behind, so the machine's own
  // practical must not be able to wash the face out to white.
  const signMat = new THREE.MeshStandardMaterial({
    map: marqueeTex, emissiveMap: marqueeTex, emissive: 0xffffff, emissiveIntensity: 0.05,
    color: 0x0e0d0c, roughness: 0.5, metalness: 0.0,
  });
  // The cabinet interior is a dim warm cove light, not a colour swatch: the
  // bottles have to be the bright thing behind the glass.
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d0f, emissive: tint.clone().lerp(new THREE.Color(0xffe6c0), 0.55),
    emissiveIntensity: 0.03, roughness: 0.9, metalness: 0.0,
  });
  const bottleMat = new THREE.MeshStandardMaterial({
    color: tint.clone().multiplyScalar(0.5).getHex(),
    emissive: tint.clone().multiplyScalar(0.9),
    emissiveIntensity: 0.05, roughness: 0.11, metalness: 0.0,
  });
  // Works plate: a stencilled inventory number, not branding.
  const decalTex = stencilTexture(['WERK 115', `AUSG. ${shownPrice}`], {
    w: 384, h: 176, seed: pd.id.charCodeAt(1) * 31 + 7,
    paint: '26,22,16', wear: 120, blobs: 12, fontSizes: [64, 40],
  });
  const decalMat = new THREE.MeshStandardMaterial({
    map: decalTex, transparent: true, roughness: 0.72, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  const mats = { enamel: enamelMat, iron: S.iron, brass: S.brass, dark: S.dark, glow: glowMat };
  const k = new Kit(1.1);

  // Openings are real holes, not dark decals: the cabinet is a solid core with
  // a separate pressed front skin built as a frame around the window and the
  // dispensing tray, so both read as cavities with depth from any angle.
  const WY = 1.46, WW = 0.62, WH = 0.72;             // bottle window
  const W0 = WY - WH / 2, W1 = WY + WH / 2;          // 1.10 .. 1.82
  const TW = 0.48, T0 = 0.42, T1 = 0.62;             // dispensing tray
  const CORE_Z = 0.05;                               // front face of the core
  const SKIN_D = FRONT - CORE_Z;                     // 0.26 skin depth
  const SKIN_Z = (FRONT + CORE_Z) / 2;
  const BODY_Y0 = 0.18, BODY_Y1 = 2.02;
  // The corner posts run between exactly these two heights as well, so a shell
  // that also ends on them lands its top and bottom faces in the same planes as
  // eight post end caps — the top under the crown, the bottom in the plinth.
  // The shell is the member that runs past both joints: the plinth cap and the
  // crown cap each cover its whole footprint, so the overrun is buried, while
  // the posts stand outside both of them and would show.
  const SHELL_BURY = 0.005;
  const SHELL_Y0 = BODY_Y0 - SHELL_BURY;
  const SHELL_Y1 = BODY_Y1 + SHELL_BURY;

  // ---- plinth, feet, body shell -------------------------------------------
  k.box('iron', 1.06, 0.16, 0.72, 0, 0.08, 0);
  k.box('iron', 1.02, 0.03, 0.68, 0, 0.175, 0);
  for (const sx of [-0.44, 0.44]) for (const sz of [-0.28, 0.28]) k.cyl('iron', 0.035, 0.045, 0.05, 8, sx, 0.025, sz);
  k.box('enamel', 0.98, SHELL_Y1 - SHELL_Y0, 0.36, 0, (SHELL_Y0 + SHELL_Y1) / 2, -0.13);   // core
  k.box('enamel', 1.04, 0.08, 0.68, 0, 2.06, 0);            // crown cap
  k.box('iron', 0.90, 1.80, 0.05, 0, 1.10, -0.33);          // back panel
  // front skin — frame around both openings
  const skin = (x0, x1, y0, y1) => k.box('enamel', x1 - x0, y1 - y0, SKIN_D, (x0 + x1) / 2, (y0 + y1) / 2, SKIN_Z);
  skin(-0.49, 0.49, W1, SHELL_Y1);                   // above the window
  skin(-0.49, 0.49, T1, W0);                         // between window and tray
  skin(-0.49, 0.49, SHELL_Y0, T0);                   // below the tray
  skin(-0.49, -WW / 2, W0, W1);                      // window jambs
  skin(WW / 2, 0.49, W0, W1);
  skin(-0.49, -TW / 2, T0, T1);                      // tray jambs
  skin(TW / 2, 0.49, T0, T1);
  // pressed seam ribs
  k.box('iron', 1.00, 0.032, 0.645, 0, 1.94, 0);
  k.box('iron', 1.00, 0.032, 0.645, 0, 0.30, 0);
  // rounded corner posts — the period silhouette
  for (const sx of [-0.485, 0.485]) for (const sz of [-0.305, 0.305]) {
    k.cyl('iron', 0.058, 0.058, 1.84, 10, sx, 1.10, sz);
  }
  // conduit up the back to the wall
  k.cyl('iron', 0.026, 0.026, 1.5, 8, 0.34, 1.30, -0.36);
  k.torus('iron', 0.05, 0.026, 5, 8, 0.34, 2.05, -0.31, { rx: Math.PI / 2, ry: 0, arc: Math.PI / 2 });

  // ---- bottle window -------------------------------------------------------
  // recess liner: matte near-black so the lit bottles read as depth.
  //
  // Head and sill run the full width of the opening, so the jambs are cut to
  // the CLEAR span between them and the four sheets butt. Running both pairs
  // full length laps every corner, and because they share a depth the lap puts
  // two faces in one plane on the front, on the back and on the outer edge.
  const LINER_T = 0.014;                             // liner sheet thickness
  const clearSpan = (h) => h - 2 * LINER_T;          // jamb between head and sill
  // The back plate beds INTO the core rather than standing a millimetre off
  // it: that millimetre of air leaves the plate's own back face in the same
  // plane as the four sheets' backs. Only the back moves — the face the
  // player sees stays exactly where it was. Its edges run half a sheet past
  // the opening for the same reason: a plate cut to the opening lands all four
  // edges in the sheets' own outer faces, and a plate cut to the clear span
  // lands them a millimetre off the shelf ends. Half a sheet past, they die
  // inside solid liner and solid skin, where nothing can share a plane.
  const LINER_SINK = 0.008;
  const LINER_LET_IN = LINER_T / 2;
  const backPlate = (w, h, y) => k.box('dark', w + LINER_LET_IN * 2, h + LINER_LET_IN * 2, 0.012 + LINER_SINK,
    0, y, CORE_Z + 0.007 - LINER_SINK / 2);
  backPlate(WW, WH, WY);
  k.box('dark', WW, LINER_T, SKIN_D, 0, W1 - LINER_T / 2, SKIN_Z);
  k.box('dark', WW, LINER_T, SKIN_D, 0, W0 + LINER_T / 2, SKIN_Z);
  for (const sx of [-WW / 2 + LINER_T / 2, WW / 2 - LINER_T / 2]) k.box('dark', LINER_T, clearSpan(WH), SKIN_D, sx, WY, SKIN_Z);
  k.box('glow', WW - 0.08, WH - 0.07, 0.01, 0, WY, CORE_Z + 0.018);   // cove light
  // bezel + rivets on the face
  //
  // The bars are laid ON the skin, never sunk through it. A bar that crosses
  // the skin plane carries its inner face 0.5mm past the opening's jamb face
  // for the whole depth of the lap, and the two crawl against each other; its
  // end cap does the same against the skin's top face under the sill. Depth is
  // now the relief and nothing more, so no face the player sees has moved.
  const BEZEL_T = 0.055;                             // bar width
  const BEZEL_OFF = 0.028;                           // bar centre outboard of the opening edge
  const BEZEL_RELIEF = 0.022;                        // how far the bar stands proud of the skin
  const BEZEL_Z = FRONT + BEZEL_RELIEF / 2;
  // Head and sill run the full width, so the stiles are cut to the clear span
  // between them, exactly as the liner sheets are: lapped corners would put
  // both bright front faces in one plane.
  const BEZEL_CLEAR = WH + 2 * BEZEL_OFF - BEZEL_T;
  k.box('iron', WW + 0.13, BEZEL_T, BEZEL_RELIEF, 0, W1 + BEZEL_OFF, BEZEL_Z);
  k.box('iron', WW + 0.13, BEZEL_T, BEZEL_RELIEF, 0, W0 - BEZEL_OFF, BEZEL_Z);
  for (const sx of [-(WW / 2 + BEZEL_OFF), WW / 2 + BEZEL_OFF]) k.box('iron', BEZEL_T, BEZEL_CLEAR, BEZEL_RELIEF, sx, WY, BEZEL_Z);
  for (const sx of [-(WW / 2 + BEZEL_OFF), WW / 2 + BEZEL_OFF]) for (let i = 0; i < 4; i++) {
    k.rivet('iron', 0.011, sx, W0 + 0.09 + i * 0.18, FRONT + 0.024);
  }
  // shelves
  const shelfY = [W0 + 0.10, W0 + 0.34, W0 + 0.58];
  for (const sy of shelfY) k.box('iron', WW - 0.03, 0.014, 0.17, 0, sy, CORE_Z + 0.09);

  // ---- coin mechanism, data plate, handle ---------------------------------
  k.box('brass', 0.12, 0.24, 0.02, 0.33, 0.90, FRONT + 0.01);
  k.box('dark', 0.05, 0.012, 0.02, 0.33, 0.97, FRONT + 0.022);
  k.cyl('brass', 0.026, 0.026, 0.028, 12, 0.33, 0.83, FRONT + 0.022, { rx: Math.PI / 2 });
  k.rivet('brass', 0.008, 0.33, 0.79, FRONT + 0.02);
  k.box('brass', 0.24, 0.11, 0.014, -0.28, 0.90, FRONT + 0.007);   // works plate
  for (const sx of [-0.38, -0.18]) k.rivet('brass', 0.009, sx, 0.90, FRONT + 0.016);
  // dispensing handle — a knurled bakelite pull
  k.box('iron', 0.22, 0.05, 0.045, 0, 0.72, FRONT + 0.018);
  k.cyl('dark', 0.026, 0.026, 0.18, 10, 0, 0.72, FRONT + 0.05, { rz: Math.PI / 2 });

  // ---- dispensing tray -----------------------------------------------------
  // Same lining, same rules: jambs cut to the clear span, back plate bedded in.
  backPlate(TW, T1 - T0, (T0 + T1) / 2);
  k.box('dark', TW, LINER_T, SKIN_D, 0, T1 - LINER_T / 2, SKIN_Z);
  k.box('dark', TW, LINER_T, SKIN_D, 0, T0 + LINER_T / 2, SKIN_Z);
  for (const sx of [-TW / 2 + LINER_T / 2, TW / 2 - LINER_T / 2]) k.box('dark', LINER_T, clearSpan(T1 - T0), SKIN_D, sx, (T0 + T1) / 2, SKIN_Z);
  k.box('iron', TW - 0.03, 0.19, 0.018, 0, T1 - 0.075, CORE_Z + 0.10, { rx: -0.38 });  // hinged flap
  k.box('iron', TW + 0.08, 0.035, 0.065, 0, T0 - 0.02, FRONT - 0.005);                  // catch lip

  // ---- marquee -------------------------------------------------------------
  k.box('iron', 1.10, 0.38, 0.66, 0, 2.25, 0);
  k.box('iron', 1.16, 0.045, 0.22, 0, 2.46, 0.25, { rx: 0.34 });   // lamp hood
  for (const sx of [-0.5, 0.5]) for (const sy of [2.11, 2.39]) k.rivet('iron', 0.014, sx, sy, 0.335);

  const parts = k.finish(g, mats, { receiveShadow: true });

  // Sign face sits proud of the housing so the hood casts onto it.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.26), signMat);
  sign.position.set(0, 2.25, 0.336);
  sign.castShadow = false;
  g.add(sign);
  parts.signFace = sign;

  // Works number stencilled onto the brass plate — period paperwork, not a logo.
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.10), decalMat);
  decal.position.set(-0.28, 0.90, FRONT + 0.016);
  decal.castShadow = false; decal.receiveShadow = true;
  g.add(decal);

  // ---- bottles -------------------------------------------------------------
  const bottleGeo = new THREE.LatheGeometry(bottleProfile(1.0), 9);
  const bottles = new THREE.InstancedMesh(bottleGeo, bottleMat, 9);
  bottles.castShadow = false;
  bottles.receiveShadow = false;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  let bi = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      pos.set(-0.185 + c * 0.185, shelfY[r] + 0.008, CORE_Z + 0.09);
      q.setFromAxisAngle(yAxis, (r * 1.7 + c * 2.3) % 6.28);
      m4.compose(pos, q, scl);
      bottles.setMatrixAt(bi++, m4);
    }
  }
  bottles.instanceMatrix.needsUpdate = true;
  g.add(bottles);

  // ---- glass pane ----------------------------------------------------------
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(WW - 0.01, WH - 0.01), S.glass);
  pane.position.set(0, WY, FRONT - 0.012);
  pane.renderOrder = 2;
  g.add(pane);

  // ---- practical -----------------------------------------------------------
  // Tight and low: this is a machine glow, not room lighting. Before the light
  // pool started ranking on world positions this lamp barely reached anything,
  // so its old 7m reach flooded the whole corridor once it did.
  const lamp = new THREE.PointLight(pd.color, 0.0, 4.2, 2);
  lamp.position.set(0, 1.92, 0.62);
  g.add(lamp);

  // The game snaps `lamp.intensity` from 0 to 9 the instant the mains come up.
  // A backlit sign has a tube that has to strike, so the emissives ease in
  // rather than popping with it.
  let litSmooth = 0;
  const update = (dt = 0.016) => {
    // 0 with the power off, 9 with it on (10 while the drink jingle peaks).
    const want = Math.min(1, lamp.intensity / 9);
    litSmooth += (want - litSmooth) * Math.min(1, dt * 4.5);
    const lit = litSmooth;
    // Only the knocked-out lettering crosses the bloom threshold; the coloured
    // field stays under it, so the marquee glows without becoming a white slab.
    // Scene-linear values: the composite applies a 2.45 exposure on top, so a
    // backlit enamel face wants ~0.5 here. Anything near 1 clips to white.
    signMat.emissiveIntensity = 0.03 + lit * 0.52;
    glowMat.emissiveIntensity = 0.01 + lit * 0.11;
    bottleMat.emissiveIntensity = 0.03 + lit * 0.34;
  };

  return { group: g, lamp, panel: parts.signFace, signMat, update };
}

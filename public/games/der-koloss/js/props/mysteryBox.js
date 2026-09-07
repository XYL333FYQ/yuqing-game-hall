// Mystery box: a heavy wooden shipping crate and its light beacon.
//
// The crate is real boarding — corner battens, five planks a face, iron banding
// riveted over the joints, back hinges, a padlock hasp and stencilled transit
// markings.
//
// The beacon replaces the flat translucent cylinder that gave the old box away
// as a game object. It is a tapered shell whose brightness follows the angle
// between the surface and the eye, so the column is dense down its axis and
// dissolves at the silhouette instead of ending on a hard edge; it fades out
// with height, softens where it meets the crate lid, carries slow vertical
// striations, and has dust drifting up through it.
import * as THREE from 'three';
import { Kit } from './build.js';
import { ironMaterial, shared, stencilTexture, propMaterial } from './materials.js';

const BEAM_VERT = /* glsl */`
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vH = uv.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const BEAM_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;
uniform float uEdge;
uniform float uFade;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vH;
void main() {
  vec3 V = normalize(cameraPosition - vWorldPos);
  // Facing-ness across the shell: 1 down the axis of the column, 0 at its
  // silhouette. This is what makes the beam soft-edged instead of a tube.
  float facing = abs(dot(normalize(vWorldNormal), V));
  float core = pow(facing, uEdge);
  float h = clamp(vH, 0.0, 1.0);
  float fade = pow(1.0 - h, uFade);
  float foot = smoothstep(0.0, 0.05, h);
  // slow striations — light picking out drifting dust bands
  float bands = sin(h * 16.0 - uTime * 0.55) * 0.5 + 0.5;
  bands = mix(0.78, 1.06, bands * bands);
  float flick = 0.94 + 0.06 * sin(uTime * 2.3) * sin(uTime * 0.77);
  float a = core * fade * foot * bands * flick * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

function moteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,246,225,0.55)');
  grad.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function flareTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,250,238,0.95)');
  grad.addColorStop(0.25, 'rgba(255,232,190,0.42)');
  grad.addColorStop(0.6, 'rgba(240,214,170,0.12)');
  grad.addColorStop(1, 'rgba(230,200,160,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @returns {{group:THREE.Group, lid:THREE.Group, light:THREE.PointLight, update:Function}}
 */
export function buildMysteryBox() {
  const g = new THREE.Group();

  const wood = shared.planks;
  const woodMat = propMaterial({
    map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap,
    color: 0x9c8a70, roughness: 0.95, metalness: 0.0,
    normalScale: new THREE.Vector2(1.25, 1.25),
  });
  const bandMat = ironMaterial({ color: 0xcbc6ba, roughness: 0.7, metalness: 0.5 });
  const lockMat = ironMaterial({ color: 0xe0dcd2, roughness: 0.48, metalness: 0.6 });

  const markTex = stencilTexture(['?'], {
    w: 256, h: 256, seed: 91, paint: '236,224,190', fontSize: 210, wear: 300, blobs: 30,
  });
  const markMat = new THREE.MeshStandardMaterial({
    map: markTex, transparent: true, roughness: 0.9, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const sideTex = stencilTexture(['WEHRMACHT', 'Nr. 115', 'NICHT STÜRZEN'], {
    w: 512, h: 256, seed: 97, paint: '224,212,182', fontSizes: [58, 74, 40], wear: 340, blobs: 34,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex, transparent: true, roughness: 0.9, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  const mats = { wood: woodMat, band: bandMat, lock: lockMat };
  const HW = 0.75, HD = 0.425, BH = 0.86;   // half width, half depth, body height

  // ---- crate body ----------------------------------------------------------
  const k = new Kit(1.5);
  k.box('wood', HW * 2 - 0.02, 0.05, HD * 2 - 0.02, 0, 0.025, 0);            // floor
  // corner battens
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.box('wood', 0.10, BH, 0.10, sx * (HW - 0.05), BH / 2, sz * (HD - 0.05));
  }
  // boarding: five planks a face, with real gaps
  for (let i = 0; i < 5; i++) {
    const y = 0.09 + i * 0.175;
    for (const sz of [-1, 1]) k.box('wood', HW * 2 - 0.20, 0.165, 0.05, 0, y, sz * (HD - 0.025));
    for (const sx of [-1, 1]) k.box('wood', 0.05, 0.165, HD * 2 - 0.20, sx * (HW - 0.025), y, 0);
  }
  // iron banding: two straps a face plus a rim at top and bottom
  for (const sx of [-0.40, 0.40]) {
    k.box('band', 0.075, BH, 0.010, sx, BH / 2, HD + 0.002);
    k.box('band', 0.075, BH, 0.010, sx, BH / 2, -HD - 0.002);
    for (let i = 0; i < 4; i++) k.rivet('band', 0.012, sx, 0.12 + i * 0.22, HD + 0.012);
    for (let i = 0; i < 4; i++) k.rivet('band', 0.012, sx, 0.12 + i * 0.22, -HD - 0.012, '-z');
  }
  for (const sz of [-0.22, 0.22]) {
    k.box('band', 0.010, BH, 0.075, HW + 0.002, BH / 2, sz);
    k.box('band', 0.010, BH, 0.075, -HW - 0.002, BH / 2, sz);
  }
  const RIM_Y = [0.055, BH - 0.05], RIM_H = 0.055;   // rim band centres, and band height
  for (const y of RIM_Y) {
    k.box('band', HW * 2 + 0.012, RIM_H, 0.010, 0, y, HD + 0.004);
    k.box('band', HW * 2 + 0.012, RIM_H, 0.010, 0, y, -HD - 0.004);
    k.box('band', 0.010, RIM_H, HD * 2 + 0.012, HW + 0.004, y, 0);
    k.box('band', 0.010, RIM_H, HD * 2 + 0.012, -HW - 0.004, y, 0);
  }
  // corner angle irons
  // A rim already crosses every corner at the same 10mm strap thickness, so an
  // angle iron carried in one piece from A_LO to A_HI doubles up over both of
  // them — 0.19 m2 of two straps in one plane, on the front, the back and both
  // outer edges. The iron is cut into the three clear runs the rims leave, the
  // way a real strap is cut where the rim laps it. The silhouette is unchanged:
  // each gap is filled by the rim, in the same metal at the same depth.
  const A_LO = -0.005, A_HI = BH + 0.005;
  const CORNER_RUNS = [
    [A_LO, RIM_Y[0] - RIM_H / 2],
    [RIM_Y[0] + RIM_H / 2, RIM_Y[1] - RIM_H / 2],
    [RIM_Y[1] + RIM_H / 2, A_HI],
  ];
  // Each leg stops on the BACK plane of the leg it turns into (CI_X1 / CI_Z1)
  // instead of running the last millimetre out to the crate's own skin. Carried
  // to HW (or HD) the leg's end cap lands exactly in the corner batten's outer
  // face — a cap flush with the skin the strap wraps, and the same-facing pair
  // the batten cannot be separated from. Butting on the joint plane closes the
  // mitre against the other leg, which begins there.
  // The stand-off is HALF THE THICKNESS, which lands the strap's inner face
  // exactly on the crate's skin rather than a millimetre inside it. Inside it,
  // the leg's end cap ends up a millimetre short of the corner batten's outer
  // face and pointing the same way — the last coplanar pair on the crate. Sat
  // on the skin, the cap lands ON that face instead, where the two meet along a
  // line and share no area, and the strap's own inner face is back-to-back with
  // the boarding, which can never fight.
  const CI_T = 0.010, CI_OFF = CI_T / 2, CI_W = 0.11;   // thickness, stand-off, leg width
  const CI_X0 = HW - CI_W, CI_X1 = HW + CI_OFF - CI_T / 2;
  const CI_Z0 = HD - CI_W, CI_Z1 = HD + CI_OFF - CI_T / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [y0, y1] of CORNER_RUNS) {
      const h = y1 - y0, yc = (y0 + y1) / 2;
      k.box('band', CI_X1 - CI_X0, h, CI_T, sx * (CI_X0 + CI_X1) / 2, yc, sz * (HD + CI_OFF));
      k.box('band', CI_T, h, CI_Z1 - CI_Z0, sx * (HW + CI_OFF), yc, sz * (CI_Z0 + CI_Z1) / 2);
    }
  }
  // hasp staple on the front, waiting for the lid's hasp
  k.box('lock', 0.09, 0.10, 0.014, 0, BH - 0.08, HD + 0.012);
  k.box('lock', 0.028, 0.05, 0.03, 0, BH - 0.045, HD + 0.03);
  // padlock hanging off it
  k.box('lock', 0.055, 0.07, 0.024, 0, BH - 0.115, HD + 0.045);
  k.torus('lock', 0.024, 0.007, 5, 10, 0, BH - 0.075, HD + 0.045, { arc: Math.PI });
  // hinge leaves at the back
  for (const sx of [-0.38, 0.38]) {
    k.box('lock', 0.10, 0.075, 0.012, sx, BH - 0.06, -HD - 0.012);
    k.cyl('lock', 0.015, 0.015, 0.11, 8, sx, BH + 0.01, -HD - 0.018, { rz: Math.PI / 2 });
  }
  k.finish(g, mats, { receiveShadow: true });

  // stencils on the four faces
  const markGeo = [];
  const mkQuad = (w, h, x, y, z, ry) => {
    const q = new THREE.PlaneGeometry(w, h);
    q.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
    return q;
  };
  markGeo.push(mkQuad(0.42, 0.42, 0, 0.50, HD + 0.031, 0));
  markGeo.push(mkQuad(0.42, 0.42, 0, 0.50, -HD - 0.031, Math.PI));
  const marks = new THREE.Mesh(mergeQuads(markGeo), markMat);
  marks.castShadow = false; marks.receiveShadow = true;
  g.add(marks);
  const sideGeo = [];
  sideGeo.push(mkQuad(0.52, 0.26, HW + 0.031, 0.48, 0, Math.PI / 2));
  sideGeo.push(mkQuad(0.52, 0.26, -HW - 0.031, 0.48, 0, -Math.PI / 2));
  const sides = new THREE.Mesh(mergeQuads(sideGeo), sideMat);
  sides.castShadow = false; sides.receiveShadow = true;
  g.add(sides);

  // ---- lid -----------------------------------------------------------------
  // Pivot on the real hinge line at the back top edge; the geometry is authored
  // forward of it so the lid stands up and back when it opens.
  const lid = new THREE.Group();
  lid.position.set(0, BH, -HD + 0.005);
  const lk = new Kit(1.5);
  const LY = 0.075, LZ = HD - 0.005;      // offsets from the hinge to lid centre
  lk.box('wood', HW * 2 + 0.03, 0.06, HD * 2 + 0.03, 0, LY, LZ);
  lk.box('wood', HW * 2 - 0.02, 0.05, 0.09, 0, LY - 0.055, LZ + HD - 0.05);   // cleats
  lk.box('wood', HW * 2 - 0.02, 0.05, 0.09, 0, LY - 0.055, LZ - HD + 0.05);
  // The two cross straps run the full width of the lid at the same height and
  // the same 12mm thickness as the longitudinal pair, so carrying a
  // longitudinal strap through in one piece laps them at four crossings — two
  // straps in the lid's top plane, 0.021 m2 of it. The longitudinal straps are
  // cut into the runs the cross straps leave and butt into them; each crossing
  // still reads as unbroken metal because the cross strap fills the cut at the
  // same height, and the 35mm ends that turn over the lid edge are untouched.
  const XSTRAP_Z = [LZ - HD + 0.05, LZ + HD - 0.05], XSTRAP_D = 0.07;
  const STRAP_RUNS = [
    [LZ - HD - 0.02, XSTRAP_Z[0] - XSTRAP_D / 2],
    [XSTRAP_Z[0] + XSTRAP_D / 2, XSTRAP_Z[1] - XSTRAP_D / 2],
    [XSTRAP_Z[1] + XSTRAP_D / 2, LZ + HD + 0.02],
  ];
  for (const sx of [-0.40, 0.40]) {
    for (const [z0, z1] of STRAP_RUNS) {
      lk.box('band', 0.075, 0.012, z1 - z0, sx, LY + 0.036, (z0 + z1) / 2);
    }
    for (const sz of [-0.28, 0.28]) lk.rivet('band', 0.012, sx, LY + 0.046, LZ + sz, 'y');
  }
  lk.box('band', HW * 2 + 0.04, 0.012, XSTRAP_D, 0, LY + 0.036, XSTRAP_Z[1]);
  lk.box('band', HW * 2 + 0.04, 0.012, XSTRAP_D, 0, LY + 0.036, XSTRAP_Z[0]);
  // hasp tongue reaching down over the staple
  lk.box('lock', 0.075, 0.012, 0.10, 0, LY - 0.03, LZ + HD + 0.005);
  lk.box('lock', 0.075, 0.09, 0.012, 0, LY - 0.075, LZ + HD + 0.048);
  lk.finish(lid, mats, { receiveShadow: true });
  g.add(lid);

  // ---- beacon --------------------------------------------------------------
  // Both shells of the tube add, and the core column adds on top of that, so
  // the per-shell intensity is deliberately low: the composite then applies a
  // 2.45 exposure. Anything near 0.3 here comes out as a solid white cone.
  const beamUniforms = {
    uColor: { value: new THREE.Color(0xffd0a2) },
    uTime: { value: 0 },
    uIntensity: { value: 0.085 },
    uEdge: { value: 2.6 },
    uFade: { value: 2.2 },
  };
  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 0.44, 14, 22, 1, true), beamMat);
  beam.position.y = 0.98 + 7;
  beam.frustumCulled = false;
  g.add(beam);

  // A tighter, hotter inner column so the beacon has a visible core.
  const coreUniforms = {
    uColor: { value: new THREE.Color(0xffe6c4) },
    uTime: { value: 0 },
    uIntensity: { value: 0.10 },
    uEdge: { value: 1.5 },
    uFade: { value: 3.0 },
  };
  const coreMat = beamMat.clone();
  coreMat.uniforms = coreUniforms;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.20, 8, 16, 1, true), coreMat);
  core.position.y = 0.98 + 4;
  core.frustumCulled = false;
  g.add(core);

  // Base flare where the column leaves the lid — the light has to come from
  // somewhere physical.
  const flareMat = new THREE.MeshBasicMaterial({
    map: flareTexture(), color: 0xffd9a4, transparent: true, opacity: 0.24,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const flare = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), flareMat);
  flare.rotation.x = -Math.PI / 2;
  flare.position.y = 0.995;
  g.add(flare);

  // ---- motes ---------------------------------------------------------------
  const MOTES = 64;
  const motePos = new Float32Array(MOTES * 3);
  const moteVel = new Float32Array(MOTES);
  const moteR = new Float32Array(MOTES);
  const moteA = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    moteR[i] = 0.06 + Math.random() * 0.42;
    moteA[i] = Math.random() * Math.PI * 2;
    moteVel[i] = 0.10 + Math.random() * 0.26;
    const h = Math.random() * 5.2;
    motePos[i * 3] = Math.cos(moteA[i]) * moteR[i] * (1 + h * 0.13);
    motePos[i * 3 + 1] = 1.0 + h;
    motePos[i * 3 + 2] = Math.sin(moteA[i]) * moteR[i] * (1 + h * 0.13);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    map: moteTexture(), color: 0xffdcae, size: 0.022, sizeAttenuation: true,
    transparent: true, opacity: 0.5, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }));
  motes.frustumCulled = false;
  g.add(motes);

  // ---- practical -----------------------------------------------------------
  const light = new THREE.PointLight(0xffc266, 9, 7, 1.8);
  light.position.y = 1.6;
  g.add(light);

  const update = (dt, time) => {
    beamUniforms.uTime.value = time;
    coreUniforms.uTime.value = time;
    flareMat.opacity = 0.22 + Math.sin(time * 1.7) * 0.03 + Math.sin(time * 0.53) * 0.02;
    const arr = moteGeo.attributes.position.array;
    for (let i = 0; i < MOTES; i++) {
      let y = arr[i * 3 + 1] + dt * moteVel[i];
      if (y > 6.4) y = 1.0;
      const h = y - 1.0;
      const a = moteA[i] + time * 0.12 * (i % 2 ? 1 : -1);
      const r = moteR[i] * (1 + h * 0.13);
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    moteGeo.attributes.position.needsUpdate = true;
  };

  return { group: g, lid, light, update };
}

function mergeQuads(geos) {
  // PlaneGeometry sets are trivially concatenable — same attributes, same order.
  let total = 0;
  for (const gm of geos) total += gm.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const idx = [];
  let vo = 0;
  for (const gm of geos) {
    pos.set(gm.attributes.position.array, vo * 3);
    nor.set(gm.attributes.normal.array, vo * 3);
    uv.set(gm.attributes.uv.array, vo * 2);
    const gi = gm.index.array;
    for (let i = 0; i < gi.length; i++) idx.push(gi[i] + vo);
    vo += gm.attributes.position.count;
    gm.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

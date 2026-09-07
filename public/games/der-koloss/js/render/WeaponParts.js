// Reusable procedural firearm sub-assemblies for the first-person view-models.
//
// Every geometry produced here goes through `geo()`, a module-level cache keyed
// on the exact construction parameters. Thirty weapons share one bevelled 40mm
// receiver box, one 16-segment barrel profile, one trigger-guard extrusion and
// so on, which keeps both build cost and GPU memory flat no matter how often
// buildViewmodel() runs (the mystery box rebuilds a gun every spin).
//
// Cached geometries are tagged `userData.wpShared` so the Pack-a-Punch display
// teardown knows not to dispose them out from under every other weapon.
import * as THREE from 'three';
import { WM } from './WeaponMaterials.js';

const _geo = new Map();
const key = (name, args) => name + '|' + args.map((v) => (typeof v === 'number' ? v.toFixed(5) : v)).join(',');

/** Cache + tag a geometry. */
export function geo(name, args, make) {
  const k = key(name, args);
  let g = _geo.get(k);
  if (!g) {
    g = make();
    g.userData.wpShared = true;
    _geo.set(k, g);
  }
  return g;
}

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

/** Rounded rectangle path used as the profile for chamfered extrusions. */
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  r = Math.min(r, hw * 0.98, hh * 0.98);
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

/**
 * Chamfered box. Real gun parts have broken edges; a hard 90° corner is the
 * single biggest "programmer art" tell at view-model distance because it never
 * catches a specular highlight.
 */
export function bevelBoxGeo(w, h, d, b = 0.004, corner = 0) {
  return geo('bbox', [w, h, d, b, corner], () => {
    const bb = Math.min(b, w * 0.4, h * 0.4, d * 0.4);
    const r = Math.max(bb * 1.2, corner);
    const shape = roundedRect(Math.max(1e-4, w - 2 * bb), Math.max(1e-4, h - 2 * bb), r);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(1e-4, d - 2 * bb), bevelEnabled: true,
      bevelThickness: bb, bevelSize: bb, bevelSegments: 1, curveSegments: 2,
    });
    g.translate(0, 0, -(d - 2 * bb) / 2);
    g.computeVertexNormals();
    return g;
  });
}

/**
 * Extruded plate from an arbitrary point list (receiver side profiles, stock
 * combs, trigger guards). Points are in the XY plane; thickness runs along Z.
 */
export function plateGeo(id, pts, thick, bevel = 0.0025, holes = null) {
  return geo('plate', [id, thick, bevel], () => {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    if (holes) {
      for (const hp of holes) {
        const p = new THREE.Path();
        p.moveTo(hp[0][0], hp[0][1]);
        for (let i = 1; i < hp.length; i++) p.lineTo(hp[i][0], hp[i][1]);
        p.closePath();
        shape.holes.push(p);
      }
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(1e-4, thick - 2 * bevel), bevelEnabled: bevel > 0,
      bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3,
    });
    g.translate(0, 0, -(thick - 2 * bevel) / 2);
    g.computeVertexNormals();
    return g;
  });
}

export function cylGeo(r0, r1, len, seg = 16, open = false, thetaLen = Math.PI * 2, thetaStart = 0) {
  return geo('cyl', [r0, r1, len, seg, open ? 1 : 0, thetaLen, thetaStart], () =>
    new THREE.CylinderGeometry(r0, r1, len, seg, 1, open, thetaStart, thetaLen));
}

export function sphereGeo(r, w = 10, h = 8) {
  return geo('sph', [r, w, h], () => new THREE.SphereGeometry(r, w, h));
}

export function torusGeo(r, tube, rs = 6, ts = 18, arc = Math.PI * 2) {
  return geo('tor', [r, tube, rs, ts, arc], () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
}

export function ringGeo(ri, ro, seg = 20) {
  return geo('ring', [ri, ro, seg], () => new THREE.RingGeometry(ri, ro, seg));
}

/** Lathe a profile given as [radius, axialPosition] pairs, axis along +Z. */
export function latheGeo(id, pts, seg = 20) {
  return geo('lathe', [id, seg], () => {
    const v = pts.map(([r, z]) => new THREE.Vector2(Math.max(1e-5, r), z));
    const g = new THREE.LatheGeometry(v, seg);
    g.rotateX(Math.PI / 2);   // Y-axis lathe -> Z-forward part
    g.computeVertexNormals();
    return g;
  });
}

// ---------------------------------------------------------------------------
// mesh sugar
// ---------------------------------------------------------------------------
export function mesh(g, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

/** Chamfered box mesh. */
export function bx(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, b = 0.0035) {
  return mesh(bevelBoxGeo(w, h, d, b), mat, x, y, z, rx, ry, rz);
}

/** Z-forward cylinder mesh (rotated so the default axis points down -Z/+Z). */
export function cyl(r0, r1, len, mat, x = 0, y = 0, z = 0, rx = Math.PI / 2, ry = 0, rz = 0, seg = 16) {
  return mesh(cylGeo(r0, r1, len, seg), mat, x, y, z, rx, ry, rz);
}

// ---------------------------------------------------------------------------
// barrels & muzzles
// ---------------------------------------------------------------------------

/**
 * A barrel with a genuinely hollow muzzle: open-ended tube, a machined crown
 * annulus at the front face and a dark bore sunk into it. The dark bore is the
 * single highest-value detail on a view-model — it is the difference between
 * "a gun" and "a grey cylinder".
 *
 * The returned group is centred on the barrel length; +Z is toward the shooter,
 * so the muzzle sits at local z = -len/2.
 */
export function barrel(mat, {
  r = 0.014, rMuzzle = null, bore = null, len = 0.4, seg = 18,
  boreDepth = 0.055, breechCap = true,
} = {}) {
  const g = new THREE.Group();
  const r1 = rMuzzle ?? r;
  const rb = bore ?? Math.max(0.0035, r1 * 0.5);
  g.add(mesh(cylGeo(r1, r, len, seg, true), mat, 0, 0, 0, Math.PI / 2));
  // machined crown ring at the muzzle face
  const crown = mesh(ringGeo(rb, r1, seg), mat, 0, 0, -len / 2);
  crown.rotation.y = Math.PI;
  g.add(crown);
  // rifled bore: dark tube seen from the front, plus a blind end
  const boreTube = mesh(cylGeo(rb, rb * 0.86, Math.min(boreDepth, len * 0.9), Math.max(10, seg - 4), true),
    WM.bore, 0, 0, -len / 2 + Math.min(boreDepth, len * 0.9) / 2, Math.PI / 2);
  g.add(boreTube);
  g.add(mesh(cylGeo(rb * 0.86, rb * 0.86, 0.002, 10), WM.bore, 0, 0, -len / 2 + Math.min(boreDepth, len * 0.9), Math.PI / 2));
  if (breechCap) g.add(mesh(cylGeo(r, r, 0.002, seg), mat, 0, 0, len / 2 - 0.001, Math.PI / 2));
  return g;
}

/**
 * Bake a list of {geometry, matrix} pairs into one BufferGeometry.
 *
 * three's BufferGeometryUtils lives in `three/addons`, which this project's
 * import map does not expose, so this is a deliberately minimal stand-in: it
 * only handles position/normal/uv, which is all any geometry built here has.
 */
function bake(parts) {
  let vCount = 0, iCount = 0;
  for (const { geometry: G } of parts) {
    vCount += G.attributes.position.count;
    iCount += G.index ? G.index.count : G.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  let vo = 0, io = 0;
  for (const { geometry: G, matrix } of parts) {
    nm.getNormalMatrix(matrix);
    const p = G.attributes.position, n = G.attributes.normal, t = G.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix).toArray(pos, (vo + i) * 3);
      if (n) v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize().toArray(nrm, (vo + i) * 3);
      if (t) { uv[(vo + i) * 2] = t.getX(i); uv[(vo + i) * 2 + 1] = t.getY(i); }
    }
    if (G.index) for (let i = 0; i < G.index.count; i++) idx[io + i] = G.index.getX(i) + vo;
    else for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
    io += G.index ? G.index.count : p.count;
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/**
 * Perforated barrel shroud with REAL holes: solid bands are full cylinders and
 * each hole row is built from arc segments with genuine gaps between them.
 *
 * A seven-row MG42 shroud is forty-odd primitives, so the whole thing is baked
 * down to one cached geometry — it is static decoration and every weapon that
 * asks for the same dimensions reuses it.
 */
export function perfShroud(mat, {
  r = 0.03, len = 0.4, rows = 4, holes = 8, holeW = 0.42, band = 0.4, seg = 4,
} = {}) {
  const g = geo('shroud', [r, len, rows, holes, holeW, band, seg], () => {
    const parts = [];
    const push = (G, z, arcStart) => {
      const m = new THREE.Matrix4()
        .makeRotationX(Math.PI / 2)
        .premultiply(new THREE.Matrix4().makeTranslation(0, 0, z));
      void arcStart;
      parts.push({ geometry: G, matrix: m });
    };
    const cell = len / rows;
    const bandLen = cell * band, slotLen = cell - bandLen;
    const step = (Math.PI * 2) / holes;
    const arc = step * (1 - holeW);
    for (let i = 0; i < rows; i++) {
      const z0 = -len / 2 + i * cell;
      push(cylGeo(r, r, bandLen, 20, true), z0 + bandLen / 2);
      for (let h = 0; h < holes; h++) {
        push(cylGeo(r, r, slotLen, seg, true, arc, h * step), z0 + bandLen + slotLen / 2);
      }
    }
    push(cylGeo(r, r, bandLen, 20, true), len / 2 - bandLen / 2);
    return bake(parts);
  });
  const out = new THREE.Group();
  out.add(new THREE.Mesh(g, mat));
  return out;
}

/** Prong-type flash hider. */
export function flashHider(mat, { r = 0.016, len = 0.055, prongs = 3, bore = 0.007 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo('fh' + r.toFixed(4) + len.toFixed(4), [
    [bore, -len * 0.5], [r * 0.95, -len * 0.5], [r * 1.05, -len * 0.28],
    [r * 1.05, len * 0.1], [r * 0.86, len * 0.3], [r * 0.86, len * 0.5], [bore, len * 0.5],
  ], 18), mat));
  for (let i = 0; i < prongs; i++) {
    const a = (i / prongs) * Math.PI * 2 + Math.PI / 2;
    g.add(mesh(bevelBoxGeo(r * 0.5, r * 0.42, len * 0.5, 0.0012), mat,
      Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, -len * 0.68, 0, 0, -a));
  }
  g.add(mesh(cylGeo(bore, bore, len * 1.1, 12, true), WM.bore, 0, 0, 0, Math.PI / 2));
  g.add(mesh(cylGeo(bore, bore, 0.002, 12), WM.bore, 0, 0, len * 0.3, Math.PI / 2));
  return g;
}

/** Slotted muzzle brake / compensator. */
export function compensator(mat, { r = 0.018, len = 0.06, ports = 3, bore = 0.008 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cylGeo(r, r * 1.06, len, 18, true), mat, 0, 0, 0, Math.PI / 2));
  g.add(mesh(ringGeo(bore, r, 18), mat, 0, 0, -len / 2, 0, Math.PI, 0));
  g.add(mesh(cylGeo(bore, bore * 0.9, len * 0.9, 12, true), WM.bore, 0, 0, -len / 2 + len * 0.45, Math.PI / 2));
  g.add(mesh(cylGeo(bore * 0.9, bore * 0.9, 0.002, 12), WM.bore, 0, 0, -len / 2 + len * 0.9, Math.PI / 2));
  for (let i = 0; i < ports; i++) {
    const z = -len / 2 + len * (0.22 + i * 0.26);
    for (const sx of [1, -1]) {
      g.add(mesh(bevelBoxGeo(r * 0.5, r * 0.34, len * 0.13, 0.0008), WM.cavity, sx * r * 0.86, r * 0.42, z));
    }
    g.add(mesh(bevelBoxGeo(r * 0.9, r * 0.3, len * 0.13, 0.0008), WM.cavity, 0, r * 0.95, z));
  }
  g.add(mesh(cylGeo(r * 1.1, r * 1.1, 0.006, 18), mat, 0, 0, len / 2 - 0.003, Math.PI / 2));
  return g;
}

/** Cone-type flash cone (Thompson / PPSh style) or a plain crowned step. */
export function muzzleCone(mat, { r = 0.016, r2 = 0.026, len = 0.05, bore = 0.008 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo('mc' + r + '_' + r2 + '_' + len, [
    [bore, -len / 2], [r2, -len / 2], [r2 * 0.94, -len * 0.34], [r, len * 0.2], [r, len / 2], [bore, len / 2],
  ], 18), mat));
  g.add(mesh(cylGeo(bore, bore * 0.85, len, 12, true), WM.bore, 0, 0, 0, Math.PI / 2));
  g.add(mesh(cylGeo(bore * 0.85, bore * 0.85, 0.002, 12), WM.bore, 0, 0, len * 0.45, Math.PI / 2));
  return g;
}

/** Cylindrical suppressor / jacket with end caps and a hollow exit. */
export function suppressor(mat, { r = 0.024, len = 0.16, bore = 0.008, rings = 5 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo('sup' + r + '_' + len, [
    [bore, -len / 2], [r * 0.9, -len / 2], [r, -len / 2 + 0.008],
    [r, len / 2 - 0.008], [r * 0.9, len / 2], [bore, len / 2],
  ], 20), mat));
  for (let i = 0; i < rings; i++) {
    g.add(mesh(torusGeo(r * 1.02, r * 0.06, 5, 18), mat,
      0, 0, -len / 2 + len * ((i + 0.7) / (rings + 0.4))));
  }
  g.add(mesh(cylGeo(bore, bore, len, 12, true), WM.bore, 0, 0, 0, Math.PI / 2));
  g.add(mesh(cylGeo(bore, bore, 0.002, 12), WM.bore, 0, 0, len * 0.4, Math.PI / 2));
  return g;
}

// ---------------------------------------------------------------------------
// sights
//
// Every sight below is authored against one number, `aimY`: the line of sight.
// Which FEATURE of a sight lands on that line is not a free choice — it is the
// thing the shooter aligns, and getting it wrong makes the sight unusable no
// matter how good the model looks in the hand.
//
//   front sight     the TOP of the post
//   open notch      the TOP OF THE SHOULDERS, with the notch cut below them
//   peep / aperture the CENTRE of the hole
//   optic           the axis of the glass
//
// The notch used to put its FLOOR on the line instead of its shoulders. Because
// the eye sits on that same line, the floor then projected to exactly the
// centre of the screen — and so did the top of the front post, which is the one
// thing you have to see. The post ended up precisely at the lower edge of the
// window, hidden behind the notch floor, on every open-sighted weapon in the
// game: aiming the Type 100, the M1911, the Kar98k or the Thompson showed a
// wall of rear sight across the middle of the screen and no front sight at all.
// Cutting the notch DOWN from the line is what opens a window for the post to
// stand in, which is what an open sight is.
// ---------------------------------------------------------------------------

// How far the notch floor sits below the line of sight. The front post has to
// fit inside this window, and the window is measured at the rear sight while
// the post is measured way out at the muzzle, so the post's own height has to
// be smaller than this by the ratio of those two distances. FRONT_POST_H is set
// against the tightest ratio on the roster (a pistol, whose short sight radius
// puts the front blade over half as far away again as the rear notch).
export const NOTCH_DEPTH = 0.009;
export const FRONT_POST_H = 0.013;

/**
 * Front sight.
 *
 * `mount` is the weapon-space Y of the surface the sight is fixed to — the top
 * of the barrel, shroud or gas block. A real front sight is brazed to a boss or
 * clamped in a band; it does not levitate above the barrel with a centimetre of
 * daylight under it, which is what every long-barrelled weapon in the game was
 * doing because the base was placed purely from the sight line and the barrel
 * happened to sit lower. Pass `band` (the barrel radius) as well to wrap a
 * proper split band around it.
 */
export function frontSight(mat, { aimY, z, ears = 'none', baseW = 0.026, baseH = 0.012, post = 'blade', bladeW = 0.005, mount = null, band = 0 } = {}) {
  const g = new THREE.Group();
  const postH = FRONT_POST_H;
  const topY = aimY;
  const baseY = topY - postH - baseH * 0.5;
  // A hood is 34mm across the ears; its base has to be at least as wide or the
  // two protector ears stand clear of it with daylight down both sides.
  const plateW = ears === 'hood' ? Math.max(baseW, 0.039) : baseW;
  g.add(mesh(bevelBoxGeo(plateW, baseH, 0.03, 0.0018), mat, 0, baseY, 0));
  const baseBottom = baseY - baseH / 2;
  if (mount !== null && mount < baseBottom - 0.0005) {
    const rise = baseBottom - mount;
    g.add(mesh(bevelBoxGeo(baseW * 0.60, rise + 0.002, 0.026, 0.0015), mat, 0, mount + rise / 2, 0));
    if (band > 0) {
      // Split band clamped round the barrel. A torus in the XY plane has its
      // axis along Z, which IS the bore axis, so it needs no rotation.
      g.add(mesh(torusGeo(band, 0.0032, 6, 18), mat, 0, mount - band, 0));
      g.add(mesh(bevelBoxGeo(0.010, 0.008, 0.012, 0.0012), mat, 0, mount - band * 2 - 0.002, 0));
    }
  }
  if (post === 'blade') {
    g.add(mesh(bevelBoxGeo(bladeW, postH, 0.012, 0.0012), mat, 0, topY - postH / 2, 0));
  } else { // round post
    g.add(mesh(cylGeo(bladeW * 0.7, bladeW * 0.55, postH, 10), mat, 0, topY - postH / 2, 0));
  }
  if (ears === 'wings') {
    for (const sx of [1, -1]) {
      g.add(mesh(bevelBoxGeo(0.004, postH + 0.008, 0.026, 0.0012), mat,
        sx * (baseW / 2 - 0.004), topY - postH / 2 + 0.002, 0));
    }
  } else if (ears === 'hood') {
    const hood = mesh(cylGeo(0.017, 0.017, 0.03, 14, true, Math.PI * 1.15, Math.PI * -0.075), mat,
      0, topY - postH * 0.55, 0, Math.PI / 2);
    g.add(hood);
    for (const sx of [1, -1]) {
      g.add(mesh(bevelBoxGeo(0.0035, 0.016, 0.03, 0.001), mat, sx * 0.0165, topY - postH * 0.55 - 0.008, 0));
    }
  } else if (ears === 'ring') {
    g.add(mesh(torusGeo(0.016, 0.0022, 5, 16), mat, 0, topY - postH * 0.55, 0));
  }
  g.position.z = z;
  return g;
}

/** Open notch rear sight — the TOP OF THE SHOULDERS lands exactly on aimY. */
export function rearNotch(mat, { aimY, z, w = 0.032, style = 'v', mount = null } = {}) {
  const g = new THREE.Group();
  const leafH = 0.013;
  const floorY = aimY - NOTCH_DEPTH;   // top of the notch floor
  // leaf body with the notch cut straight through it
  const half = w / 2;
  for (const sx of [1, -1]) {
    g.add(mesh(bevelBoxGeo(half - 0.005, leafH, 0.011, 0.0012), mat,
      sx * (half + 0.005) / 2 + sx * 0.0025, aimY - leafH / 2, 0));
  }
  // notch floor: a thin bridge a notch-depth below the shoulders
  g.add(mesh(bevelBoxGeo(0.012, 0.006, 0.011, 0.001), mat, 0, floorY - 0.003, 0));
  if (style === 'v') {
    // the walls of the V, flaring from the floor out to the shoulders
    for (const sx of [1, -1]) {
      g.add(mesh(bevelBoxGeo(0.008, 0.010, 0.011, 0.001), mat,
        sx * 0.010, floorY + 0.003, 0, 0, 0, sx * 0.5));
    }
  }
  // Base. It has to come UP to the underside of the leaves: at 9mm tall it
  // stopped 3.5mm short of them, and since the notch bridge between the leaves
  // is narrower than they are, both leaves were left standing in air.
  g.add(mesh(bevelBoxGeo(w + 0.01, 0.010, 0.026, 0.0018), mat, 0, aimY - leafH - 0.005, 0));
  // adjustment screw
  g.add(mesh(cylGeo(0.0035, 0.0035, 0.005, 8), mat, 0, aimY - leafH - 0.005, 0.014, Math.PI / 2));
  // `mount` is the weapon-space Y of the surface the sight is dovetailed into.
  const baseBottom = aimY - leafH - 0.010;
  if (mount !== null && mount < baseBottom - 0.0005) {
    const rise = baseBottom - mount;
    g.add(mesh(bevelBoxGeo(w * 0.7, rise + 0.002, 0.024, 0.0015), mat, 0, mount + rise / 2, 0));
  }
  g.position.z = z;
  return g;
}

/** Peep/aperture rear sight — the hole centre lands on aimY. */
export function rearAperture(mat, { aimY, z, r = 0.0086, protect = true } = {}) {
  const g = new THREE.Group();
  // The ring you actually look through. It is the whole point of a peep sight,
  // so it is built thick enough to read at view-model distance and backed by a
  // dark chamfer disc that makes the hole look like a hole rather than a gap
  // between two struts.
  g.add(mesh(torusGeo(r, 0.0034, 6, 22), mat, 0, aimY, 0));
  g.add(mesh(ringGeo(r - 0.0016, r + 0.0038, 22), WM.cavity, 0, aimY, 0.0032));
  g.add(mesh(bevelBoxGeo(0.014, 0.014, 0.012, 0.0015), mat, 0, aimY - r - 0.008, 0));
  g.add(mesh(bevelBoxGeo(0.03, 0.008, 0.03, 0.0018), mat, 0, aimY - r - 0.016, 0));
  if (protect) {
    for (const sx of [1, -1]) {
      g.add(mesh(bevelBoxGeo(0.004, 0.024, 0.014, 0.0012), mat, sx * (r + 0.006), aimY - 0.002, 0));
    }
    // windage/elevation knobs
    for (const sx of [1, -1]) {
      g.add(mesh(cylGeo(0.005, 0.005, 0.006, 10), mat, sx * (r + 0.011), aimY - 0.004, 0, 0, 0, Math.PI / 2));
    }
  }
  g.position.z = z;
  return g;
}

/**
 * Tangent / ladder rear sight (Kar98k, Mosin, PPSh). The notch is at the muzzle
 * end of the leaf; the ladder bed and the graduation slider have to stay under
 * its floor, because they are NEARER the eye than the notch is and anything
 * standing proud of the floor back there closes the window from below.
 */
export function rearTangent(mat, { aimY, z, w = 0.03, len = 0.07 } = {}) {
  const g = new THREE.Group();
  const floorY = aimY - NOTCH_DEPTH;
  g.add(mesh(bevelBoxGeo(w + 0.012, 0.012, len, 0.0018), mat, 0, aimY - 0.018, len * 0.18));
  g.add(mesh(bevelBoxGeo(w, 0.007, len * 0.55, 0.0012), mat, 0, floorY - 0.0045, len * 0.02, -0.06));
  for (const sx of [1, -1]) {
    g.add(mesh(bevelBoxGeo(0.005, 0.014, 0.010, 0.0012), mat, sx * w / 2, aimY - 0.007, -len * 0.24));
  }
  g.add(mesh(bevelBoxGeo(0.011, 0.005, 0.010, 0.001), mat, 0, floorY - 0.0025, -len * 0.24));
  // graduation slider
  g.add(mesh(bevelBoxGeo(w + 0.006, 0.008, 0.012, 0.0012), mat, 0, aimY - 0.016, len * 0.22));
  g.position.z = z;
  return g;
}

/** Modern flip-up iron on a rail: square notch, protected. */
export function railRearSight(mat, { aimY, z, w = 0.03 } = {}) {
  const g = new THREE.Group();
  const floorY = aimY - NOTCH_DEPTH;
  for (const sx of [1, -1]) {
    g.add(mesh(bevelBoxGeo(0.005, 0.02, 0.01, 0.0012), mat, sx * w / 2, aimY - 0.010, 0));
  }
  g.add(mesh(bevelBoxGeo(w, 0.006, 0.01, 0.001), mat, 0, floorY - 0.003, 0));
  g.add(mesh(bevelBoxGeo(w + 0.008, 0.008, 0.024, 0.0016), mat, 0, aimY - 0.020, 0.004));
  g.position.z = z;
  return g;
}

/**
 * Red dot / reflex optic.
 *
 * The eye is at +Z. Both elements have to be transparent or there is nothing to
 * aim through — the previous build put the opaque scope-lens material on the
 * rear element, which sat between the eye and the reticle and hid it
 * completely. The dot lives on the FRONT element, dead on the optic's axis, so
 * it lands exactly where the shot goes and stays welded to the glass.
 */
export function redDot(matBody, matGlass, matLens, matDot, { aimY = 0, z = 0, r = 0.019 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(bevelBoxGeo(0.026, 0.016, 0.05, 0.002), matBody, 0, -r - 0.006, 0));
  g.add(mesh(bevelBoxGeo(0.034, 0.008, 0.018, 0.0015), matBody, 0, -r - 0.014, 0.008));
  g.add(mesh(cylGeo(r, r, 0.05, 16, true), matBody, 0, 0, 0, Math.PI / 2));
  g.add(mesh(torusGeo(r, 0.0022, 5, 16), matBody, 0, 0, -0.025));
  g.add(mesh(torusGeo(r, 0.0022, 5, 16), matBody, 0, 0, 0.025));
  // front (objective) element, canted like a real reflex lens
  const front = mesh(cylGeo(r * 0.94, r * 0.94, 0.0018, 18), matGlass, 0, 0, -0.020, Math.PI / 2 + 0.11);
  front.renderOrder = 2;
  g.add(front);
  // rear element the eye looks through — a coated wafer, not a solid disc
  const rear = mesh(cylGeo(r * 0.9, r * 0.9, 0.0016, 18), matGlass, 0, 0, 0.019, Math.PI / 2);
  rear.renderOrder = 2;
  g.add(rear);
  g.add(mesh(torusGeo(r * 0.92, 0.0016, 4, 18), matLens, 0, 0, 0.019)); // lens coating ring
  // the reticle: a hot core with a soft bloom halo, projected on the glass
  const halo = mesh(ringGeo(0, 0.0034, 14), WM.dotHalo, 0, 0, -0.0186);
  halo.renderOrder = 3;
  const core = mesh(ringGeo(0, 0.00115, 12), WM.dotCore, 0, 0, -0.0184);
  core.renderOrder = 4;
  g.add(halo, core);
  g.userData.reticle = core;
  g.userData.reticleHalo = halo;
  // The clear aperture, so a caller can work out how high the optic has to sit
  // for the whole window to see over the receiver it is bolted to.
  g.userData.opticR = r;
  g.userData.opticGlassZ = z - 0.020;
  // emitter housing under the front element (where the LED actually lives)
  g.add(mesh(bevelBoxGeo(0.008, 0.007, 0.010, 0.0015), matBody, 0, -r * 0.62, -0.018));
  g.add(mesh(sphereGeo(0.0022, 6, 5), matDot, 0, -r * 0.55, -0.018));
  // elevation turret
  g.add(mesh(cylGeo(0.006, 0.006, 0.008, 10), matBody, 0, r + 0.002, 0.006));
  g.position.set(0, aimY, z);
  return g;
}

/** Telescopic sight with mounts, eyepiece, objective bell and a lens glint. */
export function scope(matBody, matLens, { aimY = 0, z = 0, len = 0.26, r = 0.019, bell = 0.03 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo('scp' + len + '_' + r + '_' + bell, [
    [0.001, len / 2], [r * 1.25, len / 2], [r * 1.25, len * 0.4], [r, len * 0.34],
    [r, -len * 0.12], [bell, -len * 0.26], [bell, -len / 2], [0.001, -len / 2],
  ], 20), matBody));
  // Lenses seated IN the tube. At 0.9x/1.1x they sat ~3mm shy of the tube wall
  // and 2.5mm behind the end caps — a hairline ring of daylight round both ends
  // of every scope, which at display scale read as the glass floating.
  g.add(mesh(cylGeo(bell * 0.97, bell * 0.97, 0.004, 18), matLens, 0, 0, -len / 2 + 0.003, Math.PI / 2));
  g.add(mesh(cylGeo(r * 1.22, r * 1.22, 0.004, 18), matLens, 0, 0, len / 2 - 0.003, Math.PI / 2));
  // turrets
  g.add(mesh(cylGeo(0.008, 0.0075, 0.012, 12), matBody, 0, r + 0.004, len * 0.06));
  g.add(mesh(cylGeo(0.008, 0.0075, 0.012, 12), matBody, r + 0.004, 0, len * 0.06, 0, 0, Math.PI / 2));
  // rings + mounts
  for (const mz of [-len * 0.3, len * 0.24]) {
    g.add(mesh(torusGeo(r * 1.08, 0.004, 5, 16), matBody, 0, 0, mz));
    g.add(mesh(bevelBoxGeo(0.014, 0.024, 0.014, 0.0015), matBody, 0, -r - 0.010, mz));
  }
  g.position.set(0, aimY, z);
  return g;
}

// ---------------------------------------------------------------------------
// receiver furniture
// ---------------------------------------------------------------------------

/** Recessed ejection port with a raised lip and a dark cavity behind it. */
export function ejectionPort(matBody, matCavity, { w = 0.05, h = 0.028, x = 0.027, y = 0.02, z = -0.02, side = 1 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(bevelBoxGeo(0.004, h, w, 0.001), matCavity, 0, 0, 0));
  // lip frame
  g.add(mesh(bevelBoxGeo(0.005, 0.0045, w + 0.012, 0.0012), matBody, 0.0016, h / 2 + 0.002, 0));
  g.add(mesh(bevelBoxGeo(0.005, 0.0045, w + 0.012, 0.0012), matBody, 0.0016, -h / 2 - 0.002, 0));
  g.add(mesh(bevelBoxGeo(0.005, h + 0.01, 0.006, 0.0012), matBody, 0.0016, 0, w / 2 + 0.003));
  g.add(mesh(bevelBoxGeo(0.005, h + 0.01, 0.006, 0.0012), matBody, 0.0016, 0, -w / 2 - 0.003));
  g.position.set(x * side, y, z);
  g.rotation.y = side > 0 ? 0 : Math.PI;
  return g;
}

/** Trigger + bow-shaped guard, extruded with a bevel so it catches light. */
export function triggerGroup(mat, { len = 0.075, drop = 0.042, thick = 0.011, y = -0.03, z = -0.02 } = {}) {
  const g = new THREE.Group();
  const hl = len / 2, r = drop;
  const outer = [];
  const inner = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = Math.PI * t;
    outer.push([-hl + len * t, -Math.sin(a) * r]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n, a = Math.PI * t;
    inner.push([(-hl + len * t) * 0.80, -Math.sin(a) * (r - 0.011)]);
  }
  const pts = [[-hl - 0.007, 0.010], ...outer, [hl + 0.007, 0.010], [hl * 0.80, 0.005], ...inner, [-hl * 0.80, 0.005]];
  g.add(mesh(plateGeo('tg' + len.toFixed(4) + drop.toFixed(4), pts, thick, 0.0018), mat, 0, 0, 0, 0, Math.PI / 2));
  // trigger blade
  const t = mesh(plateGeo('tb', [
    [0, 0], [0.006, 0], [0.008, -0.012], [0.004, -0.026], [-0.004, -0.028], [-0.006, -0.016], [-0.004, -0.004],
  ], 0.006, 0.0012), mat, 0, -0.004, -len * 0.09, 0, Math.PI / 2);
  g.add(t);
  g.position.set(0, y, z);
  g.userData.trigger = t;
  return g;
}

/**
 * Detachable box magazine: tapered body, spine ribs, floorplate and a witness
 * slot. `curve` bends it like an AK/STG banana mag.
 */
export function magazine(mat, matFloor, { w = 0.036, h = 0.14, d = 0.05, curve = 0, taper = 0.9, ribs = 3 } = {}) {
  const g = new THREE.Group();
  const segs = curve > 0.001 ? 5 : 1;
  const segH = h / segs;

  // A curved magazine is a CHAIN, not a stack of independently placed blocks:
  // each section hangs off the bottom seam of the one above it and is hinged by
  // the same small angle, so the body stays continuous however far it bananas.
  //
  // The previous build put every section in the magazine's STRAIGHT local space
  // and then slid it forward by `curve * t^2 * 0.5` — up to 120mm on an StG-44,
  // whose whole magazine is only 190mm long. The sections came apart into four
  // separate blocks trailing down and forward through the air, and the
  // floorplate and spine ribs, which were positioned in that same straight
  // space, ended up 30mm clear of any of them. On the asset-archive page it
  // read as a handful of loose blocks and thin slabs hanging under the
  // receiver. Every banana magazine in the game had it.
  const bend = curve * 1.6;                        // total sweep, radians
  const step = segs > 1 ? bend / (segs - 1) : 0;
  const width = (i) => w * (1 - (1 - taper) * (i / segs));
  const joints = [];
  let parent = g;
  for (let i = 0; i < segs; i++) {
    const joint = new THREE.Group();
    // Section 0 is centred ON the magazine origin so the mouth of the magazine
    // — the part that has to sit inside the magwell — never moves when `curve`
    // changes. Every later joint sits on the seam it shares with the section
    // above, which is exactly where a real magazine's curve is struck from.
    joint.position.y = i === 0 ? 0 : -(i === 1 ? segH / 2 : segH);
    joint.rotation.x = i === 0 ? 0 : step;
    parent.add(joint);
    parent = joint;
    joints.push(joint);
    // +0.002 of overlap at each seam: a bevelled box is slightly short of its
    // nominal size at the corners, and a hairline of daylight along a seam is
    // exactly what makes a one-piece magazine read as several.
    joint.add(mesh(bevelBoxGeo(width(i), segH + 0.002, d, 0.0022), mat,
      0, i === 0 ? 0 : -segH / 2, 0));
  }

  // Anything bolted to the body is parented to the SECTION it sits on, so it
  // rides the curve instead of being aimed at where a straight magazine would
  // have put it.
  const last = joints[segs - 1];
  const bottomY = segs === 1 ? -(segH + 0.002) / 2 : -segH;
  const fp = mesh(bevelBoxGeo(width(segs - 1) + 0.005, 0.009, d + 0.005, 0.0018), matFloor,
    0, bottomY - 0.003, 0);
  last.add(fp);
  // Spine ribs, spread down the body. `depth` is measured from the MOUTH of the
  // magazine — the top face of section 0, which sits half a section above the
  // origin. The old formula measured from the origin and ran to 0.70h, so on a
  // straight magazine (whose whole body is only ±h/2 about the origin) the
  // bottom rib always ended up hanging below the floorplate in clear air.
  for (let i = 0; i < ribs; i++) {
    const depth = h * ((i + 1) / (ribs + 1));
    const si = Math.min(segs - 1, Math.max(0, Math.floor(depth / segH)));
    const localY = si === 0 ? segH / 2 - depth : -(depth - si * segH);
    joints[si].add(mesh(bevelBoxGeo(width(si) + 0.002, 0.004, d * 0.86, 0.001), mat, 0, localY, 0));
  }
  g.userData.floorplate = fp;
  return g;
}

/** Picatinny-ish rail with individual slots. */
export function rail(mat, { len = 0.24, w = 0.022, h = 0.008, slots = 8 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(bevelBoxGeo(w, h, len, 0.0012), mat, 0, 0, 0));
  const step = len / slots;
  for (let i = 0; i < slots; i++) {
    g.add(mesh(bevelBoxGeo(w + 0.001, h * 0.55, step * 0.34, 0.0006), WM.cavity,
      0, h * 0.12, -len / 2 + step * (i + 0.5)));
  }
  return g;
}

/** Slotted screw head. */
export function screw(mat, { r = 0.004, x = 0, y = 0, z = 0, axis = 'x' } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cylGeo(r, r * 0.95, 0.0035, 10), mat, 0, 0, 0));
  g.add(mesh(bevelBoxGeo(r * 1.7, 0.0012, r * 0.42, 0.0003), WM.cavity, 0, 0.0018, 0));
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  else if (axis === 'z') g.rotation.x = Math.PI / 2;
  g.position.set(x, y, z);
  return g;
}

/** Sling swivel loop. */
export function slingLoop(mat, { r = 0.011, tube = 0.0026, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(torusGeo(r, tube, 5, 14), mat, 0, 0, 0));
  g.add(mesh(bevelBoxGeo(0.009, 0.008, 0.008, 0.001), mat, 0, r + 0.004, 0));
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  return g;
}

/** Charging handle knob on a slotted track. */
export function chargingHandle(mat, matC, { x = 0.026, y = 0.022, z = 0, len = 0.05, knob = 0.011 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(bevelBoxGeo(0.006, 0.011, len, 0.0012), mat, 0, 0, 0));
  g.add(mesh(cylGeo(knob, knob * 0.85, 0.014, 12), mat, 0.010, 0, -len * 0.28, 0, 0, Math.PI / 2));
  g.add(mesh(bevelBoxGeo(0.003, 0.007, len + 0.03, 0.0008), matC, -0.004, 0, 0.006));
  g.position.set(x, y, z);
  return g;
}

/** Selector / safety lever. */
export function selector(mat, { x = 0.026, y = 0, z = 0, rot = 0.5 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cylGeo(0.0075, 0.0075, 0.008, 12), mat, 0, 0, 0, 0, 0, Math.PI / 2));
  g.add(mesh(bevelBoxGeo(0.006, 0.008, 0.026, 0.0012), mat, 0.004, 0.004, -0.010, rot));
  g.position.set(x, y, z);
  return g;
}

/**
 * Bipod with folded/deployed legs.
 *
 * `mount` is the weapon-space Y of the surface the yoke clamps to — normally
 * the UNDERSIDE of the barrel or shroud — and `clamp` its radius. Without them
 * the yoke sits wherever `y` puts it and the whole bipod hangs off the gun in
 * mid-air, which is how every bipod in the game was mounted.
 */
export function bipod(mat, { y = -0.05, z = -0.4, spread = 0.42, len = 0.17, mount = null, clamp = 0 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(bevelBoxGeo(0.026, 0.014, 0.03, 0.0018), mat, 0, 0.004, 0));
  if (mount !== null) {
    const top = mount - y;                  // the clamp surface, in local space
    const rise = top - 0.011;               // from the top of the yoke plate up
    if (rise > 0.0005) {
      g.add(mesh(bevelBoxGeo(0.018, rise + 0.002, 0.024, 0.0015), mat, 0, 0.011 + rise / 2, 0));
    }
    if (clamp > 0) {
      g.add(mesh(torusGeo(clamp, 0.0034, 6, 18), mat, 0, top + clamp, 0));
      g.add(mesh(bevelBoxGeo(0.012, 0.009, 0.014, 0.0012), mat, 0, top + clamp * 2 + 0.002, 0));
    }
  }
  const legs = [];
  for (const sx of [1, -1]) {
    const leg = new THREE.Group();
    leg.add(mesh(cylGeo(0.0042, 0.0035, len, 8), mat, 0, -len / 2, 0));
    leg.add(mesh(bevelBoxGeo(0.008, 0.006, 0.022, 0.001), mat, 0, -len, 0.004));
    leg.position.set(sx * 0.012, 0, 0);
    leg.rotation.z = -sx * spread;
    g.add(leg);
    legs.push(leg);
  }
  // Named, not indexed: callers used to fish the legs out as children[1] and
  // children[2], which silently pointed at the mount hardware the moment this
  // grew a clamp.
  g.userData.legs = legs;
  g.position.set(0, y, z);
  return g;
}

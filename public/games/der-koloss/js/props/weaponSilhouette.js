// Chalk line-art of a real weapon model, for the wall-buy boards.
//
// The first version of this traced a per-column top-and-bottom envelope of the
// weapon's silhouette. That can only ever produce a balloon with a couple of
// spikes hanging off it: no receiver line, no trigger guard, no magazine box,
// no sights, no handguard split — none of the internal structure that makes a
// drawing read as a specific gun. It is structurally incapable of the job.
//
// This is a small software NPR renderer instead. It rasterises the weapon
// side-on into a depth buffer and then extracts the three kinds of line a
// person actually draws:
//
//   * the SILHOUETTE, where the model meets empty space;
//   * OCCLUSION and PART boundaries, where one component crosses in front of
//     another (magazine against receiver, sight against the barrel);
//   * CREASES, where the surface turns sharply (the flat of the receiver
//     against its rounded top, the stock comb, the grip).
//
// Because the depth buffer does hidden-surface removal for free, lines from the
// far side of the weapon never bleed through. The result is traced into
// polylines that a chalk stroke can follow, weighted so the outline is drawn
// bolder than the interior detail — which is how a sketch is actually built up.
//
// Still no renderer or render target: this is plain typed-array arithmetic, so
// it runs during map construction and cannot fail the way an offscreen GL pass
// can.
import * as THREE from 'three';
import { buildViewmodel } from '../weapons.js';

// Rasterisation density. The board can only ever show the drawing ~380px wide,
// so a Kar98 at ~500px is a comfortable 1.3x supersample; going finer than this
// cost ~2x the map-build time for detail that is thrown away on downscale.
const PX_PER_M = 360;
const MAX_PX = 560;             // ceiling, in case a model is unexpectedly huge
const PAD = 3;                  // keeps lines off the buffer edge

// Edge thresholds. Tuned against the real models — see the note on each.
const DEPTH_TAU = 0.006;        // metres of depth step that reads as "in front of"
const CREASE_COS = Math.cos(THREE.MathUtils.degToRad(46)); // surface turn that reads as an edge
// A part boundary on its own is not a line. These weapons are assembled from
// many abutting boxes and lathes, and drawing every seam between them buried
// the guns in scratch. A seam earns a line only where the parts actually step
// apart in depth or turn away from each other.
const PART_TAU = 0.0022;
const PART_COS = Math.cos(THREE.MathUtils.degToRad(22));
const MIN_CHAIN = 7;            // drop chains shorter than this; kills speckle
const MIN_FAINT_CHAIN = 13;     // faint interior lines must be longer still to earn their place

// Line weights, used by the caller to pick chalk pressure.
const W_SILHOUETTE = 1.0, W_OCCLUSION = 0.62, W_CREASE = 0.42;

const _cache = new Map();

/**
 * Line-art for a weapon, in its own pixel space.
 *
 * @returns {{strokes:{pts:number[][], weight:number}[], w:number, h:number,
 *            bounds:object, lengthM:number, heightM:number}|null}
 */
export function weaponLineArt(weaponId) {
  if (_cache.has(weaponId)) return _cache.get(weaponId);
  let art = null;
  try {
    art = computeLineArt(weaponId);
  } catch {
    art = null;                        // unknown id or odd model — caller falls back
  }
  _cache.set(weaponId, art);
  return art;
}

/** Gather world-space triangles, with normals and an id per source mesh. */
function collectTriangles(root) {
  const pos3 = [], nrm3 = [], part = [];
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const ax = new THREE.Vector3(), bx = new THREE.Vector3(), cx = new THREE.Vector3();
  let id = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.userData?.isGlove) return;   // never chalk the hands
    const geo = o.geometry;
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const idx = geo.index;
    const count = idx ? idx.count : pos.count;
    nm.getNormalMatrix(o.matrixWorld);
    const myId = id++;
    for (let i = 0; i + 2 < count; i += 3) {
      const px = [], py = [], pz = [];
      for (let k = 0; k < 3; k++) {
        const j = idx ? idx.getX(i + k) : (i + k);
        v.fromBufferAttribute(pos, j).applyMatrix4(o.matrixWorld);
        px.push(v.x); py.push(v.y); pz.push(v.z);
      }
      // Smooth vertex normals where the geometry has them: a lathed barrel then
      // reads as one rounded surface instead of sprouting a crease line down
      // every one of its eighteen facets. Flat faces still meet at a hard angle
      // and still produce an edge.
      if (nor) {
        for (let k = 0; k < 3; k++) {
          const j = idx ? idx.getX(i + k) : (i + k);
          n.fromBufferAttribute(nor, j).applyMatrix3(nm).normalize();
          nrm3.push(n.x, n.y, n.z);
        }
      } else {
        ax.set(px[0], py[0], pz[0]); bx.set(px[1], py[1], pz[1]); cx.set(px[2], py[2], pz[2]);
        bx.sub(ax); cx.sub(ax); bx.cross(cx).normalize();
        for (let k = 0; k < 3; k++) nrm3.push(bx.x, bx.y, bx.z);
      }
      for (let k = 0; k < 3; k++) { pos3.push(px[k], py[k], pz[k]); }
      part.push(myId);
    }
  });
  return { pos3, nrm3, part };
}

function computeLineArt(weaponId) {
  const root = buildViewmodel(weaponId, false);
  if (!root) return null;
  root.updateWorldMatrix(true, true);

  const { pos3, nrm3, part } = collectTriangles(root);
  if (part.length < 4) return null;

  // Side elevation: the viewmodel points down -Z with +Y up, so the picture
  // plane is ZY and X is depth. The eye sits at +X looking back along -X, so
  // the nearest surface at a pixel is the one with the greatest x.
  let minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos3.length; i += 3) {
    const y = pos3[i + 1], z = pos3[i + 2];
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const spanZ = maxZ - minZ, spanY = maxY - minY;
  if (!(spanZ > 1e-4) || !(spanY > 1e-4)) return null;

  // One scale on both axes, and the same scale for every weapon, so the buffer
  // IS the weapon's real side elevation: true aspect, and a pistol genuinely
  // smaller than a rifle rather than blown up to match it.
  const scale = Math.min(PX_PER_M, (MAX_PX - PAD * 2) / Math.max(spanZ, spanY));
  const W = Math.max(16, Math.ceil(spanZ * scale) + PAD * 2);
  const H = Math.max(16, Math.ceil(spanY * scale) + PAD * 2);
  const N = W * H;

  const depth = new Float32Array(N).fill(-Infinity);
  const nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);
  const pid = new Int32Array(N).fill(-1);

  // Depth-buffered scanline fill, barycentric so depth and normal interpolate.
  const sx = new Float64Array(3), sy = new Float64Array(3), sd = new Float64Array(3);
  for (let t = 0; t < part.length; t++) {
    const base = t * 9;
    for (let k = 0; k < 3; k++) {
      const x = pos3[base + k * 3], y = pos3[base + k * 3 + 1], z = pos3[base + k * 3 + 2];
      sx[k] = PAD + (z - minZ) * scale;
      sy[k] = H - PAD - (y - minY) * scale;   // canvas grows downward
      sd[k] = x;
    }
    const x0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
    if (x1 < x0 || y1 < y0) continue;
    const ax = sx[0], ay = sy[0], bx = sx[1], by = sy[1], cx = sx[2], cy = sy[2];
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;     // degenerate / edge-on
    const inv = 1 / den;
    for (let py = y0; py <= y1; py++) {
      const fy = py + 0.5;
      for (let px = x0; px <= x1; px++) {
        const fx = px + 0.5;
        const l0 = ((by - cy) * (fx - cx) + (cx - bx) * (fy - cy)) * inv;
        if (l0 < 0) continue;
        const l1 = ((cy - ay) * (fx - cx) + (ax - cx) * (fy - cy)) * inv;
        if (l1 < 0) continue;
        const l2 = 1 - l0 - l1;
        if (l2 < 0) continue;
        const d = l0 * sd[0] + l1 * sd[1] + l2 * sd[2];
        const o = py * W + px;
        if (d <= depth[o]) continue;
        depth[o] = d;
        pid[o] = part[t];
        nx[o] = l0 * nrm3[base] + l1 * nrm3[base + 3] + l2 * nrm3[base + 6];
        ny[o] = l0 * nrm3[base + 1] + l1 * nrm3[base + 4] + l2 * nrm3[base + 7];
        nz[o] = l0 * nrm3[base + 2] + l1 * nrm3[base + 5] + l2 * nrm3[base + 8];
      }
    }
  }

  // Edge pass. Compare each pixel with its right and lower neighbour; whichever
  // of the pair is nearer owns the resulting line, so an occlusion edge is
  // drawn on the occluding part rather than smeared across the seam.
  const edge = new Float32Array(N);
  const mark = (o, w) => { if (w > edge[o]) edge[o] = w; };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const filled = pid[o] >= 0;
      for (let k = 0; k < 2; k++) {
        const x2 = x + (k === 0 ? 1 : 0), y2 = y + (k === 0 ? 0 : 1);
        if (x2 >= W || y2 >= H) continue;
        const o2 = y2 * W + x2;
        const filled2 = pid[o2] >= 0;
        if (!filled && !filled2) continue;
        if (filled !== filled2) { mark(filled ? o : o2, W_SILHOUETTE); continue; }
        const near = depth[o] >= depth[o2] ? o : o2;
        const dd = Math.abs(depth[o] - depth[o2]);
        if (dd > DEPTH_TAU) { mark(near, W_OCCLUSION); continue; }
        const dot = nx[o] * nx[o2] + ny[o] * ny[o2] + nz[o] * nz[o2];
        if (pid[o] !== pid[o2] && (dd > PART_TAU || dot < PART_COS)) {
          mark(near, W_OCCLUSION); continue;
        }
        if (dot < CREASE_COS) mark(near, W_CREASE);
      }
    }
  }

  const strokes = traceChains(edge, W, H);
  if (!strokes.length) return null;

  let minX = Infinity, maxX = -Infinity, minYp = Infinity, maxYp = -Infinity;
  for (const s of strokes) {
    for (const [x, y] of s.pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minYp) minYp = y; if (y > maxYp) maxYp = y;
    }
  }
  return {
    strokes, w: W, h: H,
    bounds: { minX, maxX, minY: minYp, maxY: maxYp, w: maxX - minX, h: maxYp - minYp },
    lengthM: spanZ, heightM: spanY,
  };
}

// 8-connected neighbours, straight before diagonal so chains prefer to run
// along a clean horizontal or vertical rather than staircasing.
const NB = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Walk the edge bitmap into polylines.
 *
 * Endpoints first (a pixel with a single neighbour is the natural start of a
 * pen stroke), then whatever closed loops are left over — otherwise a ring like
 * a trigger guard would never be picked up.
 */
function traceChains(edge, W, H) {
  const used = new Uint8Array(W * H);
  const chains = [];

  const degree = (x, y) => {
    let d = 0;
    for (const [dx, dy] of NB) {
      const nxp = x + dx, nyp = y + dy;
      if (nxp < 0 || nyp < 0 || nxp >= W || nyp >= H) continue;
      if (edge[nyp * W + nxp] > 0) d++;
    }
    return d;
  };

  const walk = (x, y) => {
    const pts = [];
    let sum = 0;
    let cx = x, cy = y;
    for (;;) {
      const o = cy * W + cx;
      used[o] = 1;
      pts.push([cx, cy]);
      sum += edge[o];
      let best = -1, bx = 0, by = 0;
      for (let i = 0; i < NB.length; i++) {
        const nxp = cx + NB[i][0], nyp = cy + NB[i][1];
        if (nxp < 0 || nyp < 0 || nxp >= W || nyp >= H) continue;
        const no = nyp * W + nxp;
        if (used[no] || edge[no] <= 0) continue;
        // Straight neighbours come first in NB, so the first hit is the
        // straightest continuation available.
        best = no; bx = nxp; by = nyp;
        break;
      }
      if (best < 0) break;
      cx = bx; cy = by;
    }
    if (pts.length < MIN_CHAIN) return;
    const weight = sum / pts.length;
    // A short, faint chain is nearly always a shading artefact on a curved
    // surface rather than a feature anyone would draw. Silhouette fragments are
    // kept at the shorter length, because they are genuinely part of the outline.
    if (weight < 0.5 && pts.length < MIN_FAINT_CHAIN) return;
    chains.push({ pts, weight });
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      if (edge[o] > 0 && !used[o] && degree(x, y) <= 1) walk(x, y);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      if (edge[o] > 0 && !used[o]) walk(x, y);
    }
  }
  return chains;
}

/** Drop near-collinear points so the chalk stroke has drawable segments. */
export function simplify(points, tolerance = 1.6) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = out[out.length - 1];
    const [cx, cy] = points[i];
    const [nxp, nyp] = points[i + 1];
    // perpendicular distance of the current point from the prev->next chord
    const dx = nxp - px, dy = nyp - py;
    const len = Math.hypot(dx, dy) || 1;
    const dist = Math.abs((cx - px) * dy - (cy - py) * dx) / len;
    if (dist > tolerance) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

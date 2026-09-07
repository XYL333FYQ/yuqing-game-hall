// Shared procedural surface library for the map's interactive machines.
//
// Everything here is drawn into a <canvas> at load time and uploaded once. The
// machines are hero props — the player stands a metre and a half from them and
// stares — so they get real colour/roughness/normal sets rather than a flat
// tint. Height maps are converted to tangent-space normals with a Sobel filter,
// which is what gives rivets, plank gaps and paint chips their relief under the
// sodium practicals.
//
// Every generator is seeded: a machine looks identical in every session.
import * as THREE from 'three';
import { applyNormalFilter } from '../render/Materials.js';

// ---------------------------------------------------------------------------
// deterministic RNG
// ---------------------------------------------------------------------------
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mkCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function finish(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Trilinear (three's default minFilter for a mipmapped texture) plus the
  // same anisotropy the map's surfaces get in map.js and assets.js. A door
  // jamb, a machine flank and a crate side are all long surfaces you walk
  // past, so they are almost always minified far harder along one axis than
  // the other; at low anisotropy the sampler has to pick one mip for both and
  // the cast-iron grain smears into a moire ladder as you move. three clamps
  // this to the device maximum, so 16 is a request, not a requirement.
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 16;
  return t;
}

// Normal-map LOD and geometric specular AA for the machines. Tuned looser than
// the map's merged surfaces: a hero prop is something the player stands a
// metre and a half from and stares at, so the LOD fade must not start eating
// relief at the distance it is actually read from, and the specular-AA cap is
// lower because the props are assembled from hundreds of abutting boxes and
// faceted rivet domes. Those seams are real geometry, three's own
// `geometryRoughness` already widens the lobe across them, and
// `subtractGeometric` keeps this filter from double-counting them — but the
// cap is the backstop that guarantees a modelling seam can never sand the
// shine off a whole machine.
export const PROP_NORMAL_FILTER = {
  normalLodStart: 0.003,
  normalLodEnd: 0.016,
  normalLodFloor: 0.30,
  specAA: 2.0,
  specAAMax: 0.16,
  subtractGeometric: true,
};

/**
 * A prop MeshStandardMaterial with the normal filtering already on it. Use
 * this instead of `new THREE.MeshStandardMaterial` for anything carrying a
 * normal map; without a normal map the filter is a no-op and skips itself.
 */
export function propMaterial(params, filter) {
  return applyNormalFilter(
    new THREE.MeshStandardMaterial(params),
    filter ? { ...PROP_NORMAL_FILTER, ...filter } : PROP_NORMAL_FILTER,
  );
}

/** Separable box blur of a canvas's red channel, wrapping at the edges. */
function boxBlur(data, S, H, radius) {
  const src = new Float32Array(S * H);
  for (let i = 0; i < S * H; i++) src[i] = data[i * 4];
  const tmp = new Float32Array(S * H);
  const n = radius * 2 + 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < S; x++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) s += src[y * S + ((x + k + S) % S)];
      tmp[y * S + x] = s / n;
    }
  }
  for (let x = 0; x < S; x++) {
    for (let y = 0; y < H; y++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) s += tmp[(((y + k + H) % H) * S) + x];
      src[y * S + x] = s / n;
    }
  }
  return src;
}

// Blur radius in texels, applied to a height field before its Sobel. Every
// generator gets its OWN, and every generator must pass one explicitly.
//
// The height field is blurred for the same reason the map's brick is (see
// makeBrickMaps in map.js): these generators draw their detail as one- and
// two-pixel rectangles — 14000 grains of sand-cast speckle, 2600 dots of orange
// peel, 220 casting pits — so a raw Sobel across them produces a normal that
// swings most of a right angle between adjacent texels. No amount of mip
// filtering or anisotropy can band-limit a signal like that: the mip chain
// averages the NORMALS and three renormalises whatever it reads back, so the
// surface's response to the sodium lamps flips direction with every sub-pixel
// step of the camera. That is the crawling flicker on the door-jamb rivets and
// flanges.
//
// But the radius CANNOT be shared. A box blur of radius r is a kernel
// n = 2r + 1 texels wide: it leaves anything wider than n essentially intact
// and crushes a feature of width w to roughly w/n. So the radius has to be read
// off the SMALLEST FEATURE THAT GENERATOR ACTUALLY DRAWS. Pick it from the
// micro-speckle and the plank generator loses its woodgrain; pick it from the
// authored relief and the cast-iron speckle goes on aliasing. One number cannot
// serve a generator stamping 1-texel grains and one drawing 100-texel planks.
//
// For scale: at the props' UV density (1.1 tiles/m on a 512px map) one texel is
// about 1.8mm of real surface.
const BLUR = {
  // Smallest authored feature: a casting pit at the bottom of its size range,
  // `arc(rad = 1.5..6)` — 3 texels across. Everything else in the height field
  // is 14000 one-to-three-texel grains at +/-50 levels, which is 21% of the map
  // by area and by far the densest micro-speckle in the library; the jamb is
  // built from this and it led the flicker table. n = 5 holds a 3-texel pit and
  // takes the 1-texel grain to a fifth. This is the same radius the brick picked
  // for its 3-texel mortar joint, for the same reason.
  castIron: 2,
  // Smallest authored feature: a paint chip at the bottom of its size range,
  // a 5-8 sided polygon at `rad = 2 * (0.55..1.3)` — about 2 texels across.
  // That is the floor, and it is a *smaller* floor than the iron's, so enamel
  // gets LESS blur, not more. Its aliasing load is a fifth of the iron's too:
  // 2600 orange-peel dots at +/-13 levels is 4% coverage against the iron's 21%
  // at +/-50. The 1-texel scuffs do get flattened here, deliberately — they are
  // drawn a texel wide, which is exactly the unresolvable case, and the same
  // scratch is carried at full contrast by the colour map, which is untouched.
  enamel: 1,
  // No authored feature at all: the entire height field is 900 rectangles one
  // texel wide, and the turned streaks and tarnish that make brass read as brass
  // live in the colour and roughness maps. There is nothing here to preserve, so
  // the radius is set by the content alone — 1 texel wide, so n = 5 to put it
  // well under the sampler. What survives is the faint mottle a polished casting
  // should have. (Small lever: at +/-11 levels and 0.9 relief a brass texel step
  // is 2.5 degrees of normal, so this was never the loud one.)
  brass: 2,
  // The tight one, and the reason a shared radius had to go. Plank draws BOTH
  // the coarsest steps in the library — a 4-texel gap between boards, 138 levels
  // deep at 2.4 relief — and the finest authored detail: grain strokes at
  // `lineWidth = 0.6..2.4`, mean 1.5 texels. That woodgrain IS the surface, and
  // n = 5 would take it to 30% and turn the 4-texel board gap into a rounded
  // groove with its two edges merged. n = 3 is the ceiling here: it holds the
  // gap at full depth and leaves the grain readable. Raising this to match the
  // iron would buy a better oscillation number by sanding the crates smooth,
  // which is not a trade this project makes.
  plank: 1,
};

// Sobel height -> tangent-space normal. `strength` is the slope multiplier,
// `blur` the band-limiting radius from BLUR above — pass one, always.
//
// The blur costs no visible detail at the radii chosen above. A one-texel grain
// on a 512px map wrapped around a 2m machine is under two millimetres of relief
// with an amplitude of a fifth of a level: you cannot see it, you can only see
// it alias.
function normalFromHeight(hCanvas, strength, blur) {
  // Loud rather than silent: `undefined > 0` is false, so a forgotten radius
  // would quietly ship a raw Sobel and put the crawl straight back.
  if (!(blur >= 0)) throw new Error('normalFromHeight: pass a BLUR radius for this generator');
  const S = hCanvas.width, H = hCanvas.height;
  const raw = hCanvas.getContext('2d').getImageData(0, 0, S, H).data;
  const src = blur > 0 ? boxBlur(raw, S, H, blur) : null;
  const out = mkCanvas(S, H);
  const og = out.getContext('2d');
  const img = og.createImageData(S, H);
  const at = src
    ? (x, y) => src[(((y % H) + H) % H) * S + (((x % S) + S) % S)] / 255
    : (x, y) => raw[((((y % H) + H) % H) * S + (((x % S) + S) % S)) * 4] / 255;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * S + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = inv * 255;
      img.data[i + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

/** Fill a canvas with value-noise blotches. Used for grime, tarnish and rust. */
function blotches(g, S, count, radius, colorFn, R, H = S) {
  for (let i = 0; i < count; i++) {
    const x = R() * S, y = R() * H, r = radius[0] + R() * (radius[1] - radius[0]);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const [c0, c1] = colorFn(R);
    grad.addColorStop(0, c0); grad.addColorStop(1, c1);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function hexRGB(hex) {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

// ---------------------------------------------------------------------------
// enamelled painted steel — the perk machine bodies
// ---------------------------------------------------------------------------
// Baked enamel over pressed steel: glossy where intact, chipped through to red
// oxide primer and bare metal at the corners, rust blooming up from the floor,
// a lifetime of trolley scuffs across the middle.
export function enamelMaps(hex, seed = 1, opts = {}) {
  const S = opts.size || 512;
  const R = mulberry32(seed);
  const [br, bg, bb] = hexRGB(hex);
  const col = mkCanvas(S); const c = col.getContext('2d');
  const hgt = mkCanvas(S); const h = hgt.getContext('2d');
  const rgh = mkCanvas(S); const r = rgh.getContext('2d');

  c.fillStyle = `rgb(${br},${bg},${bb})`; c.fillRect(0, 0, S, S);
  h.fillStyle = '#8a8a8a'; h.fillRect(0, 0, S, S);
  // enamel is glossy: dark = smooth in a roughness map
  r.fillStyle = '#4a4a4a'; r.fillRect(0, 0, S, S);

  // roller/spray unevenness — vertical banding, very low contrast
  for (let i = 0; i < 90; i++) {
    const x = R() * S, w = 4 + R() * 34;
    c.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.015 + R() * 0.04})`;
    c.fillRect(x, 0, w, S);
  }
  // orange-peel micro texture in the height map
  for (let i = 0; i < 2600; i++) {
    const v = 128 + Math.floor((R() - 0.5) * 26);
    h.fillStyle = `rgb(${v},${v},${v})`;
    h.fillRect(R() * S, R() * S, 1 + R() * 2, 1 + R() * 2);
  }

  // grime settling downward (v = 1 is the bottom of the panel)
  const grime = c.createLinearGradient(0, S * 0.55, 0, S);
  grime.addColorStop(0, 'rgba(20,17,13,0)');
  grime.addColorStop(1, `rgba(20,17,13,${opts.grime ?? 0.55})`);
  c.fillStyle = grime; c.fillRect(0, 0, S, S);
  const grimeR = r.createLinearGradient(0, S * 0.5, 0, S);
  grimeR.addColorStop(0, 'rgba(255,255,255,0)');
  grimeR.addColorStop(1, 'rgba(255,255,255,0.62)');
  r.fillStyle = grimeR; r.fillRect(0, 0, S, S);

  // dirt blotches
  blotches(c, S, 26, [20, 110], (rr) => [`rgba(28,24,18,${0.05 + rr() * 0.12})`, 'rgba(28,24,18,0)'], R);
  blotches(r, S, 22, [16, 90], (rr) => [`rgba(255,255,255,${0.08 + rr() * 0.2})`, 'rgba(255,255,255,0)'], R);

  // paint chips: irregular polygons through to primer, then to bare steel
  const chip = (cx, cy, rad, fill, hh, rr2) => {
    c.beginPath(); h.beginPath(); r.beginPath();
    const n = 5 + Math.floor(R() * 4);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = rad * (0.55 + R() * 0.75);
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i === 0) { c.moveTo(px, py); h.moveTo(px, py); r.moveTo(px, py); }
      else { c.lineTo(px, py); h.lineTo(px, py); r.lineTo(px, py); }
    }
    c.closePath(); h.closePath(); r.closePath();
    c.fillStyle = fill; c.fill();
    h.fillStyle = hh; h.fill();
    r.fillStyle = rr2; r.fill();
  };
  const chipCount = opts.chips ?? 120;
  for (let i = 0; i < chipCount; i++) {
    // chips concentrate low (kicked) and along the edges (knocked)
    const edge = R() < 0.5;
    const cx = edge ? (R() < 0.5 ? R() * 26 : S - R() * 26) : R() * S;
    const cy = edge ? R() * S : S * (0.45 + R() * 0.55);
    const rad = 2 + R() * (edge ? 7 : 9);
    if (R() < 0.55) chip(cx, cy, rad, `rgba(96,44,26,${0.7 + R() * 0.3})`, '#6e6e6e', '#c8c8c8');
    else chip(cx, cy, rad, `rgba(${58 + R() * 26},${52 + R() * 22},${48 + R() * 20},0.95)`, '#5c5c5c', '#a0a0a0');
  }

  // rust weeping from the floor line and from the lower chips
  const rust = c.createLinearGradient(0, S * 0.72, 0, S);
  rust.addColorStop(0, 'rgba(104,52,24,0)');
  rust.addColorStop(1, `rgba(104,52,24,${opts.rust ?? 0.5})`);
  c.fillStyle = rust; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const x = R() * S, y = S * (0.6 + R() * 0.4), len = 8 + R() * 60;
    c.fillStyle = `rgba(${104 + R() * 40},${48 + R() * 24},${20 + R() * 14},${0.1 + R() * 0.22})`;
    c.fillRect(x, y, 1 + R() * 3, len);
    r.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.3})`;
    r.fillRect(x, y, 1 + R() * 3, len);
  }

  // scuffs — long shallow scratches that catch a highlight
  for (let i = 0; i < 90; i++) {
    const x = R() * S, y = R() * S, len = 10 + R() * 90, a = (R() - 0.5) * 0.5;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = `rgba(226,222,214,${0.05 + R() * 0.12})`;
    c.fillRect(0, 0, len, 1);
    c.restore();
    h.save(); h.translate(x, y); h.rotate(a);
    h.fillStyle = 'rgba(70,70,70,0.5)'; h.fillRect(0, 0, len, 1);
    h.restore();
  }

  return {
    map: finish(col, true),
    normalMap: finish(normalFromHeight(hgt, opts.relief ?? 1.6, BLUR.enamel)),
    roughnessMap: finish(rgh),
  };
}

// ---------------------------------------------------------------------------
// sand-cast iron — the Pack-a-Punch frame, teleporter bases, door jambs
// ---------------------------------------------------------------------------
export function castIronMaps(seed = 7, opts = {}) {
  const S = opts.size || 512;
  const R = mulberry32(seed);
  const col = mkCanvas(S); const c = col.getContext('2d');
  const hgt = mkCanvas(S); const h = hgt.getContext('2d');
  const rgh = mkCanvas(S); const r = rgh.getContext('2d');

  // Base value matters more than it looks: the colour map is *multiplied* by
  // the material colour, so a dark map times a grey tint lands at ~3% albedo
  // and every iron surface in the map renders as a black cut-out under two
  // sodium bulbs. Weathered painted iron sits far lighter than instinct says.
  const base = opts.base || '#8d9096';
  c.fillStyle = base; c.fillRect(0, 0, S, S);
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  r.fillStyle = '#9a9a9a'; r.fillRect(0, 0, S, S);

  // sand-cast grain: dense fine speckle
  for (let i = 0; i < 14000; i++) {
    const x = R() * S, y = R() * S, s = 1 + R() * 2;
    const d = R() < 0.5;
    c.fillStyle = `rgba(${d ? '0,0,0' : '150,148,144'},${0.05 + R() * 0.16})`;
    c.fillRect(x, y, s, s);
    const v = 128 + (d ? -1 : 1) * (10 + R() * 40);
    h.fillStyle = `rgb(${v},${v},${v})`;
    h.fillRect(x, y, s, s);
  }
  // casting pits
  for (let i = 0; i < 220; i++) {
    const x = R() * S, y = R() * S, rad = 1.5 + R() * 4.5;
    c.beginPath(); c.arc(x, y, rad, 0, 7);
    c.fillStyle = `rgba(12,10,9,${0.3 + R() * 0.45})`; c.fill();
    h.beginPath(); h.arc(x, y, rad, 0, 7);
    h.fillStyle = `rgb(${40 + R() * 30},${40 + R() * 30},${40 + R() * 30})`; h.fill();
    r.beginPath(); r.arc(x, y, rad, 0, 7);
    r.fillStyle = 'rgba(255,255,255,0.5)'; r.fill();
  }
  // rust bloom + oil sheen
  blotches(c, S, 34, [22, 120], (rr) => [`rgba(${96 + rr() * 50},${44 + rr() * 26},${18 + rr() * 16},${0.06 + rr() * 0.22})`, 'rgba(90,40,16,0)'], R);
  blotches(r, S, 30, [20, 110], (rr) => [`rgba(255,255,255,${0.12 + rr() * 0.3})`, 'rgba(255,255,255,0)'], R);
  blotches(r, S, 18, [24, 90], (rr) => [`rgba(0,0,0,${0.14 + rr() * 0.3})`, 'rgba(0,0,0,0)'], R);
  // wiped/handled polish streaks
  for (let i = 0; i < 40; i++) {
    const y = R() * S, len = 30 + R() * 180;
    r.fillStyle = `rgba(0,0,0,${0.06 + R() * 0.14})`;
    r.fillRect(R() * S, y, len, 1 + R() * 3);
  }

  return {
    map: finish(col, true),
    normalMap: finish(normalFromHeight(hgt, opts.relief ?? 1.1, BLUR.castIron)),
    roughnessMap: finish(rgh),
  };
}

// ---------------------------------------------------------------------------
// tarnished brass / bronze fittings
// ---------------------------------------------------------------------------
export function brassMaps(seed = 13, opts = {}) {
  const S = opts.size || 256;
  const R = mulberry32(seed);
  const col = mkCanvas(S); const c = col.getContext('2d');
  const rgh = mkCanvas(S); const r = rgh.getContext('2d');
  const hgt = mkCanvas(S); const h = hgt.getContext('2d');

  c.fillStyle = opts.base || '#a8813a'; c.fillRect(0, 0, S, S);
  r.fillStyle = '#3c3c3c'; r.fillRect(0, 0, S, S);
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);

  // turned/polished circumferential streaks
  for (let i = 0; i < 220; i++) {
    const y = R() * S;
    c.fillStyle = `rgba(${R() < 0.5 ? '255,236,190' : '70,48,16'},${0.03 + R() * 0.1})`;
    c.fillRect(0, y, S, 1 + R() * 2);
    r.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + R() * 0.16})`;
    r.fillRect(0, y, S, 1 + R() * 2);
  }
  // tarnish + verdigris in the low spots
  blotches(c, S, 30, [14, 70], (rr) => [`rgba(${46 + rr() * 30},${44 + rr() * 26},${22 + rr() * 16},${0.14 + rr() * 0.3})`, 'rgba(40,38,20,0)'], R);
  blotches(c, S, 10, [10, 40], (rr) => [`rgba(${58 + rr() * 30},${104 + rr() * 30},${82 + rr() * 24},${0.1 + rr() * 0.22})`, 'rgba(58,104,82,0)'], R);
  blotches(r, S, 30, [14, 70], (rr) => [`rgba(255,255,255,${0.2 + rr() * 0.4})`, 'rgba(255,255,255,0)'], R);
  // handling wear polishes it back
  blotches(r, S, 12, [16, 46], (rr) => [`rgba(0,0,0,${0.24 + rr() * 0.3})`, 'rgba(0,0,0,0)'], R);
  for (let i = 0; i < 900; i++) {
    const v = 128 + Math.floor((R() - 0.5) * 22);
    h.fillStyle = `rgb(${v},${v},${v})`;
    h.fillRect(R() * S, R() * S, 1, 1 + R() * 2);
  }

  return {
    map: finish(col, true),
    normalMap: finish(normalFromHeight(hgt, 0.9, BLUR.brass)),
    roughnessMap: finish(rgh),
  };
}

// ---------------------------------------------------------------------------
// weathered crate boarding
// ---------------------------------------------------------------------------
export function plankMaps(seed = 23, opts = {}) {
  const S = opts.size || 512;
  const rows = opts.rows || 5;
  const R = mulberry32(seed);
  const col = mkCanvas(S); const c = col.getContext('2d');
  const hgt = mkCanvas(S); const h = hgt.getContext('2d');
  const rgh = mkCanvas(S); const r = rgh.getContext('2d');

  c.fillStyle = '#100c08'; c.fillRect(0, 0, S, S);      // gap shadow
  h.fillStyle = '#2a2a2a'; h.fillRect(0, 0, S, S);
  r.fillStyle = '#e0e0e0'; r.fillRect(0, 0, S, S);

  const ph = S / rows;
  for (let row = 0; row < rows; row++) {
    const y0 = row * ph + 2, hh = ph - 4;
    const tone = 96 + R() * 34;
    c.fillStyle = `rgb(${Math.round(tone)},${Math.round(tone * 0.84)},${Math.round(tone * 0.62)})`;
    c.fillRect(0, y0, S, hh);
    h.fillStyle = '#b4b4b4'; h.fillRect(0, y0, S, hh);
    r.fillStyle = '#c4c4c4'; r.fillRect(0, y0, S, hh);
    // grain: long wavering strokes along the plank
    for (let i = 0; i < 150; i++) {
      const gy = y0 + R() * hh;
      const dark = R() < 0.55;
      c.strokeStyle = `rgba(${dark ? '46,32,20' : '196,172,138'},${0.05 + R() * 0.22})`;
      c.lineWidth = 0.6 + R() * 1.8;
      c.beginPath(); c.moveTo(0, gy);
      let yy = gy;
      for (let x = 0; x <= S; x += 26) { yy += (R() - 0.5) * 2.6; c.lineTo(x, yy); }
      c.stroke();
      h.strokeStyle = `rgba(${dark ? '90,90,90' : '190,190,190'},0.35)`;
      h.lineWidth = c.lineWidth;
      h.beginPath(); h.moveTo(0, gy);
      yy = gy;
      for (let x = 0; x <= S; x += 26) { yy += (R() - 0.5) * 2.6; h.lineTo(x, yy); }
      h.stroke();
    }
    // knots
    for (let k = 0; k < 2; k++) {
      if (R() > 0.55) continue;
      const kx = R() * S, ky = y0 + hh * (0.25 + R() * 0.5), kr = 4 + R() * 9;
      for (let ring = kr; ring > 0; ring -= 1.6) {
        c.beginPath(); c.ellipse(kx, ky, ring, ring * 0.62, 0, 0, 7);
        c.strokeStyle = `rgba(38,24,14,${0.18 + R() * 0.3})`;
        c.lineWidth = 1.1; c.stroke();
      }
      h.beginPath(); h.ellipse(kx, ky, kr * 0.6, kr * 0.4, 0, 0, 7);
      h.fillStyle = '#8c8c8c'; h.fill();
    }
    // splintered / darkened plank ends
    const endGrad = c.createLinearGradient(0, y0, 0, y0 + hh);
    endGrad.addColorStop(0, 'rgba(20,14,8,0.34)');
    endGrad.addColorStop(0.18, 'rgba(20,14,8,0)');
    endGrad.addColorStop(0.82, 'rgba(20,14,8,0)');
    endGrad.addColorStop(1, 'rgba(20,14,8,0.4)');
    c.fillStyle = endGrad; c.fillRect(0, y0, S, hh);
  }
  // weathering: grey silvering, water stains, mildew
  blotches(c, S, 34, [18, 96], (rr) => [`rgba(${132 + rr() * 40},${128 + rr() * 34},${118 + rr() * 30},${0.05 + rr() * 0.14})`, 'rgba(130,126,116,0)'], R);
  blotches(c, S, 20, [16, 80], (rr) => [`rgba(24,20,14,${0.08 + rr() * 0.2})`, 'rgba(24,20,14,0)'], R);
  blotches(r, S, 26, [16, 90], (rr) => [`rgba(255,255,255,${0.1 + rr() * 0.24})`, 'rgba(255,255,255,0)'], R);
  // gouges
  for (let i = 0; i < 70; i++) {
    const x = R() * S, y = R() * S, len = 6 + R() * 40, a = (R() - 0.5) * 1.2;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = `rgba(30,20,12,${0.14 + R() * 0.3})`; c.fillRect(0, 0, len, 1 + R() * 2);
    c.restore();
    h.save(); h.translate(x, y); h.rotate(a);
    h.fillStyle = 'rgba(60,60,60,0.6)'; h.fillRect(0, 0, len, 1 + R() * 2);
    h.restore();
  }

  return {
    map: finish(col, true),
    normalMap: finish(normalFromHeight(hgt, opts.relief ?? 2.4, BLUR.plank)),
    roughnessMap: finish(rgh),
  };
}

// ---------------------------------------------------------------------------
// stencilled markings (alpha-only, painted over another surface)
// ---------------------------------------------------------------------------
export function stencilTexture(lines, opts = {}) {
  const W = opts.w || 512, H = opts.h || 256;
  const R = mulberry32(opts.seed || 5);
  const c = mkCanvas(W, H); const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const paint = opts.paint || '236,228,206';
  const size = opts.fontSize || Math.floor(H / (lines.length + 0.6));
  g.textAlign = opts.align || 'center';
  g.textBaseline = 'middle';
  const cx = opts.align === 'left' ? 14 : W / 2;
  lines.forEach((ln, i) => {
    const fs = Array.isArray(opts.fontSizes) ? opts.fontSizes[i] : size;
    g.font = `bold ${fs}px "Arial Narrow", "Haettenschweiler", Impact, sans-serif`;
    const y = H * ((i + 0.75) / (lines.length + 0.5));
    // stamp several times at low alpha: dry-brush stencil paint
    for (let s = 0; s < 8; s++) {
      g.fillStyle = `rgba(${paint},${0.1 + R() * 0.09})`;
      g.fillText(ln, cx + (R() - 0.5) * 2.4, y + (R() - 0.5) * 2.4, W - 24);
    }
  });
  // wear: erase flakes and scratches out of the paint
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < (opts.wear ?? 260); i++) {
    g.fillStyle = `rgba(0,0,0,${0.2 + R() * 0.7})`;
    g.fillRect(R() * W, R() * H, 1 + R() * 7, 1 + R() * 3);
  }
  for (let i = 0; i < (opts.blobs ?? 26); i++) {
    g.beginPath(); g.arc(R() * W, R() * H, 2 + R() * 9, 0, 7);
    g.fillStyle = `rgba(0,0,0,${0.25 + R() * 0.5})`; g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  const t = finish(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// yellow/black hazard striping, chipped
// ---------------------------------------------------------------------------
export function hazardTexture(opts = {}) {
  const W = opts.w || 256, H = opts.h || 64;
  const R = mulberry32(opts.seed || 31);
  const c = mkCanvas(W, H); const g = c.getContext('2d');
  g.fillStyle = opts.dark || '#16150f'; g.fillRect(0, 0, W, H);
  g.fillStyle = opts.light || '#c39a24';
  const pitch = opts.pitch || 30;
  g.save();
  for (let x = -H; x < W + H; x += pitch * 2) {
    g.beginPath();
    g.moveTo(x, H); g.lineTo(x + pitch, H); g.lineTo(x + pitch + H, 0); g.lineTo(x + H, 0);
    g.closePath(); g.fill();
  }
  g.restore();
  // grime + chips
  blotches(g, W, 22, [6, 30], (rr) => [`rgba(18,15,10,${0.1 + rr() * 0.3})`, 'rgba(18,15,10,0)'], R, H);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = `rgba(${60 + R() * 40},${54 + R() * 30},${48 + R() * 26},${0.3 + R() * 0.5})`;
    g.fillRect(R() * W, R() * H, 1 + R() * 5, 1 + R() * 3);
  }
  const t = finish(c, true);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// backlit enamel sign face — used for perk marquees and machine placards
// ---------------------------------------------------------------------------
export function signTexture(text, opts = {}) {
  const W = opts.w || 512, H = opts.h || 160;
  const R = mulberry32(opts.seed || 61);
  const c = mkCanvas(W, H); const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#e8e2d2'; g.fillRect(0, 0, W, H);
  // aged, unevenly lit enamel
  blotches(g, W, 16, [20, 110], (rr) => [`rgba(120,104,74,${0.05 + rr() * 0.16})`, 'rgba(120,104,74,0)'], R, H);
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.62);
  vig.addColorStop(0, 'rgba(255,255,255,0.12)');
  vig.addColorStop(1, 'rgba(60,50,34,0.30)');
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
  if (opts.border !== false) {
    g.strokeStyle = opts.borderColor || 'rgba(40,32,22,0.75)';
    g.lineWidth = Math.max(3, H * 0.045);
    g.strokeRect(H * 0.07, H * 0.07, W - H * 0.14, H - H * 0.14);
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = opts.fontSize || Math.floor(H * 0.46);
  g.font = `bold ${fs}px ${opts.font || 'Georgia, "Times New Roman", serif'}`;
  const maxW = W - H * 0.4;
  if (g.measureText(text).width > maxW) {
    fs = Math.floor(fs * maxW / g.measureText(text).width);
    g.font = `bold ${fs}px ${opts.font || 'Georgia, "Times New Roman", serif'}`;
  }
  g.fillStyle = opts.fg || '#1a1712';
  g.fillText(text, W / 2, H * (opts.baseline ?? 0.52), maxW);
  if (opts.sub) {
    g.font = `bold ${Math.floor(fs * 0.34)}px "Arial Narrow", Arial, sans-serif`;
    g.fillStyle = opts.subColor || 'rgba(30,26,18,0.72)';
    g.fillText(opts.sub, W / 2, H * 0.84, maxW);
  }
  // chips and crazing over the whole face
  for (let i = 0; i < 180; i++) {
    g.fillStyle = `rgba(${40 + R() * 40},${36 + R() * 34},${30 + R() * 28},${0.12 + R() * 0.4})`;
    g.fillRect(R() * W, R() * H, 1 + R() * 4, 1 + R() * 2);
  }
  const t = finish(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// frosted / dirty glass — window panes and vacuum tube envelopes
// ---------------------------------------------------------------------------
export function glassRoughness(seed = 71, opts = {}) {
  const S = opts.size || 256;
  const R = mulberry32(seed);
  const c = mkCanvas(S); const g = c.getContext('2d');
  g.fillStyle = opts.base || '#1e1e1e'; g.fillRect(0, 0, S, S);
  blotches(g, S, 30, [14, 80], (rr) => [`rgba(255,255,255,${0.14 + rr() * 0.36})`, 'rgba(255,255,255,0)'], R);
  for (let i = 0; i < 240; i++) {
    g.fillStyle = `rgba(255,255,255,${0.06 + R() * 0.24})`;
    g.fillRect(R() * S, R() * S, 1 + R() * 10, 1 + R() * 2);
  }
  // dust settled at the bottom of the pane
  const grad = g.createLinearGradient(0, S * 0.55, 0, S);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.55)');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  return finish(c);
}

// ---------------------------------------------------------------------------
// shared singletons — every machine pulls from the same few uploads
// ---------------------------------------------------------------------------
const cache = new Map();
function once(key, make) {
  let v = cache.get(key);
  if (!v) { v = make(); cache.set(key, v); }
  return v;
}

export const shared = {
  get iron() { return once('iron', () => castIronMaps(7)); },
  get ironDark() { return once('ironDark', () => castIronMaps(11, { base: '#5b5e63' })); },
  get brass() { return once('brass', () => brassMaps(13)); },
  get copper() { return once('copper', () => brassMaps(17, { base: '#8c5230' })); },
  get planks() { return once('planks', () => plankMaps(23)); },
  get planksFine() { return once('planksFine', () => plankMaps(29, { rows: 8 })); },
  get glassRough() { return once('glassRough', () => glassRoughness(71)); },
  get hazard() { return once('hazard', () => hazardTexture({})); },
};

/** Cast iron. Dark, matte, heavy — the structural material of every machine. */
export function ironMaterial(opts = {}) {
  const m = shared.iron;
  return propMaterial({
    map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap,
    color: opts.color ?? 0xffffff, metalness: opts.metalness ?? 0.45, roughness: opts.roughness ?? 0.7,
    normalScale: new THREE.Vector2(opts.normal ?? 1.1, opts.normal ?? 1.1),
    ...opts.extra,
  }, opts.filter);
}

export function brassMaterial(opts = {}) {
  const m = opts.copper ? shared.copper : shared.brass;
  return propMaterial({
    map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap,
    color: opts.color ?? 0xffffff, metalness: 1.0, roughness: opts.roughness ?? 0.46,
    normalScale: new THREE.Vector2(0.7, 0.7),
    ...opts.extra,
  }, opts.filter);
}

/** Set the world-space UV density of a geometry's box-projected UVs. */
export function scaleUV(geo, su, sv = su) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}

// Procedural PBR material library for first-person weapon view-models.
//
// Everything here is generated once on a canvas and shared across every gun:
// there is only ever one visible view-model, but the pick-up box, the cinematic
// director and the Pack-a-Punch output all build weapons too, so per-weapon
// texture copies would be pure waste.
//
// Design notes
//  - The renderer runs NoToneMapping into an HDR buffer with an AgX post stack
//    and a PMREM night-sky environment. Metals therefore want metalness 1.0 and
//    a real roughness MAP so the sky IBL breaks up across the surface instead of
//    producing one flat specular wash.
//  - View-models are camera-attached, so world-space triplanar detail (the
//    shared Materials.js helper) is wrong here — these are UV-space maps.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// canvas helpers
// ---------------------------------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas2d(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, g: c.getContext('2d', { willReadFrequently: true }) };
}

function texture(c, { srgb = false, repeat = 1, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

// Sobel height -> tangent-space normal.
//
// NO BAND-LIMITING BLUR, DELIBERATELY — the one height-field path in the project
// without one. map.js box-blurs the brick; props/materials.js carries a
// per-generator BLUR table and throws without a radius; Materials.js's
// detailNormalTexture is exempt because it is band-limited by construction. This
// one is exempt for a different reason, and it was measured rather than assumed.
//
// A pre-blur only band-limits the BASE level, so it is the right tool exactly
// when a surface is read at around one texel per pixel — that is where the
// sampler has no mip to fall back on. The props live there: ~556 texels/m read
// from 1.5 m is 1.9 texels/pixel, and radius 2 takes castIron's per-texel normal
// swing from 4.13 deg to 0.88 at mip 0 and 4.79 to 1.39 at mip 1. That is the
// whole reason that table exists.
//
// Weapon surfaces are never there. Measured on the shipped 110/75-degree cameras
// at a 1920x1080 render target, p50 texels per pixel:
//   viewmodel, hip   ironDark 0.60, machined 0.85, phosphate 1.03, blued 1.05,
//                    glove 1.07, woodChecker 2.57 — magnified, not minified.
//   viewmodel, ADS   ~22% lower again. renderViewmodel() narrows the viewmodel
//                    lens to 58.5 deg, so aiming MAGNIFIES the receiver and the
//                    rear sight further. ADS is the safe end, not the risky one.
//   world display    the mystery-box prize, the Pack-a-Punch output and the
//                    rifle on a teammate's back are this same library at
//                    authored metres: >=2.9 texels/px at 1 m, >=5.7 at 2 m, >=14
//                    at 5 m, and past 1.5 m no part of the weapon is left in the
//                    1-3 band at all.
//   wall buys        do not use these maps — weaponSilhouette.js rasterises the
//                    geometry into flat line art instead.
// So the viewmodel sits below the window and the world weapons sit well above
// it. On `machined`, radius 2 removes 66% of the tangential amplitude at mip 0
// and 7% at mip 4 — and the world weapons read mip 2.5 and up.
//
// The raw per-texel swing looks alarming (machined 4.83 deg, hide 4.84, checker
// 12.5, against castIron's pre-fix 4.13) but it is not aliasing. With the game
// loop stopped — a still frame differences to exactly zero, and restoring the
// textures returns to exactly zero — stepping 1/3 of a pixel and scoring the
// excess total variation over three frames:
//   viewmodel (40108 px on screen, 13361 of them moving) the normal maps are 54%
//   of the oscillation and radius 2 would remove 42% of it; under 4x
//   supersampling that share is still 53%. Aliasing falls when you raise the
//   sampling rate. This does not move. The absolute figure does fall, 15707 ->
//   9820, which is silhouette aliasing being resolved — the metric can see
//   aliasing, there simply is none here. What radius 2 would delete is 42% of
//   the machining lines and scratches, about one screen pixel wide each, on the
//   one object the player looks at all game.
//   world weapon the maps are 14% of the oscillation at 1 m, 10% at 2 m, 5% at
//   3 m and nothing by 5 m — and that share refuses to fall under supersampling
//   too (14% -> 26%, and up in absolute terms). Mipmaps plus anisotropy 8 are
//   already carrying it; the remainder is silhouette, which no texture filter
//   reaches.
//
// Both halves matter, because there is ONE shared library: a radius chosen for
// the world weapons is charged in full to the viewmodel, and the bill would be
// 42% of its relief to fix an aliasing defect that exists on neither path.
// Blurring a magnified texture is not band-limiting, it is shipping a fifth of
// the resolution.
//
// If this is ever revisited, the two numbers that decide it are texels per pixel
// on the surface in question and whether the oscillation falls under
// supersampling. An A/B here is clean: every generator is seeded through
// `rng(seed)`, there is no Math.random in this file, and each map hashes
// bit-identical across page loads — unlike detailNormalTexture and the brick
// speckle, which rebuild differently every load.
/** Sobel a luminance canvas into a tangent-space normal map canvas. */
function normalFromHeight(src, size, strength) {
  const sg = src.getContext('2d', { willReadFrequently: true });
  const h = sg.getImageData(0, 0, size, size).data;
  const { c, g } = canvas2d(size);
  const out = g.createImageData(size, size);
  const at = (x, y) => h[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      out.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// surface generators
// ---------------------------------------------------------------------------

/**
 * Machined / brushed steel. `finish` shifts the character:
 *   'machined' – lathe-turned circumferential tooling ridges
 *   'brushed'  – long directional polish streaks
 *   'cast'     – coarse phosphate / parkerised grain, no direction
 *   'stamped'  – rolled sheet with dents, ripples and wear scuffs
 */
function steelSurface(seed, finish, opts = {}) {
  const size = opts.size || 256;
  const R = rng(seed);
  const { c: hc, g: hg } = canvas2d(size);
  const { c: rc, g: rg } = canvas2d(size);
  const roughBase = opts.rough ?? 0.38;

  hg.fillStyle = '#808080'; hg.fillRect(0, 0, size, size);
  const rb = Math.round(roughBase * 255);
  rg.fillStyle = `rgb(${rb},${rb},${rb})`; rg.fillRect(0, 0, size, size);

  // --- base grain -----------------------------------------------------------
  if (finish === 'cast') {
    for (let i = 0; i < size * 26; i++) {
      const x = R() * size, y = R() * size, r = 0.6 + R() * 2.4;
      const v = R() < 0.5 ? 0 : 255;
      hg.fillStyle = `rgba(${v},${v},${v},${0.05 + R() * 0.16})`;
      hg.beginPath(); hg.arc(x, y, r, 0, 7); hg.fill();
      rg.fillStyle = `rgba(255,255,255,${R() * 0.09})`;
      rg.beginPath(); rg.arc(x, y, r * 1.6, 0, 7); rg.fill();
    }
  } else if (finish === 'stamped') {
    // rolled sheet: soft broad ripples plus press dents
    for (let i = 0; i < 46; i++) {
      const y = R() * size, hgt = 6 + R() * 26;
      const grd = hg.createLinearGradient(0, y, 0, y + hgt);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.5, `rgba(255,255,255,${0.06 + R() * 0.1})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      hg.fillStyle = grd; hg.fillRect(0, y, size, hgt);
    }
    for (let i = 0; i < size * 8; i++) {
      const x = R() * size, y = R() * size, r = 0.5 + R() * 1.8;
      hg.fillStyle = `rgba(0,0,0,${0.04 + R() * 0.1})`;
      hg.beginPath(); hg.arc(x, y, r, 0, 7); hg.fill();
    }
  } else {
    // machined / brushed: dense directional micro lines
    const vertical = finish === 'machined';
    for (let i = 0; i < size * 5; i++) {
      const p = R() * size;
      const len = vertical ? size : size * (0.3 + R() * 0.7);
      const off = R() * size;
      const a = 0.03 + R() * 0.13;
      const v = R() < 0.5 ? 0 : 255;
      hg.strokeStyle = `rgba(${v},${v},${v},${a})`;
      hg.lineWidth = R() < 0.85 ? 1 : 2;
      hg.beginPath();
      if (vertical) { hg.moveTo(0, p); hg.lineTo(size, p); }
      else { hg.moveTo(off, p); hg.lineTo(off + len, p + (R() - 0.5) * 3); }
      hg.stroke();
      rg.strokeStyle = `rgba(0,0,0,${a * 0.7})`;
      rg.lineWidth = hg.lineWidth;
      rg.beginPath();
      if (vertical) { rg.moveTo(0, p); rg.lineTo(size, p); }
      else { rg.moveTo(off, p); rg.lineTo(off + len, p + (R() - 0.5) * 3); }
      rg.stroke();
    }
  }

  // --- handling wear: scratches (polished => smoother) ----------------------
  const nScratch = opts.scratches ?? 90;
  for (let i = 0; i < nScratch; i++) {
    const x = R() * size, y = R() * size, ang = R() * Math.PI * 2;
    const len = 6 + R() * 60;
    const w = R() < 0.8 ? 1 : 2;
    hg.save(); hg.translate(x, y); hg.rotate(ang);
    hg.strokeStyle = `rgba(255,255,255,${0.14 + R() * 0.3})`;
    hg.lineWidth = w; hg.beginPath(); hg.moveTo(0, 0); hg.lineTo(len, 0); hg.stroke();
    hg.restore();
    rg.save(); rg.translate(x, y); rg.rotate(ang);
    rg.strokeStyle = `rgba(0,0,0,${0.22 + R() * 0.35})`;
    rg.lineWidth = w + 1; rg.beginPath(); rg.moveTo(0, 0); rg.lineTo(len, 0); rg.stroke();
    rg.restore();
  }
  // --- pitting / corrosion speckle (rougher) --------------------------------
  for (let i = 0; i < (opts.pits ?? 140); i++) {
    const x = R() * size, y = R() * size, r = 0.7 + R() * 3.2;
    hg.fillStyle = `rgba(0,0,0,${0.12 + R() * 0.3})`;
    hg.beginPath(); hg.arc(x, y, r, 0, 7); hg.fill();
    rg.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.45})`;
    rg.beginPath(); rg.arc(x, y, r * 1.3, 0, 7); rg.fill();
  }
  // broad roughness mottling so the sky IBL never looks uniform
  for (let i = 0; i < 22; i++) {
    const x = R() * size, y = R() * size, r = 18 + R() * 70;
    const grd = rg.createRadialGradient(x, y, 0, x, y, r);
    const dir = R() < 0.5 ? 0 : 255;
    grd.addColorStop(0, `rgba(${dir},${dir},${dir},${0.05 + R() * 0.12})`);
    grd.addColorStop(1, `rgba(${dir},${dir},${dir},0)`);
    rg.fillStyle = grd; rg.beginPath(); rg.arc(x, y, r, 0, 7); rg.fill();
  }

  const normal = normalFromHeight(hc, size, opts.strength ?? 1.8);
  return {
    normalMap: texture(normal, { repeat: opts.repeat ?? 2 }),
    roughnessMap: texture(rc, { repeat: opts.repeat ?? 2 }),
  };
}

/** Walnut / beech stock: grain albedo, matching normal, grain-locked roughness. */
function woodSurface(seed, light, dark, opts = {}) {
  const size = opts.size || 256;
  const R = rng(seed);
  const { c: ac, g: ag } = canvas2d(size);
  const { c: hc, g: hg } = canvas2d(size);
  const { c: rc, g: rg } = canvas2d(size);

  const warp = new Float32Array(size * size);
  // two octaves of smooth value noise for grain warping
  for (const [freq, amp] of [[4, 1], [9, 0.45], [19, 0.22]]) {
    const gr = new Float32Array((freq + 1) * (freq + 1));
    for (let i = 0; i < gr.length; i++) gr[i] = R();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * freq, fy = (y / size) * freq;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = gr[y0 * (freq + 1) + x0], b = gr[y0 * (freq + 1) + x0 + 1];
        const cc = gr[(y0 + 1) * (freq + 1) + x0], d = gr[(y0 + 1) * (freq + 1) + x0 + 1];
        const top = a + (b - a) * sx, bot = cc + (d - cc) * sx;
        warp[y * size + x] += (top + (bot - top) * sy) * amp;
      }
    }
  }

  const lc = new THREE.Color(light), dc = new THREE.Color(dark);
  const aimg = ag.createImageData(size, size);
  const himg = hg.createImageData(size, size);
  const rimg = rg.createImageData(size, size);
  const rings = opts.rings ?? 13;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const w = warp[i] / 1.67;
      // grain runs along +X (barrel axis) — warped ring bands across it
      let v = Math.sin((y / size) * Math.PI * 2 * rings + w * 5.2 + Math.sin(x / size * 3.1) * 1.4);
      v = Math.pow(Math.abs(v), 0.85) * Math.sign(v) * 0.5 + 0.5;
      // fine pore streaks
      const pore = (Math.sin(y * 2.7 + w * 30) * 0.5 + 0.5) * 0.22;
      const t = Math.min(1, Math.max(0, 0.18 + v * 0.56 + pore * 0.3 + (w - 0.5) * 0.20));
      const j = i * 4;
      aimg.data[j] = (dc.r + (lc.r - dc.r) * t) * 255;
      aimg.data[j + 1] = (dc.g + (lc.g - dc.g) * t) * 255;
      aimg.data[j + 2] = (dc.b + (lc.b - dc.b) * t) * 255;
      aimg.data[j + 3] = 255;
      const hv = 128 + (t - 0.5) * 90;
      himg.data[j] = himg.data[j + 1] = himg.data[j + 2] = hv;
      himg.data[j + 3] = 255;
      // dark late-wood is more open-pored => rougher
      const rv = (opts.rough ?? 0.52) + (1 - t) * 0.22;
      rimg.data[j] = rimg.data[j + 1] = rimg.data[j + 2] = rv * 255;
      rimg.data[j + 3] = 255;
    }
  }
  ag.putImageData(aimg, 0, 0);
  hg.putImageData(himg, 0, 0);
  rg.putImageData(rimg, 0, 0);

  // handling polish + dings on the wood
  for (let i = 0; i < 26; i++) {
    const x = R() * size, y = R() * size, r = 6 + R() * 26;
    const grd = rg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(0,0,0,${0.08 + R() * 0.16})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    rg.fillStyle = grd; rg.beginPath(); rg.arc(x, y, r, 0, 7); rg.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = R() * size, y = R() * size, ang = R() * 6.28, len = 4 + R() * 24;
    hg.save(); hg.translate(x, y); hg.rotate(ang);
    hg.strokeStyle = `rgba(0,0,0,${0.2 + R() * 0.35})`; hg.lineWidth = 1 + R() * 2;
    hg.beginPath(); hg.moveTo(0, 0); hg.lineTo(len, 0); hg.stroke(); hg.restore();
  }

  return {
    map: texture(ac, { srgb: true, repeat: opts.repeat ?? 1 }),
    normalMap: texture(normalFromHeight(hc, size, opts.strength ?? 1.1), { repeat: opts.repeat ?? 1 }),
    roughnessMap: texture(rc, { repeat: opts.repeat ?? 1 }),
  };
}

/** Pebbled leather glove: grain cells, seam stitching, worn shine on knuckles. */
function leatherSurface(seed, opts = {}) {
  const size = opts.size || 256;
  const R = rng(seed);
  const { c: hc, g: hg } = canvas2d(size);
  const { c: rc, g: rg } = canvas2d(size);
  hg.fillStyle = '#6e6e6e'; hg.fillRect(0, 0, size, size);
  rg.fillStyle = '#b4b4b4'; rg.fillRect(0, 0, size, size);
  // pebble cells
  for (let i = 0; i < size * 3.2; i++) {
    const x = R() * size, y = R() * size, r = 2 + R() * 5.5;
    const grd = hg.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${0.22 + R() * 0.3})`);
    grd.addColorStop(0.72, 'rgba(128,128,128,0.10)');
    grd.addColorStop(1, 'rgba(0,0,0,0.30)');
    hg.fillStyle = grd; hg.beginPath(); hg.arc(x, y, r, 0, 7); hg.fill();
    rg.fillStyle = `rgba(0,0,0,${R() * 0.18})`;
    rg.beginPath(); rg.arc(x, y, r * 0.6, 0, 7); rg.fill();
  }
  // creases
  for (let i = 0; i < 30; i++) {
    const x = R() * size, y = R() * size, ang = R() * 6.28;
    hg.save(); hg.translate(x, y); hg.rotate(ang);
    hg.strokeStyle = `rgba(0,0,0,${0.2 + R() * 0.3})`; hg.lineWidth = 1 + R() * 2.5;
    hg.beginPath(); hg.moveTo(0, 0);
    hg.quadraticCurveTo(20 + R() * 20, (R() - 0.5) * 22, 40 + R() * 50, (R() - 0.5) * 30);
    hg.stroke(); hg.restore();
  }
  // stitch rows
  for (let i = 0; i < 5; i++) {
    const y = R() * size;
    for (let x = 0; x < size; x += 7) {
      hg.fillStyle = 'rgba(255,255,255,0.5)';
      hg.fillRect(x, y, 4, 1.6);
      rg.fillStyle = 'rgba(0,0,0,0.30)';
      rg.fillRect(x, y, 4, 1.6);
    }
  }
  return {
    normalMap: texture(normalFromHeight(hc, size, opts.strength ?? 1.15), { repeat: opts.repeat ?? 5 }),
    roughnessMap: texture(rc, { repeat: opts.repeat ?? 5 }),
  };
}

/** Bakelite / phenolic resin: swirled marbling, glossy with a fine orange peel. */
function bakeliteSurface(seed) {
  const size = 256;
  const R = rng(seed);
  const { c: ac, g: ag } = canvas2d(size);
  const { c: hc, g: hg } = canvas2d(size);
  ag.fillStyle = '#ffffff'; ag.fillRect(0, 0, size, size);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = R() * size, y = R() * size;
    ag.save(); ag.translate(x, y); ag.rotate(R() * 6.28);
    ag.strokeStyle = R() < 0.5 ? `rgba(255,232,205,${0.1 + R() * 0.2})` : `rgba(60,30,18,${0.1 + R() * 0.22})`;
    ag.lineWidth = 2 + R() * 9;
    ag.beginPath(); ag.moveTo(-40, 0);
    ag.bezierCurveTo(-10, (R() - 0.5) * 40, 10, (R() - 0.5) * 40, 60, (R() - 0.5) * 20);
    ag.stroke(); ag.restore();
  }
  for (let i = 0; i < size * 4; i++) {
    const x = R() * size, y = R() * size, r = 1 + R() * 3;
    hg.fillStyle = `rgba(${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},128,${0.05 + R() * 0.1})`;
    hg.beginPath(); hg.arc(x, y, r, 0, 7); hg.fill();
  }
  return {
    map: texture(ac, { srgb: true, repeat: 2 }),
    normalMap: texture(normalFromHeight(hc, size, 0.9), { repeat: 2 }),
  };
}

/** Diamond checkering for grip panels and stock wrists. */
function checkerSurface(seed, pitch = 16) {
  const size = 256;
  const { c: hc, g: hg } = canvas2d(size);
  const { c: rc, g: rg } = canvas2d(size);
  hg.fillStyle = '#3c3c3c'; hg.fillRect(0, 0, size, size);
  rg.fillStyle = '#c8c8c8'; rg.fillRect(0, 0, size, size);
  hg.lineWidth = pitch * 0.42;
  for (let d = -size; d < size * 2; d += pitch) {
    for (const s of [1, -1]) {
      const grd = hg.createLinearGradient(0, 0, 6 * s, 6);
      grd.addColorStop(0, 'rgba(255,255,255,0.85)');
      grd.addColorStop(1, 'rgba(120,120,120,0.85)');
      hg.strokeStyle = grd;
      hg.beginPath(); hg.moveTo(d, 0); hg.lineTo(d + s * size, size); hg.stroke();
    }
  }
  // pyramid tips catch light -> slightly polished
  for (let d = -size; d < size * 2; d += pitch) {
    rg.strokeStyle = 'rgba(0,0,0,0.22)'; rg.lineWidth = 2;
    rg.beginPath(); rg.moveTo(d, 0); rg.lineTo(d + size, size); rg.stroke();
    rg.beginPath(); rg.moveTo(d, 0); rg.lineTo(d - size, size); rg.stroke();
  }
  return {
    normalMap: texture(normalFromHeight(hc, size, 2.2), { repeat: 9 }),
    roughnessMap: texture(rc, { repeat: 9 }),
  };
}

/** Etched arcane panelling for the Pack-a-Punch finish. */
function etchSurface(seed) {
  const size = 256;
  const R = rng(seed);
  const { c: hc, g: hg } = canvas2d(size);
  const { c: ec, g: eg } = canvas2d(size);
  hg.fillStyle = '#8c8c8c'; hg.fillRect(0, 0, size, size);
  eg.fillStyle = '#000000'; eg.fillRect(0, 0, size, size);
  // The height pass and the emissive pass walk an identical random sequence so
  // the glow sits exactly inside the engraved channel.
  const tracery = (ctx, style, w) => {
    const r = rng(seed);
    ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      let x = r() * size, y = r() * size;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        const dir = Math.floor(r() * 4);
        const len = 8 + r() * 34;
        if (dir === 0) x += len; else if (dir === 1) x -= len;
        else if (dir === 2) y += len; else y -= len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const x = r() * size, y = r() * size, rad = 5 + r() * 16;
      ctx.beginPath(); ctx.arc(x, y, rad, r() * 6.28, r() * 6.28 + 2 + r() * 3); ctx.stroke();
    }
  };
  tracery(hg, 'rgba(18,18,18,0.95)', 3.2);
  tracery(eg, 'rgba(255,255,255,1)', 2.0);
  void R;
  return {
    normalMap: texture(normalFromHeight(hc, size, 2.4), { repeat: 2 }),
    emissiveMap: texture(ec, { repeat: 2 }),
  };
}

// ---------------------------------------------------------------------------
// material library (lazy — canvases are only built on first weapon build)
// ---------------------------------------------------------------------------
let _lib = null;

function buildLibrary() {
  const machined = steelSurface(1337, 'machined', { rough: 0.34, scratches: 70, pits: 90, repeat: 3, strength: 1.2 });
  const blued = steelSurface(4242, 'brushed', { rough: 0.30, scratches: 120, pits: 70, repeat: 3, strength: 1.2 });
  const phos = steelSurface(9001, 'cast', { rough: 0.62, scratches: 60, pits: 200, repeat: 4, strength: 0.8 });
  const stamp = steelSurface(777, 'stamped', { rough: 0.44, scratches: 160, pits: 130, repeat: 3, strength: 1.2 });
  const polish = steelSurface(313, 'brushed', { rough: 0.16, scratches: 60, pits: 25, repeat: 3, strength: 1.1 });
  const walnut = woodSurface(21, 0x7a5c3c, 0x2f2317, { rings: 6, rough: 0.60, repeat: 3 });
  const walnutDark = woodSurface(52, 0x5c4632, 0x1d160f, { rings: 8, rough: 0.64, repeat: 3 });
  const beech = woodSurface(88, 0x8d7854, 0x463726, { rings: 5, rough: 0.56, repeat: 3 });
  const hide = leatherSurface(5150);
  // Finer, softer grain for plush and felt — same generator, different seed.
  const fuzz = leatherSurface(9317, { size: 256 });
  const resin = bakeliteSurface(606);
  const checker = checkerSurface(31, 15);
  const etch = etchSurface(1212);

  const std = (o) => new THREE.MeshStandardMaterial(o);

  const L = {
    // ---- ferrous ----------------------------------------------------------
    /** Deep blued receiver steel — the default WWII gun-metal. */
    blued: std({
      color: 0x4d545e, metalness: 1.0, roughness: 0.34, envMapIntensity: 1.15,
      ...blued,
    }),
    /** Machined bright parts: bolts, pins, charging handles, cylinder flutes. */
    machined: std({
      color: 0x7e8794, metalness: 1.0, roughness: 0.26, envMapIntensity: 1.3,
      ...machined,
    }),
    /** Parkerised / phosphate: matte, hungry, drinks the light. */
    phosphate: std({
      color: 0x51544e, metalness: 1.0, roughness: 0.66, envMapIntensity: 0.9,
      ...phos,
    }),
    /** Stamped sheet steel — MP40 housings, magazine bodies, shrouds. */
    stamped: std({
      color: 0x5a6069, metalness: 1.0, roughness: 0.44, envMapIntensity: 1.1,
      ...stamp,
    }),
    /** Polished, near-mirror steel — bolt faces, sight blades, knife blades. */
    polished: std({
      color: 0x99a2ad, metalness: 1.0, roughness: 0.17, envMapIntensity: 1.5,
      ...polish,
    }),
    /** Dark parkerised furniture-adjacent steel, sights and small hardware. */
    ironDark: std({
      color: 0x3a3e44, metalness: 1.0, roughness: 0.42, envMapIntensity: 1.0,
      normalMap: blued.normalMap, roughnessMap: phos.roughnessMap,
    }),
    /** Cartridge brass / bronze fittings. */
    brass: std({
      color: 0xb08b3e, metalness: 1.0, roughness: 0.31, envMapIntensity: 1.35,
      normalMap: machined.normalMap, roughnessMap: machined.roughnessMap,
    }),
    copper: std({
      color: 0xa9613a, metalness: 1.0, roughness: 0.36, envMapIntensity: 1.25,
      normalMap: machined.normalMap, roughnessMap: machined.roughnessMap,
    }),

    // ---- non-metals -------------------------------------------------------
    wood: std({ color: 0xffffff, metalness: 0.0, roughness: 0.62, envMapIntensity: 0.42, ...walnut }),
    woodDark: std({ color: 0xffffff, metalness: 0.0, roughness: 0.66, envMapIntensity: 0.38, ...walnutDark }),
    woodLight: std({ color: 0xffffff, metalness: 0.0, roughness: 0.58, envMapIntensity: 0.45, ...beech }),
    /** Checkered wood — grip panels, stock wrists. */
    woodChecker: std({
      color: 0x6c4726, metalness: 0.0, roughness: 0.68, envMapIntensity: 0.38,
      map: walnutDark.map, normalMap: checker.normalMap, roughnessMap: checker.roughnessMap,
      normalScale: new THREE.Vector2(0.32, 0.32),
    }),
    bakelite: std({
      color: 0x582a1a, metalness: 0.0, roughness: 0.44, envMapIntensity: 0.9, ...resin,
    }),
    /** Black polymer — modern furniture, pistol grips, rails. */
    polymer: std({
      color: 0x25272b, metalness: 0.0, roughness: 0.55, envMapIntensity: 0.7,
      normalMap: resin.normalMap, roughnessMap: phos.roughnessMap,
    }),
    polymerTan: std({
      color: 0x6d6248, metalness: 0.0, roughness: 0.6, envMapIntensity: 0.7,
      normalMap: resin.normalMap, roughnessMap: phos.roughnessMap,
    }),
    /** Stippled/checkered polymer grip surface. */
    grip: std({
      color: 0x1a1c1f, metalness: 0.0, roughness: 0.74, envMapIntensity: 0.5,
      normalMap: checker.normalMap, roughnessMap: checker.roughnessMap,
      normalScale: new THREE.Vector2(0.30, 0.30),
    }),
    rubber: std({ color: 0x17181a, metalness: 0.0, roughness: 0.86, envMapIntensity: 0.4, normalMap: hide.normalMap }),
    leather: std({
      color: 0x3a2e21, metalness: 0.0, roughness: 0.78, envMapIntensity: 0.6, ...hide,
    }),
    /** Combat glove — the hands. */
    glove: std({
      color: 0x211d19, metalness: 0.0, roughness: 0.82, envMapIntensity: 0.55, ...hide,
    }),
    gloveDark: std({
      color: 0x141311, metalness: 0.0, roughness: 0.86, envMapIntensity: 0.5, ...hide,
    }),
    canvasStrap: std({
      color: 0x2e2f26, metalness: 0.0, roughness: 0.9, envMapIntensity: 0.4,
      normalMap: hide.normalMap, roughnessMap: hide.roughnessMap,
    }),
    /** The inside of a barrel. Reads as a real hole. */
    bore: std({ color: 0x050506, metalness: 0.35, roughness: 0.85, envMapIntensity: 0.15 }),
    /** Recessed interiors: ejection ports, cooling holes, magwells. */
    cavity: std({ color: 0x0b0c0e, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.35 }),
    glass: std({
      color: 0x0c1a26, metalness: 0.2, roughness: 0.06, envMapIntensity: 2.2,
      transparent: true, opacity: 0.55, depthWrite: false,
    }),
    lens: std({
      color: 0x0a1420, metalness: 0.8, roughness: 0.07, envMapIntensity: 2.4,
      emissive: 0x1d3f5c, emissiveIntensity: 0.35,
    }),

    // ---- emissives --------------------------------------------------------
    rayGlow: std({ color: 0x0b2417, emissive: 0x2aff7a, emissiveIntensity: 1.25, roughness: 0.35, metalness: 0.2 }),
    rayGlass: std({ color: 0x0a2016, emissive: 0x38ff8c, emissiveIntensity: 0.85, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.85 }),
    teslaGlow: std({ color: 0x081426, emissive: 0x49a5ff, emissiveIntensity: 1.5, roughness: 0.35, metalness: 0.2 }),
    teslaGlass: std({ color: 0x082430, emissive: 0x50d8f5, emissiveIntensity: 1.05, roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.8 }),
    dot: std({ color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 4.0, roughness: 0.4 }),

    // ---- Monkey Bomb ------------------------------------------------------
    // A 1940s wind-up toy strapped with demolition charges. Everything soft is
    // fully dielectric and rough with a fine grain; everything metal is
    // metalness 1.0 with a real roughness map, so the sky probe breaks across
    // the cymbals instead of leaving them a flat yellow disc.
    /** Worn plush, matted and grubby at the seams. */
    toyFur: std({ color: 0x6a4a2c, metalness: 0.0, roughness: 0.97, envMapIntensity: 0.45, ...fuzz }),
    /** Pale plush: face, muzzle, ears, palms. */
    toyFurPale: std({ color: 0xc9b189, metalness: 0.0, roughness: 0.95, envMapIntensity: 0.5, ...fuzz }),
    /** Red felt jacket and fez, faded and rubbed thin on the edges. */
    toyFelt: std({ color: 0x8e1a17, metalness: 0.0, roughness: 0.93, envMapIntensity: 0.5, ...fuzz }),
    toyFeltDark: std({ color: 0x4d0f0e, metalness: 0.0, roughness: 0.94, envMapIntensity: 0.45, ...fuzz }),
    /** Gold braid and buttons — tarnished, not chrome. */
    toyGold: std({
      color: 0xa8802f, metalness: 1.0, roughness: 0.38, envMapIntensity: 1.25,
      normalMap: machined.normalMap, roughnessMap: machined.roughnessMap,
    }),
    /** Struck brass. Deliberately the brightest thing on the toy. */
    toyCymbal: std({
      color: 0xc39a44, metalness: 1.0, roughness: 0.22, envMapIntensity: 1.7,
      normalMap: polish.normalMap, roughnessMap: polish.roughnessMap,
    }),
    /** Waxed-paper demolition charge. */
    toyCharge: std({ color: 0x6d6647, metalness: 0.0, roughness: 0.82, envMapIntensity: 0.5, normalMap: hide.normalMap }),
    /** Friction tape holding the charges on. */
    toyTape: std({ color: 0x14140f, metalness: 0.0, roughness: 0.72, envMapIntensity: 0.35, normalMap: hide.normalMap }),
    toyWireRed: std({ color: 0x8a1410, metalness: 0.0, roughness: 0.5, envMapIntensity: 0.6 }),
    toyWireBlue: std({ color: 0x1b3d6b, metalness: 0.0, roughness: 0.5, envMapIntensity: 0.6 }),
    /** Bakelite detonator housing. */
    toyDet: std({ color: 0x1d1a16, metalness: 0.0, roughness: 0.45, envMapIntensity: 0.7, ...resin }),
    /** The arming lamp. Bloom catches this. */
    toyLamp: std({ color: 0x2a0603, emissive: 0xff3a1a, emissiveIntensity: 2.6, roughness: 0.3, metalness: 0.1 }),
    toyEye: std({ color: 0xd8d2c6, metalness: 0.0, roughness: 0.24, envMapIntensity: 1.0 }),
    toyPupil: std({ color: 0x0b0906, metalness: 0.0, roughness: 0.18, envMapIntensity: 1.2 }),
    /**
     * The reticle itself. Unlit and untonemapped so the dot survives AgX at
     * any exposure, additive so it reads as light on the glass rather than a
     * painted spot, and depth-write-free so it never punches a hole in the
     * elements around it. Luminance is deliberately above the bloom threshold.
     */
    dotCore: new THREE.MeshBasicMaterial({
      color: 0xff5a3a, toneMapped: false, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
    dotHalo: new THREE.MeshBasicMaterial({
      color: 0xff2a12, toneMapped: false, transparent: true, opacity: 0.26,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),

    // ---- Pack-a-Punch -----------------------------------------------------
    /** Dark anodised alloy body. */
    papBody: std({
      color: 0x2b2434, metalness: 1.0, roughness: 0.22, envMapIntensity: 1.45,
      normalMap: blued.normalMap, roughnessMap: polish.roughnessMap,
    }),
    /** Etched panelling that glows in the engraving. */
    papEtch: std({
      color: 0x1f1b2b, metalness: 1.0, roughness: 0.26, envMapIntensity: 1.4,
      normalMap: etch.normalMap, emissiveMap: etch.emissiveMap,
      emissive: 0xa24bff, emissiveIntensity: 1.35,
    }),
    /** Polished chrome trim. */
    papChrome: std({
      color: 0xc6cfda, metalness: 1.0, roughness: 0.11, envMapIntensity: 1.8,
      normalMap: polish.normalMap, roughnessMap: polish.roughnessMap,
    }),
    papDark: std({
      color: 0x4a4356, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.3,
      normalMap: blued.normalMap, roughnessMap: blued.roughnessMap,
    }),
    /** Hot accent strips — these bloom. */
    papGlow: std({ color: 0x1a0a2a, emissive: 0xb45cff, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.2 }),
    papCore: std({ color: 0x2a1040, emissive: 0xff7ae0, emissiveIntensity: 2.8, roughness: 0.25, metalness: 0.1 }),
  };

  // ---- legacy aliases kept so older call sites keep working ---------------
  L.steel = L.blued;
  L.steelDark = L.ironDark;
  L.steelLight = L.machined;

  // Shared library materials must survive disposePapDisplayWeapon().
  for (const k of Object.keys(L)) L[k].userData.wmShared = true;

  return L;
}

/** Lazy, shared material library. `WM.blued`, `WM.wood`, ... */
export const WM = new Proxy({}, {
  get: (_, k) => (_lib || (_lib = buildLibrary()))[k],
  has: (_, k) => k in (_lib || (_lib = buildLibrary())),
  ownKeys: () => Reflect.ownKeys(_lib || (_lib = buildLibrary())),
  getOwnPropertyDescriptor: (_, k) => ({
    configurable: true, enumerable: true, value: (_lib || (_lib = buildLibrary()))[k],
  }),
});

/**
 * Per-weapon material slots. `pap` swaps the ferrous set for the anodised
 * Pack-a-Punch finish while leaving the non-metals (wood, leather) recognisable
 * so the silhouette still reads as the same gun.
 */
export function matSet(pap) {
  const m = WM;
  if (!pap) {
    return {
      body: m.blued, dark: m.ironDark, bright: m.machined, matte: m.phosphate,
      sheet: m.stamped, polish: m.polished, wood: m.wood, woodDark: m.woodDark,
      woodLight: m.woodLight, checker: m.woodChecker, grip: m.bakelite,
      poly: m.polymer, brass: m.brass, accent: m.machined, glow: m.rayGlow,
    };
  }
  return {
    body: m.papBody, dark: m.papEtch, bright: m.papChrome, matte: m.papDark,
    sheet: m.papDark, polish: m.papChrome, wood: m.papEtch, woodDark: m.papBody,
    woodLight: m.papDark, checker: m.papBody, grip: m.papBody,
    poly: m.papBody, brass: m.papChrome, accent: m.papGlow, glow: m.papCore,
  };
}

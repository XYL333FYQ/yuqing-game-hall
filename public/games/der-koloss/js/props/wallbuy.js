// Wall-buy chalk board.
//
// The weapon is chalked straight onto the brick, the way it is in the original.
// What changes is that it is now *chalk*: uneven pressure, doubled strokes,
// dust haloes, smudged palm marks and a scrawled price — and it is drawn on a
// lit surface instead of an unlit decal, so it takes the sodium light and goes
// dark when the power does. A small enamel price tag and a nail give it a piece
// of real hardware to hang off.
import * as THREE from 'three';
import { Kit } from './build.js';
import { mulberry32, ironMaterial, signTexture } from './materials.js';
import { weaponLineArt, simplify } from './weaponSilhouette.js';

// Fallback silhouette families, used ONLY when a weapon has no buildable model
// to trace. Every weapon that does have one is drawn from the model itself, so
// these generic shapes should never appear on the map as it stands.
const FAMILY = {
  rifle: { len: 0.86, mag: 'box', stock: true, scope: false, barrel: 0.30 },
  sniper: { len: 0.92, mag: 'box', stock: true, scope: true, barrel: 0.34 },
  smg: { len: 0.64, mag: 'stick', stock: true, scope: false, barrel: 0.16 },
  shotgun: { len: 0.80, mag: 'none', stock: true, scope: false, barrel: 0.40 },
  mg: { len: 0.92, mag: 'drum', stock: true, scope: false, barrel: 0.34 },
  pistol: { len: 0.40, mag: 'grip', stock: false, scope: false, barrel: 0.12 },
};

const WEAPON_FAMILY = {
  kar98: 'sniper', gewehr43: 'rifle', m1a1: 'rifle', stg44: 'rifle', fg42: 'mg',
  mp40: 'smg', thompson: 'smg', type100: 'smg',
  dbshotgun: 'shotgun', trench: 'shotgun',
  mg42: 'mg', ppsh: 'smg', colt: 'pistol',
};

/**
 * A wobbling, pressure-varying chalk stroke.
 *
 * Drawn as several overlapping passes rather than one clean path. Each pass
 * wobbles independently and lifts to nothing in places, so the line has the
 * doubled-back, skipping quality of a stick dragged over rough brick instead of
 * the even weight of a vector outline.
 */
function chalk(g, R, pts, width, alpha, wobble = 1) {
  if (pts.length < 2) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    // Each pass is offset bodily as well as jittered per-point: that constant
    // part is what reads as "gone over it twice and not quite hit the same line".
    const bx = (R() - 0.5) * 1.7 * wobble, by = (R() - 0.5) * 1.7 * wobble;
    let down = false;
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      // Chalk skips on brick. Break the line occasionally, but never on the
      // first pass, so the shape always stays legible underneath.
      if (pass > 0 && i > 0 && i < pts.length - 1 && R() < 0.045) { down = false; continue; }
      const jx = (R() - 0.5) * 1.5 * wobble, jy = (R() - 0.5) * 1.5 * wobble;
      const x = pts[i][0] + bx + jx, y = pts[i][1] + by + jy;
      if (!down) { g.moveTo(x, y); down = true; } else g.lineTo(x, y);
    }
    g.lineWidth = Math.max(0.6, width * (0.55 + R() * 0.7));
    g.strokeStyle = `rgba(240,238,229,${alpha * (0.26 + R() * 0.4)})`;
    g.stroke();
  }
}

export function chalkTexture(name, price, weaponId) {
  const W = 512, H = 320;
  const R = mulberry32(name.length * 977 + price);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);

  // Line-art traced from the REAL weapon model — silhouette, part boundaries
  // and creases, with hidden surfaces already removed. The old code drew one of
  // six generic FAMILY shapes, so every SMG on the map was chalked identically;
  // the version after that traced only a top-and-bottom envelope, which has no
  // receiver, trigger guard or magazine in it at all. Drawing the model's own
  // edges means the sketch is always the right gun, in detail, and can never
  // drift out of sync with it.
  const art = weaponLineArt(weaponId);
  if (art) {
    const { strokes, bounds, lengthM } = art;
    // ONE scale for both axes: an earlier version fitted width and height
    // independently, which squashed a 8.9:1 Kar98 and a 1.35:1 M1911 into the
    // same rectangle. Size is set by the weapon's real length against a
    // full-length rifle, softened by an exponent so the pistol reads as a
    // pistol without becoming a thumbnail. MAX_W leaves the right-hand quarter
    // of the board to the circled price and the enamel tag hanging below it.
    const MAX_W = W * 0.74, MAX_H = H * 0.48, REF_M = 1.40;
    const rel = Math.min(1, Math.pow(Math.min(lengthM, REF_M) / REF_M, 0.55));
    const s = Math.min((MAX_W * rel) / bounds.w, MAX_H / bounds.h);
    const cx = W * 0.41, cy = H * 0.38;
    const ox = cx - (bounds.w * s) / 2 - bounds.minX * s;
    const oy = cy - (bounds.h * s) / 2 - bounds.minY * s;

    // Interior detail first, outline last, so the bold silhouette sits on top
    // the way it does when you firm up a sketch you have already blocked in.
    const ordered = strokes.slice().sort((a, b) => a.weight - b.weight);
    for (const st of ordered) {
      // Simplify in mask space at a tolerance that is constant on the BOARD,
      // so a big drawing and a small one carry the same density of detail.
      const pts = simplify(st.pts, 0.7 / s).map(([x, y]) => [ox + x * s, oy + y * s]);
      if (pts.length < 2) continue;
      const bold = st.weight > 0.8;
      // Interior lines are thinner, fainter and shakier than the outline —
      // that hierarchy is most of what makes it read as drawn rather than cut.
      const width = bold ? 4.4 : 2.4 + st.weight * 1.6;
      const alpha = bold ? 1.0 : 0.42 + st.weight * 0.35;
      chalk(g, R, pts, width, alpha, bold ? 0.85 : 1.25);
    }
  } else {
    // Fallback: a weapon with no buildable model still gets a readable sketch.
    const fam = FAMILY[WEAPON_FAMILY[weaponId] || 'rifle'];
    const S = W * 0.70 * (fam.len / 0.86);
    const cx = W * 0.44, cy = H * 0.38;
    const x0 = cx - S / 2, x1 = cx + S / 2;
    chalk(g, R, [[x0, cy - 10], [x0 + S * fam.barrel, cy - 10]], 7, 0.85);
    chalk(g, R, [
      [x0 + S * fam.barrel, cy - 18], [x1 - S * 0.24, cy - 18],
      [x1 - S * 0.24, cy + 12], [x0 + S * fam.barrel, cy + 12], [x0 + S * fam.barrel, cy - 18],
    ], 7, 0.9);
    chalk(g, R, [[x1 - S * 0.30, cy + 12], [x1 - S * 0.34, cy + 52], [x1 - S * 0.24, cy + 52], [x1 - S * 0.21, cy + 12]], 6, 0.85);
    if (fam.stock) chalk(g, R, [[x1 - S * 0.24, cy - 14], [x1, cy - 6], [x1, cy + 22], [x1 - S * 0.22, cy + 12]], 6, 0.85);
  }


  // hand-scrawled name and price
  g.save();
  g.translate(W * 0.44, H * 0.80);
  g.rotate(-0.035);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let pass = 0; pass < 4; pass++) {
    g.font = `bold ${62 + R() * 3}px "Bradley Hand", "Segoe Script", Georgia, serif`;
    g.fillStyle = `rgba(238,236,226,${0.16 + R() * 0.12})`;
    g.fillText(name, (R() - 0.5) * 3, (R() - 0.5) * 3, W * 0.8);
  }
  g.restore();
  g.save();
  g.translate(W * 0.88, H * 0.18);
  g.rotate(0.08);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let pass = 0; pass < 4; pass++) {
    g.font = `bold ${46 + R() * 3}px "Bradley Hand", "Segoe Script", Georgia, serif`;
    g.fillStyle = `rgba(238,236,226,${0.18 + R() * 0.14})`;
    g.fillText(String(price), (R() - 0.5) * 3, (R() - 0.5) * 3);
  }
  // a circled price, drawn round it in one careless pass
  for (let pass = 0; pass < 2; pass++) {
    g.beginPath();
    g.ellipse(0, 0, 54 + R() * 5, 34 + R() * 4, R() * 0.3 - 0.15, 0, Math.PI * 2);
    g.lineWidth = 3.5; g.strokeStyle = `rgba(238,236,226,${0.28 + R() * 0.2})`;
    g.stroke();
  }
  g.restore();

  // chalk dust: soft haloes and smeared palm marks over everything
  const dust = g.globalCompositeOperation;
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 24; i++) {
    const dx = W * 0.12 + R() * W * 0.76, dy = H * 0.12 + R() * H * 0.7, r = 12 + R() * 46;
    const grad = g.createRadialGradient(dx, dy, 0, dx, dy, r);
    grad.addColorStop(0, `rgba(236,234,224,${0.012 + R() * 0.028})`);
    grad.addColorStop(1, 'rgba(236,234,224,0)');
    g.fillStyle = grad; g.fillRect(dx - r, dy - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = dust;
  // erase flecks so the chalk sits in the brick's texture rather than on it
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.6})`;
    g.fillRect(R() * W, R() * H, 1 + R() * 4, 1 + R() * 2);
  }
  g.globalCompositeOperation = 'source-over';

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * @returns {THREE.Group} board + hardware, oriented with its face on +Z
 */
export function buildWallBuy(weapon, price, label) {
  const g = new THREE.Group();
  const tex = chalkTexture(label, price, weapon);
  // A lit material, not an unlit sprite. A faint emissive keeps the buy legible
  // in an unpowered room without making it a glowing sticker.
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, roughness: 1.0, metalness: 0.0,
    emissiveMap: tex, emissive: 0xbfc4cc, emissiveIntensity: 0.10,
    depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.97), mat);
  board.position.z = 0.005;
  board.castShadow = false; board.receiveShadow = true;
  g.add(board);

  // Enamel price tag hung off a nail, bottom right of the drawing.
  const k = new Kit(1.6);
  const mats = { iron: ironMaterial({ color: 0x9ba0a8, roughness: 0.5, metalness: 0.9 }) };
  k.cyl('iron', 0.008, 0.008, 0.05, 6, 0.60, 0.30, 0.025, { rx: Math.PI / 2 });
  k.rivet('iron', 0.014, 0.60, 0.30, 0.05);
  k.box('iron', 0.006, 0.09, 0.006, 0.60, 0.255, 0.035);
  k.finish(g, mats, { receiveShadow: true, castShadow: false });

  const tagTex = signTexture(String(price), {
    w: 256, h: 128, seed: price, bg: '#d8cfae', fg: '#1a1610', fontSize: 68,
    font: '"Arial Narrow", Arial, sans-serif',
  });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshStandardMaterial({
    map: tagTex, roughness: 0.45, metalness: 0.0, side: THREE.DoubleSide,
  }));
  tag.position.set(0.60, 0.16, 0.035);
  tag.rotation.z = -0.06;
  tag.castShadow = false; tag.receiveShadow = true;
  g.add(tag);

  return g;
}

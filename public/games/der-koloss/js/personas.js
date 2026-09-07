// The four marines of the Waffenfabrik — original barks written in each
// character's spirit (brash American, boisterous Russian, stoic Japanese,
// manic German scientist). Voice design and performances: ElevenLabs.
export const PERSONAS = [
  {
    id: 'dempsey', label: 'TANK DEMPSEY', lang: 'en', role: 'U.S. MARINE RAIDER',
    bio: 'A grizzled Marine Raider who carved his name through Peleliu and Okinawa. Loud, fearless, and allergic to retreat — the only thing he loves more than his country is watching the enemy fall apart under his trigger finger.',
    traits: ['Fearless to a fault', 'Gallows humor', 'Never leaves a man behind'],
    quotes: ['Ooh-rah!', "I'll take 'em all on myself if I have to.", 'Killin’ is my business — and business is good.'],
    portrait: { bg: '#2a2416', skin: '#c8a07a', hair: '#3a2a18', accent: '#4a5537', extra: 'jaw' },
  },
  {
    id: 'nikolai', label: 'NIKOLAI BELINSKI', lang: 'en', role: 'RED ARMY SERGEANT',
    bio: 'A boisterous sergeant of the Red Army who survived the worst of the Eastern Front with a grin and a bottle. He fights like a bear, laughs like thunder, and trusts exactly two things: his comrades and his vodka.',
    traits: ['Boisterous brawler', 'Endless stamina', 'Sentimental under the muscle'],
    quotes: ['For Mother Russia!', 'I have fought bears with less fear than this.', 'Vodka first. Then war.'],
    portrait: { bg: '#241a16', skin: '#d0a884', hair: '#241812', accent: '#6b2a20', extra: 'beard' },
  },
  {
    id: 'takeo', label: 'TAKEO MASAKI', lang: 'en', role: 'IMPERIAL ARMY CAPTAIN',
    bio: 'A disciplined captain of the Imperial Japanese Army, bound by duty and unshakable honor. He speaks little, wastes nothing, and meets death — his own or the enemy’s — with perfect composure.',
    traits: ['Unbreakable discipline', 'Precise and calm', 'Honor above life'],
    quotes: ['With honor, we fight.', 'Discipline will see us through.', 'A warrior’s duty never ends.'],
    portrait: { bg: '#161c24', skin: '#d8b890', hair: '#101010', accent: '#3a4a5a', extra: 'cap' },
  },
  {
    id: 'richtofen', label: 'EDWARD RICHTOFEN', lang: 'en', role: 'GROUP 935 SCIENTIST',
    bio: 'The brilliant, unhinged mind behind Group 935’s teleportation program. Richtofen giggles at carnage, worships his own genius, and treats the apocalypse like a field test. Something in his head ticked loose long ago — and it loves the view.',
    traits: ['Unstable genius', 'Delights in destruction', 'Knows more than he says'],
    quotes: ['The fun begins!', 'GENIUS! Wunderbar!', 'Oh, the carnage we will make!'],
    portrait: { bg: '#1a1a22', skin: '#d8c0a8', hair: '#2a2018', accent: '#3a3a4a', extra: 'glasses' },
  },
];

// ---------------------------------------------------------------------------
// Arcade-cabinet pixel portraits: hand-laid 32x32 pixel maps per character.
// Legend (mapped per-character via PAL):
//  . bg   , bg-dither   F skin   f skin-shade   L skin-light   K neck-shadow
//  H hair h hair-light  B brow   E eye-white   e eye-dark      N nose-shade
//  M mouth m mouth-dark S stubble/beard s beard-light
//  T cloth t cloth-shade C collar D detail (tags/stripes) W stripe-light
//  A hat   a hat-shade  i hat-insignia
// ---------------------------------------------------------------------------
const PORTRAITS = {
  // TANK DEMPSEY — square jaw, high-&-tight, dog tags, olive tee
  dempsey: {
    pal: {
      '.': '#141310', ',': '#1b1913', 'F': '#d9a878', 'f': '#b3815a', 'L': '#eec194', 'K': '#8a5f3d',
      'H': '#3a2a18', 'h': '#5a4126', 'B': '#33240f', 'E': '#e8e2d2', 'e': '#241a12', 'N': '#a06b44',
      'M': '#7a4632', 'm': '#5a3024', 'S': '#8f6a4a', 's': '#a87e58',
      'T': '#4c5138', 't': '#363a28', 'C': '#2c2f20', 'D': '#b8b8a8', 'W': '#e8e2d2',
    },
    rows: [
      '................................',
      '................................',
      '...........HHHHHHHHHHH..........',
      '..........HHhhhhhhhhHH..........',
      '..........HhhhhhhhhhhH..........',
      '..........HhhhhhhhhhhH..........',
      '..........HHhhhhhhhhHH..........',
      '..........HHHhhhhhhHH...........',
      '..........HHFFFFFFFFH...........',
      '..........HFFFFFFFFFFH..........',
      '..........SFFLFFFFFLFF..........',
      '..........SFFFFFFFFFFS..........',
      '..........BBBBBfBfBBBBB.........',
      '..........fFEeeFFFeeEFf.........',
      '..........fFFeeFFFeeFFf.........',
      '..........fFFFFNNFFFFf..........',
      '..........SFFFFNNFFFFS..........',
      '..........SSFFFFFFFFSS..........',
      '..........SFMMMMMMMFFS..........',
      '..........SSmmmmmmmFSS..........',
      '..........SSFFFFFFFFSS..........',
      '..........SSFSSSSSSFSS..........',
      '...........SKKKKKKKKS...........',
      '...........SDKKKKKKDS...........',
      '..........SDDDKKKKDDDS..........',
      '.........TTTDDDDDDDDTTT.........',
      '........TTTTTCCCCCCCTTTTT.......',
      '.......TTTTTTTTTTTTTTTTTTT......',
      '......TTTTTTTTTTtTTTTTTTTTT.....',
      '......TTTTTTTTTTtTTTTTTTTTT.....',
      '.....TTTTTTTTTTTtTTTTTTTTTTT....',
      '.....TTTTTTTTTTtTTTTTTTTTTT.....',
    ],
  },
  // NIKOLAI BELINSKI — heavy beard, balding, striped telnyashka under coat
  nikolai: {
    pal: {
      '.': '#131011', ',': '#1a1516', 'F': '#d0a884', 'f': '#a87e5c', 'L': '#e4c09a', 'K': '#7c5638',
      'H': '#241812', 'h': '#3c2a1c', 'B': '#1c120c', 'E': '#e8e2d2', 'e': '#1c1410', 'N': '#96683f',
      'M': '#6e3c2c', 'm': '#502a1e', 'S': '#2e2018', 's': '#4a3626',
      'T': '#3a3f46', 't': '#282c32', 'C': '#1e2126', 'D': '#8a94a8', 'W': '#d8dce4',
    },
    rows: [
      '................................',
      '................................',
      '................................',
      '..........FFFFFFFFFFFF..........',
      '.........HFFLFFFFFFFFFH.........',
      '.........HFFFFFFFFFFFFH.........',
      '.........HFFFFFFFFFFFFH.........',
      '.........HFFLFFFFFFLFFH.........',
      '.........HFFFFFFFFFFFFH.........',
      '.........SSFFFFFFFFFFSS.........',
      '.........BBBBBFFFFBBBBB.........',
      '.........BEeEBFFFFBEeEB.........',
      '.........SSBEBFFFFBEBSS.........',
      '.........SSFFFNNNFFFSS..........',
      '.........SSSFFNNNFFSSS..........',
      '.........SSSSFFFFFSSSS..........',
      '.........SSSsMMMMMsSSS..........',
      '.........SSSSSSSSSSSSS..........',
      '.........sSSSSSSSSSSSs..........',
      '.........sSSSSSSSSSSSs..........',
      '........sSSSSSSSSSSSSSs.........',
      '........sSSSSSSSSSSSSSS.........',
      '........sSSSKKKKKKSSSS..........',
      '........TTTCKKKKKKCTTT..........',
      '.......TTTTCCCKKKCCCTTTT........',
      '......TTWWTTTCCCCCTTTWWTTT......',
      '......TTTTTTTTTTTTTTTTTTTT......',
      '.....TTWWTTTTTTTtTTTTTTTWWTT....',
      '.....TTTTTTTTTTTtTTTTTTTTTTT....',
      '.....TWWTTTTTTTTtTTTTTTTTWWT....',
      '.....TTTTTTTTTTTtTTTTTTTTTTT....',
      '....TTWWTTTTTTTTtTTTTTTTTTWWTT..',
    ],
  },
  // TAKEO MASAKI — officer cap, thin mustache, khaki high collar
  takeo: {
    pal: {
      '.': '#10131a', ',': '#161a22', 'F': '#d8b890', 'f': '#b08a64', 'L': '#eaccaa', 'K': '#8a684a',
      'H': '#101010', 'h': '#242424', 'B': '#0c0c0c', 'E': '#e8e2d2', 'e': '#14100c', 'N': '#9c744e',
      'M': '#7a4632', 'm': '#5a3024', 'S': '#181818', 's': '#2a2a2a',
      'T': '#6a6248', 't': '#4c4634', 'C': '#3a3526', 'D': '#8a2a20', 'W': '#e8e2d2',
      'A': '#5a5240', 'a': '#403a2c', 'i': '#c8b06a',
    },
    rows: [
      '................................',
      '..........AAAAAAAAAAAAA.........',
      '.........AAaaaaaaaaaaaAA........',
      '.........AaaaaaaaaaaaaaA........',
      '.........AAaaaaaaaaaaAA.........',
      '.........AAAAAAAiAAAAAAA........',
      '........AAAAAAAAAAAAAAAAA.......',
      '........AAAAAAAAAAAAAAAAA.......',
      '.........aFFFFFFFFFFFa..........',
      '.........HFFLFFFFFLFFH..........',
      '.........HFFFFFFFFFFFH..........',
      '.........HFFFFFFFFFFFH..........',
      '.........BBBfBBBBBfBBB..........',
      '.........fEEeFFFFFeEEf..........',
      '.........fFFFFFFFFFFFf..........',
      '.........fFFFFNNNFFFFf..........',
      '.........fFFFFNNNFFFFf..........',
      '.........fFFSSSSSSSFFf..........',
      '.........fffFFMMMFFfff..........',
      '.........ffFFFFFFFFFff..........',
      '.........ffFFFFFFFFFff..........',
      '..........KKKKKKKKKKK...........',
      '..........CKKKKKKKKKC...........',
      '.........CCCKKKKKKKCCC..........',
      '........TTCCCCCCCCCCCTT.........',
      '.......TTTDTTCCCCCTTDTTT........',
      '......TTTTDTTTTTTTTTDTTTT.......',
      '......TTTTTTTTTTTTTTTTTTT.......',
      '.....TTTTTTTTTTTtTTTTTTTTTTT....',
      '.....TTTTTTTTTTTtTTTTTTTTTTT....',
      '....TTTTTTTTTTTTtTTTTTTTTTTTT...',
      '....TTTTTTTTTTTTtTTTTTTTTTTTT...',
    ],
  },
  // EDWARD RICHTOFEN — officer field cap, arched brow, manic grin, dark uniform
  richtofen: {
    pal: {
      '.': '#121118', ',': '#181722', 'F': '#d8c0a8', 'f': '#b2957a', 'L': '#ecd4bc', 'K': '#8a6e52',
      'H': '#2a2018', 'h': '#453424', 'B': '#241a10', 'E': '#e8e2d2', 'e': '#18120c', 'N': '#9c7a56',
      'M': '#7a3a2e', 'm': '#4a2018', 'S': '#2a2018', 's': '#3c2e20',
      'T': '#3f4438', 't': '#2b2f26', 'C': '#20241c', 'D': '#b8b0a0', 'W': '#e8e2d2',
      'A': '#3a4034', 'a': '#262a22', 'i': '#b8b0a0',
    },
    rows: [
      '................................',
      '...........AAAAAAAAAAA..........',
      '..........AAaaaaaaaaaAA.........',
      '..........AaaaaaaaaaaaA.........',
      '..........AaaaaaaaaaaaA.........',
      '..........AAAAAAiAAAAAA.........',
      '.........AAAAAAAAAAAAAAA........',
      '..........aFFFFFFFFFFFa.........',
      '..........HFFLFFFFFLFFH.........',
      '..........HFFFFFFFFFFFH.........',
      '..........hFFFFFFFFFFFh.........',
      '..........hFFLFFFFFLFFh.........',
      '..........BBBfBBBBBfBBB.........',
      '..........fEeeFFFEeeEFf.........',
      '..........fFFFFFFFFFFFf.........',
      '..........fFFFFNNNFFFFf.........',
      '..........fFFFFFNNFFFfM.........',
      '..........fFFFFFFFFFMMf.........',
      '..........fMMMMMMMMMMf..........',
      '..........fmmmmmmmmmf...........',
      '..........ffFFFFFFFFFff.........',
      '..........SfFFFFFFFFFfS.........',
      '...........KKKKKKKKKKK..........',
      '...........CKKKKKKKKKC..........',
      '..........CDDDKKKKKDDDC.........',
      '.........TTCDDDDDDDDDCTT........',
      '........TTTTCCDDDDDCCCTTTT......',
      '.......TTTTTTTCCCCCTTTTTTTT.....',
      '......TTTTTTTTTTtTTTTTTTTTTT....',
      '......TTTTTTTTTTtTTTTTTTTTTT....',
      '.....TTTTTTTTTTTtTTTTTTTTTTTT...',
      '.....TTTTTTTTTTTtTTTTTTTTTTTT...',
    ],
  },
};

// ---------------------------------------------------------------------------
// Portrait rendering.
//
// Each marine ships a 512px WebP bust (assets/portraits/<id>.webp), graded to
// the front-end palette: cold moonlight key, warm sodium rim, black field.
// The 32x32 pixel maps above stay as the fallback and are what gets drawn
// synchronously on the very first paint, so a card is never empty and a
// missing or undecodable image degrades to the old look instead of a hole.
//
// drawPortrait() keeps its signature — (canvas, personaId) — because main.js
// and the co-op UI call it that way. What changed is that it now sizes the
// canvas backing store to the element's real CSS box times the device pixel
// ratio, so the bust lands on device pixels 1:1 and the stylesheet's
// `image-rendering: pixelated` (correct for the pixel maps, wrong for photos)
// is neutralised per-canvas by an inline override.
// ---------------------------------------------------------------------------

const PORTRAIT_ART_DIR = 'assets/portraits/';
const MAX_BACKING = 640;          // char page tops out near 204css * 2dpr

const _art = new Map();           // persona id -> { img, ok, failed }
const _canvases = new Set();      // canvases drawPortrait is currently driving
let _portraitSrc = null;
let _remeasureQueued = false;

function artFor(id) {
  let entry = _art.get(id);
  if (entry) return entry;
  entry = { img: null, ok: false, failed: false };
  _art.set(id, entry);
  if (typeof Image !== 'function') { entry.failed = true; return entry; }
  const img = new Image();
  entry.img = img;
  img.decoding = 'async';
  img.addEventListener('load', () => {
    entry.ok = img.naturalWidth > 0;
    entry.failed = !entry.ok;
    if (entry.ok) repaint(id);
  });
  img.addEventListener('error', () => { entry.failed = true; });
  img.src = `${PORTRAIT_ART_DIR}${id}.webp`;
  return entry;
}

function repaint(id) {
  for (const cv of [..._canvases]) {
    if (!cv.isConnected) { _canvases.delete(cv); continue; }
    if (cv.dataset.persona === id) drawPortrait(cv, id);
  }
}

// The CSS box is the truth. main.js draws a card before appending it, so the
// first measurement can be zero — fall back to whatever width the caller set
// and re-measure on the next frame.
function backingFor(canvas) {
  const dpr = Math.min(Math.max((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1), 3);
  let css = 0;
  if (typeof canvas.getBoundingClientRect === 'function') {
    const r = canvas.getBoundingClientRect();
    css = Math.round(Math.max(r.width, r.height));
  }
  const logical = css > 0 ? css : Math.max(canvas.width || 0, canvas.height || 0, 96);
  return Math.max(64, Math.min(MAX_BACKING, Math.round(logical * dpr)));
}

function scheduleRemeasure() {
  if (_remeasureQueued || typeof requestAnimationFrame !== 'function') return;
  _remeasureQueued = true;
  requestAnimationFrame(() => {
    _remeasureQueued = false;
    for (const cv of [..._canvases]) {
      if (!cv.isConnected) { _canvases.delete(cv); continue; }
      if (backingFor(cv) !== cv.width) drawPortrait(cv, cv.dataset.persona);
    }
  });
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // the 760px breakpoint retunes .char-card canvas from 78px to 56px
  window.addEventListener('resize', scheduleRemeasure, { passive: true });
}

// Pixel-map fallback: the original arcade-cabinet look, drawn into a 32x32
// scratch canvas and blitted with nearest-neighbour.
function drawPixelFallback(out, size, def) {
  if (!_portraitSrc) {
    _portraitSrc = document.createElement('canvas');
    _portraitSrc.width = _portraitSrc.height = 32;
  }
  const g = _portraitSrc.getContext('2d');
  // backdrop: two-tone posterized field with sparse dither
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    g.fillStyle = (x + y) % 5 === 0 ? def.pal[','] : def.pal['.'];
    g.fillRect(x, y, 1, 1);
  }
  // the pixel map
  def.rows.forEach((row, y) => {
    for (let x = 0; x < 32; x++) {
      const ch = row[x] || '.';
      if (ch === '.' || ch === ',') continue;
      g.fillStyle = def.pal[ch] || '#f0f';
      g.fillRect(x, y, 1, 1);
    }
  });
  // rim light from the left (arcade marquee glow)
  g.fillStyle = 'rgba(255,220,160,0.10)';
  for (let y = 0; y < 32; y++) g.fillRect(0, y, 2, 1);
  // scanlines
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 1; y < 32; y += 2) g.fillRect(0, y, 32, 1);
  // vignette
  const vg = g.createRadialGradient(16, 15, 10, 16, 16, 23);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg;
  g.fillRect(0, 0, 32, 32);
  out.imageSmoothingEnabled = false;
  out.drawImage(_portraitSrc, 0, 0, size, size);
}

// Ties the bust to the surrounding chrome: the shoulders dissolve into the
// card, and a cold key wash on the upper left matches the menu's moonlight.
function frameArt(out, size) {
  out.save();
  out.globalCompositeOperation = 'destination-out';
  const fade = out.createLinearGradient(0, size * 0.74, 0, size);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,0.85)');
  out.fillStyle = fade;
  out.fillRect(0, size * 0.74, size, size * 0.26);
  out.restore();

  out.save();
  out.globalCompositeOperation = 'screen';
  const key = out.createRadialGradient(size * 0.3, size * 0.22, 0, size * 0.3, size * 0.22, size * 0.8);
  key.addColorStop(0, 'rgba(74, 108, 150, 0.16)');
  key.addColorStop(1, 'rgba(0, 0, 0, 0)');
  out.fillStyle = key;
  out.fillRect(0, 0, size, size);
  out.restore();
}

export function drawPortrait(canvas, personaId) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const id = PORTRAITS[personaId] ? personaId : 'dempsey';
  canvas.dataset.persona = id;
  _canvases.add(canvas);

  const size = backingFor(canvas);
  if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }

  const out = canvas.getContext('2d');
  if (!out) return;
  out.clearRect(0, 0, size, size);

  const art = artFor(id);
  if (art.ok && art.img) {
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = 'high';
    out.drawImage(art.img, 0, 0, size, size);
    frameArt(out, size);
    canvas.style.imageRendering = 'auto';
  } else {
    canvas.style.imageRendering = 'pixelated';
    drawPixelFallback(out, size, PORTRAITS[id]);
  }

  scheduleRemeasure();
}

// event -> [variant texts] (file: vox_<persona>_<event><i+1>.mp3)
export const LINES = {
  dempsey: {
    start: ["Alright, maggots! Time to crack some skulls!"],
    round: ['Here they come again! Bring it, freak-bags!', 'More of them? Good. I was getting bored.'],
    reload: ['Reloading! Cover me!', 'Swapping mags — watch my six!'],
    kill: ['Back to hell, maggot!', 'Eat lead, zombie scum!', 'Ooh-rah! Another one drops!'],
    down: ["I'm down! Somebody get me up!"],
    revive: ["On your feet, soldier. We ain't done fighting."],
    power: ["Power's on! Now we're cooking!"],
    tele: ['Teleporter linked! That thing actually works?'],
    pap: ['Now THIS is a real weapon!'],
    take: ['Ooh-rah! Now we\'re talking!', 'Ha! This is gonna be SWEET!', 'Time to paint the walls red!'],
    take_wonder: ['HAHA! Alien tech, baby! My favorite!'],
    dog: ['Hellhounds! I hate those mutts!'],
  },
  nikolai: {
    start: ['For Mother Russia! And for vodka!'],
    round: ['They come again! Like my ex-wives, they never stop!', 'More zombies! Good — I needed target practice.'],
    reload: ['Reloading! Do not let them touch me!', 'One moment — I reload!'],
    kill: ['Die, you filthy creature!', 'Back to the grave with you!', 'HA! Take that, undead pig!'],
    down: ['I am down! Help me, comrades!'],
    revive: ['Get up, comrade. The vodka is not finished.'],
    power: ['Power! Now we see what we are killing!'],
    tele: ['Teleporter works! I love science!'],
    pap: ['A beautiful weapon for a beautiful man.'],
    take: ['HA! Now THIS is a man\'s weapon!', 'Beautiful! Like first sip of vodka!', 'Zombies will cry for their mothers!'],
    take_wonder: ['Space gun! Nikolai loves the future!'],
    dog: ['Dogs! I HATE dogs!'],
  },
  takeo: {
    start: ['With honor, we fight.'],
    round: ['They approach. Stand firm.', 'Another wave. Discipline will see us through.'],
    reload: ['Reloading. Hold the line.'],
    kill: ['Your suffering ends now.', 'Return to the earth.', 'A clean death for you.'],
    down: ['I am down! Do not let it be in vain!'],
    revive: ['Rise, warrior. Your duty is not done.'],
    power: ['The generator hums. Fortune favors us.'],
    tele: ['The device is linked. Remarkable.'],
    pap: ['A weapon worthy of a warrior.'],
    take: ['A fine instrument of war.', 'This blade has been blessed.', 'Perfection, forged in fire.'],
    take_wonder: ['Such power... I will use it with honor.'],
    dog: ['Beasts of flame. Stay focused.'],
  },
  richtofen: {
    start: ['Ah, the fun begins! Let the experiment commence!'],
    round: ['More test subjects! Wunderbar!', 'They keep coming! Science thanks them!'],
    reload: ['One moment... I must reload!'],
    kill: ['Fascinating! The motor functions cease!', 'DIE! Oh, how I love that part.', 'Back to the grave, specimen!'],
    down: ['No! Not me! HELP ME, fools!'],
    revive: ['Get up! The doctor needs you alive!'],
    power: ['The power! It WORKS! Of course it works!'],
    tele: ['The teleporter is linked! GENIUS!'],
    pap: ['Perfection! A masterpiece of destruction!'],
    take: ['AHAHA! This is gonna be sweet!', 'Oh, the carnage we will make together!', 'My beautiful creation, COMPLETE!'],
    take_wonder: ['MY PRECIOUS! You came back to me!'],
    dog: ['The hounds! My old... creations. Kill them quickly!'],
  },
};

export function lineFor(personaIdx, event, variant) {
  const p = PERSONAS[personaIdx % PERSONAS.length];
  const arr = LINES[p.id][event];
  if (!arr) return null;
  const i = variant % arr.length;
  return { persona: p, text: arr[i], file: `vox_${p.id}_${event}${i + 1}`, variant: i };
}
export function variantCount(personaIdx, event) {
  const p = PERSONAS[personaIdx % PERSONAS.length];
  return (LINES[p.id][event] || []).length;
}

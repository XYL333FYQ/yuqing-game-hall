/* ================= ZONES ================= */
let zone = 'town', depth = 0;
const LOAD_TIPS = [
  'Chilled foes shatter — cold builds strike harder against frozen enemies.',
  'Socket gems at the Jeweler to shape your build.',
  'Shrines grant fleeting power. Seek them before the fight finds you.',
  'Set bonuses reward the patient collector — three pieces, then six.',
  'The deeper you descend, the richer the spoils… and the graver the danger.',
  'Legendary-touched rares can rival uniques. Don\'t vendor them unread.',
  'Techniques spend a third axis of power — train them between runs.',
  'Some say a bovine stirs near Aldermere…',
];
let floorObj = null, shrines = [], shrineGroup = null; // per-floor bounty + dungeon shrines (ephemeral, rebuilt each enterDungeon)
let wildObj = null; // per-visit wilderness hunt (rolled by enterWild)
function isCombat() { return zone === 'wild' || zone === 'dungeon'; }
let _fieldEpoch = 0; /* bumped on every field teardown; deferred combat ticks (blizzard/lingering fields) capture it and bail if it changed, so a cast can't keep detonating after a floor/zone change */
function clearField() { _fieldEpoch++; for (const d of _dying) removeMesh(d.g); _dying.length = 0; for (const m of monsters) removeMob(m.mesh); for (const p of projectiles) removeMesh(p.mesh); for (const l of loots) removeMesh(l.mesh); for (const e of fx) removeMesh(e.mesh); monsters = []; projectiles = []; loots = []; fx = []; clearFieldFx(); _spawnQueue.length = 0; _spawnCd = 0; target = null; moveTarget = null; boss = null; bossActive = false; _resetHudCache(); }
function setZoneVisuals() {
  wildGroup.visible = zone === 'wild'; townGroup.visible = zone === 'town'; dungeonGroup.visible = zone === 'dungeon'; dungeonExtraGroup.visible = zone === 'dungeon'; if (typeof markGlows === 'function') markGlows();
  playerGlow.intensity = PLAYER_GLOW[zone] || 0; /* Diablo-style player aura — on in dungeons, off in lit town/open wild */
  /* Phase 1a relight: these per-zone overrides re-set hemi/moon/torch intensity every zone transition, so they get the same x Math.PI scale as the construction sites (otherwise zones darken to ~1/pi while the menu looks fine). */
  if (zone === 'town') { setGroundFlat(true); ensureColorBg(); scene.background.setHex(0x0a0805); scene.fog.color.setHex(0x0a0805); scene.fog.near = 70; scene.fog.far = 180; hemi.intensity = 0.6 * Math.PI; moon.intensity = 0.7 * Math.PI; if (groundMat.vertexColors) { groundMat.vertexColors = false; groundMat.needsUpdate = true; } groundMat.color.setHex(0x3a2f22); setAmbient('ember', 0xffb060); torch.intensity = 1.4 * Math.PI; torch.distance = 64; setBiomeGrade({ t: [1.06, 1.00, 0.90], v: 0.28 }); restoreProcEnv(); loadTownGround(); }
  else if (zone === 'wild') { setGroundFlat(false); const rg = curRegion || REGIONS[0]; if (scene.background.isColor) scene.background.setHex(rg.fog); scene.fog.color.setHex(rg.fog); scene.fog.near = 58; scene.fog.far = 168; hemi.intensity = 0.42 * Math.PI; moon.intensity = 0.55 * Math.PI; if (groundMat.vertexColors) { groundMat.vertexColors = false; groundMat.needsUpdate = true; } groundMat.color.setHex(groundTexOn() ? (rg.groundTint || 0xffffff) : rg.groundCol); setAmbient('ember', rg.amb); torch.intensity = 1.5 * Math.PI; torch.distance = 66; setBiomeGrade({ t: [0.96, 1.05, 0.95], v: 0.30 }); loadRegionEnv(rg); loadRegionGround(rg); }
  else { setGroundFlat(false); const th = curTheme || dungeonTheme(depth); const dk = (th.daylight ? 0.9 : clamp(0.52 - depth * 0.018, 0.34, 0.52)) * Math.PI; ensureColorBg(); scene.background.setHex(th.fog); scene.fog.color.setHex(th.fog); scene.fog.near = th.daylight ? 60 : 42; scene.fog.far = th.daylight ? 220 : clamp(150 - depth * 5, 100, 150); hemi.intensity = dk; moon.intensity = 0.34 * Math.PI; if (groundMat.vertexColors) { groundMat.vertexColors = false; groundMat.needsUpdate = true; } groundMat.color.setHex(th.ground); setAmbient(th.amb, th.ambCol); torch.intensity = clamp(2.2 + depth * 0.09, 2.2, 4.4) * Math.PI; torch.distance = clamp(76 + depth * 1.6, 76, 114); setBiomeGrade(th.grade); restoreProcEnv(); loadDungeonGround(th); loadDungeonWall(th); }
  if (typeof applyFrustumCull === 'function') applyFrustumCull(); /* Phase 3 opt-in: (re)assert frustum culling on the now-visible zone's static scenery */
}
const AREAS = [
  { id: 'town', name: 'Aldermere', kind: 'town', tier: 0, townTheme: { ground: 0x3a2f22, fog: 0x0a0805 } },
  { id: 'highreach', name: 'Highreach', kind: 'town', tier: 1, townTheme: { ground: 0x55606e, fog: 0x090c13 } },
  { id: 'emberhold', name: 'Emberhold', kind: 'town', tier: 2, townTheme: { ground: 0x4a2622, fog: 0x100704 } },
  { id: 'wilds', name: 'The Wilds', kind: 'wild', lvl: 1 },
  { id: 'descent', name: 'The Descent', kind: 'dungeon' },
];
let curArea = AREAS.find(a => a.id === 'wilds'), curTownArea = AREAS[0];
let curRegion = REGIONS[0];
buildTown(curTownArea); // build the default town once so the title screen has scenery before any enterTown()
function themeTown(a) { if (a && a.townTheme) { groundMat.color.setHex(groundTexOn() ? 0xffffff : a.townTheme.ground); scene.background.setHex(a.townTheme.fog); scene.fog.color.setHex(a.townTheme.fog); } }
function themeWild() { const r = curRegion || REGIONS[0]; if (scene.background.isColor) scene.background.setHex(r.fog); scene.fog.color.setHex(r.fog); setAmbient('ember', r.amb); for (const f of wildFires) { f.light.color.setHex(r.fire); f.flame.material.color.setHex(r.fire); } loadRegionEnv(r); loadRegionGround(r); }
function setScale() {
  const dm = DIFF[difficulty] || DIFF.Normal; if (zone === 'dungeon') {
    const D = DSCALE; const sd = depth === COW_DEPTH ? cowScaleDepth() : depth; /* cow level scales to proven depth, not the 999 sentinel */
    curScale = { hp: (1 + sd * D.hpLin + Math.pow(sd * D.hpQuad, 2)) * dm.hp, dmg: (1 + sd * D.dmgLin + Math.pow(sd * D.dmgQuad, 2)) * dm.dmg, xp: (1 + sd * D.xpLin + Math.pow(sd * D.xpQuad, 2)) * dm.xp, ilvl: player.level + sd * D.ilvlPerDepth };
    zoneLuck = Math.min(0.5, sd * 0.02);
  }
  else if (zone === 'wild') { const lv = (curRegion && curRegion.lvl) || 1; curScale = { hp: (1 + lv * 0.12) * dm.hp, dmg: (1 + lv * 0.09) * dm.dmg, xp: (1 + lv * 0.15) * dm.xp, ilvl: Math.max(player.level, lv) + 2 }; zoneLuck = 0; }
  else { curScale = { hp: dm.hp, dmg: dm.dmg, xp: dm.xp, ilvl: player.level }; zoneLuck = 0; }
}
/* Phase 1b perf: pre-warm the freshly-built scene's GPU pipelines behind the loading gate so the first live
   frame doesn't compile-stutter (browser-verified: zone entry froze ~2s as the main thread idle-waited on GPU
   pipeline compilation - a pure GPU-wait, ~0 main-thread longtask). Pauses the sim+render loop while warming
   (also stops the "mobbed while the frame froze" deaths). Sequence: (1) compileAsync() warms modules/pipelines
   off the main thread while the overlay stays live; (2) ONE synchronous renderFrame() through the ACTIVE (post)
   path finalizes the exact offscreen/MRT variant the loop will draw - post.renderAsync() resolves BEFORE
   compilation finishes (browser-verified: gate flashed ~8ms then the freeze leaked into gameplay), so the
   synchronous render is required. This covers the static scene (scenery, ground, town). It does NOT cover
   transient combat content first-rendered after reveal - monsters, projectiles, FX, skills - whose pipeline
   variants are context/pass-specific; that residual (~1.5-1.9s on first combat) is a separate, unsolved piece
   (see PERF-FINDINGS). Token + 8s watchdog guard against a stuck overlay (black-screen guard). */
/* Pre-compile the FULL transient combat pipeline set in THIS zone's exact lighting context, behind the loading
   gate. Combat content (wave monsters, skill FX, projectiles, loot) first-renders AFTER reveal, so without this
   the first render of each compiles its pipeline on the main thread mid-fight — the "freeze when walking around"
   (browser-measured ~3.2s cold on first combat, plus per-biome residuals). The pipeline variant is context-
   specific (point-light count is baked per biome — verified: a warm done in town left wild's first combat at
   ~670ms), so the warm MUST run in each zone's own context, not once globally. Builds one temp mesh per distinct
   (geometry, material) combo, renders it once via warmScene's compileAsync+renderFrame, then removes it.
   _warmedCtx gates it to once per biome/zone-context per session so re-entries don't repay the load cost. */
const _warmedCtx = new Set();
function _combatCtxKey() { return zone + ':' + (zone === 'dungeon' ? ((curTheme && curTheme.name) || '?') : zone === 'wild' ? ((curRegion && curRegion.name) || '?') : 'town'); }
function warmCombatPipelines() {
  if (!isCombat()) return [];
  const tmp = [], px = player.x, pz = player.z;
  const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, y == null ? 1.5 : y, pz); m.frustumCulled = false; m.userData.noDispose = true; scene.add(m); tmp.push(m); return m; };
  const warmTypes = new Set(biomePool());
  /* bosses summon types outside the floor's biome pool (e.g. Zul'Mak → imp/hellhound) — an un-warmed summon
     first-renders AFTER reveal, compiling its pipeline mid-fight. Fold the active boss's summon/addphase types
     into the warm set. _warmedCtx still gates to once per context, but WebGPU caches each pipeline globally after
     its first compile, so this covers the first boss met in a fresh context (the common case). */
  if (bossActive && boss && boss.abilities) for (const ab of boss.abilities) if ((ab.kind === 'summon' || ab.kind === 'addphase') && ab.types) for (const t of ab.types) warmTypes.add(t);
  for (const t of warmTypes) { const b = MTYPES[t]; if (!b) continue; const mesh = buildMonsterMesh(t, b.col, b.scale); if (mesh) { mesh.position.set(px, 0, pz); mesh.frustumCulled = false; scene.add(mesh); tmp.push(mesh); } } /* skinned MeshStandard, one per spawnable type */
  add(_orbGeo, projMat(0xff8a3a), 2);                                  /* projectile orb (opaque MeshBasic) */
  add(_LGEO.spark, _basicMat(0xffffff, 0.95));                          /* additive-transparent VFX, one per distinct geo layout */
  add(_LGEO.flash, _basicMat(0xffffff, 0.7));
  add(_LGEO.ring, _basicMat(0xffffff, 0.55));
  add(_beamGeo(3.5, 0.4), _basicMat(0xffffff, 0.3), 1.5);
  add(_LGEO.expl, new THREE.MeshBasicMaterial({ color: 0xff5020, transparent: true, opacity: 0.5, wireframe: true })); /* explosion = wireframe variant (distinct pipeline) */
  { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, 2, pz), new THREE.Vector3(px + 2, 2.4, pz)]); const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 1 })); ln.frustumCulled = false; ln.userData.noDispose = true; scene.add(ln); tmp.push(ln); } /* chain-lightning Line */
  add(_LGEO.gold, _lootMat('gold', 0xffd24d), 1);                       /* loot: MeshStandard (gold/item) + MeshPhong (potion) */
  add(_LGEO.pot, _lootMat('potion', 0xff5a4a), 1);
  add(_LGEO.item, _lootMat('item', 0xc080ff), 1);
  return tmp;
}
let _warming = false, _warmToken = 0;
function _hideCurtain(el) { if (!el) return; el.classList.add('reveal'); const t = _warmToken; setTimeout(() => { if (t === _warmToken) { el.style.display = 'none'; el.classList.remove('reveal'); } }, 320); } /* ~0.3s opacity fade-out; token-guarded so a newer warm cancels a stale fade */
function warmScene(label, buildFn) {
  const el = document.getElementById('loading');
  const tok = ++_warmToken;
  _warming = true;
  if (el) {
    const p = (label || 'Summoning the world…').split(' · ');
    const T = document.getElementById('loadtitle'); if (T) T.textContent = p[0];
    const S = document.getElementById('loadsub');   if (S) S.textContent = p[1] || '';
    const P = document.getElementById('loadtip');
    if (P) { P.textContent = LOAD_TIPS[(Math.random() * LOAD_TIPS.length) | 0]; P.style.animation = 'none'; void P.offsetWidth; P.style.animation = ''; } /* retrigger the .6s-delayed fade so sub-second loads never flash a tip */
    el.style.setProperty('--load-tint', zone === 'dungeon' ? '168,38,42' : zone === 'wild' ? '90,120,60' : '150,90,40');
    el.classList.remove('reveal'); el.style.display = ''; /* reveal removed → opacity 1 → instant opaque (no fade-IN, keeps the frozen frame hidden) */
  }
  setTimeout(() => { if (tok === _warmToken && _warming) { console.warn('warmScene watchdog: forcing reveal'); _warming = false; _hideCurtain(el); last = now(); } }, 8000);
  /* yield two frames so the opaque overlay actually paints before the (blocking) build+warm render begins */
  requestAnimationFrame(() => requestAnimationFrame(async () => {
    if (tok !== _warmToken) return;
    let _warmMobs = [];  /* declared out here so the finally can drop them even if the build/warm throws */
    try {
      if (buildFn) { buildFn(); placeCamera(player); }  /* build runs HERE — behind the now-painted opaque curtain (was run before warmScene, freezing a visible frame). Place the camera before the warm render so the revealed frame draws from the correct camera, not the previous zone's. */
      const _ckey = isCombat() ? _combatCtxKey() : null;   /* computed AFTER build — needs curTheme/curRegion set */
      const _skipWarm = typeof window !== 'undefined' && window.__skipCombatWarm; /* perf A/B: disable the combat warm to measure the un-warmed first-combat hitch (unset in normal play) */
      _warmMobs = (_ckey && !_warmedCtx.has(_ckey) && !_skipWarm) ? warmCombatPipelines() : [];  /* combat content, gated once per context */
      if (renderer.shadowMap.enabled) moon.shadow.needsUpdate = true;
      await renderer.compileAsync(scene, camera); /* off-main-thread warm of modules/pipelines; overlay stays live */
      renderFrame();                              /* sync: finalize the exact active (post) variant behind the gate */
      if (_ckey) _warmedCtx.add(_ckey);           /* mark warmed only after a successful in-context compile+render */
    } catch (err) { console.warn('warmScene warm failed:', err && err.message); }
    finally {
      for (const o of _warmMobs) { if (o.userData && o.userData.glb) removeMob(o); else removeMesh(o); } /* drop temp instances (noDispose → shared geo/mat survive) */
      // biome-ignore lint/correctness/noUnsafeFinally: the try/catch above already absorbs all throws, so this return only skips the cleanup tail when a newer warm-up superseded this token — no exception is masked.
      if (tok !== _warmToken) return;
      _warming = false; _hideCurtain(el); last = now(); placeCamera(player);
    }
  }));
}
function enterTown(area) {
  curTownArea = area || curTownArea || AREAS[0]; zone = 'town'; depth = 0;   /* cheap identity state, set sync for the label + isCombat(); the heavy build runs inside warmScene, behind the curtain */
  warmScene(curTownArea.name + ' · Town', () => {
    clearField(); invalidateTownInter(); buildTown(curTownArea); setZoneVisuals(); themeTown(curTownArea); setScale();
    for (const n of npcs) { n.group.visible = (!n.towns || n.towns.includes(curTownArea.id)); } player.x = 0; player.z = 8; player.hp = player.hpMax; refreshVendor(); zoneTxt.textContent = curTownArea.name + ' · Town'; townBtn.style.display = 'none'; saveProgress(false);
  }); /* placeCamera handled by warmScene's reveal */
}
function enterWild(regionId, spawn) {
  curArea = AREAS.find(a => a.id === 'wilds'); const r = (regionId && wildById(regionId)) || curRegion || REGIONS[0];
  curRegion = r; zone = 'wild'; depth = 0;   /* identity state sync — label uses r.name; the build runs inside warmScene, behind the curtain */
  warmScene(r.name + ' · Lv ' + r.lvl, () => {
    clearField(); invalidateWildInter(); buildWild(r);
    player.x = (spawn && spawn.x != null) ? spawn.x : WILD_SPAWN.x; player.z = (spawn && spawn.z != null) ? spawn.z : WILD_SPAWN.z;
    setZoneVisuals(); themeWild(); setScale(); waveTimer = 0;
    if (r.town) markDiscovered(r.town);   // reaching a biome reveals its adjoining town on the map
    zoneTxt.textContent = r.name + ' · Lv ' + r.lvl; townBtn.style.display = 'inline-block'; showMsg(r.name); saveProgress(false);
    wildObj = rollWildObjective(r.lvl);
    if (wildObj.kind === 'stalker') { const c = spawnChampion(0); if (c) { c.name = 'The Stalker of ' + r.name; setTimeout(() => showMsg('Something hunts you through ' + r.name + '…'), 1200); } else wildObj = null; }
    renderObjective();
  }); /* placeCamera handled by warmScene's reveal */
}
function payWildBounty() {
  let best = rollItem(curScale.ilvl + 2, null, 0.22); for (let k = 0; k < 2; k++) { const c = rollItem(curScale.ilvl + 2, null, 0.22); if (itemScore(c) > itemScore(best)) best = c; }
  dropLoot(player.x + 2, player.z, 'item', best); dropLoot(player.x, player.z, 'gold', Math.round(rand(50, 110) + ((curRegion && curRegion.lvl) || 1) * 10));
  gainXP(Math.round(player.xpNext * 0.12)); showMsg('Hunt complete!'); sfx('level'); _ev('bounty');
}
/* ---- shrines: individually-addressable, single-use buff altars, rebuilt each floor (outside the biome cache) ---- */
const SHRINE_COL = { empowered: 0xff5040, fleet: 0x6affa0, blessed: 0xffd24d, cursed: 0xb060ff, stoneskin: 0xc8b89a, greed: 0xffaa2a };
function buildShrineMesh(type) {
  const col = SHRINE_COL[type] || 0xffffff; const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 0.5, 8), new THREE.MeshPhongMaterial({ specular: 0x111111, color: 0x33303a, flatShading: true })); base.position.y = 0.25; base.castShadow = true; g.add(base);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, flatShading: true })); crystal.position.y = 1.7; g.add(crystal); g.userData.crystal = crystal;
  return g; // emissive-only (no per-shrine PointLight) — avoids light-set-swap shader recompiles; player aura lights it
}
function placeShrines() {
  if (!shrineGroup) { shrineGroup = new THREE.Group(); dungeonGroup.add(shrineGroup); }
  for (const s of shrines) { shrineGroup.remove(s.mesh); disposeObj(s.mesh); }
  shrines.length = 0; if (zone !== 'dungeon') return;
  const lay = dungeonLayout; const cnt = randi(2, 3);
  /* with a room layout, shrines spread one-per-room (skipping the spawn & portal rooms) so exploring off the
     critical path pays; arena floors keep the classic disc roll */
  const pool = lay ? lay.rooms.map(r => r.id).filter(id => id !== lay.spawnRoom && id !== lay.portalRoom) : null;
  for (let i = 0; i < cnt; i++) {
    let x = 0, z = 0;
    if (pool && pool.length) { const rid = pool.splice(randi(0, pool.length - 1), 1)[0]; const p = layoutRoomPoint(lay, rid, 7); x = p.x; z = p.z; }
    else { let tries = 0; do { const ang = rand(0, 6.28), dd = rand(22, DUNG_HALF - 12); x = Math.cos(ang) * dd; z = Math.sin(ang) * dd; tries++; } while (tries < 12 && (Math.hypot(x, z) < 14 || Math.hypot(x - (d_deeperPortal ? d_deeperPortal.x : 0), z - (d_deeperPortal ? d_deeperPortal.z : -50)) < 12)); }
    const type = (Math.random() < 0.22) ? 'cursed' : choice(['empowered', 'fleet', 'blessed', 'stoneskin', 'greed']);
    const mesh = buildShrineMesh(type); mesh.position.set(x, 0, z); shrineGroup.add(mesh);
    shrines.push({ x, z, type, used: false, mesh });
  }
}
/* ---- once-per-floor treasure chest (60% of layout floors, placed in a far room off the critical path) ---- */
let chest = null;
function placeChest() {
  if (chest) { shrineGroup.remove(chest.mesh); disposeObj(chest.mesh); chest = null; }
  const lay = dungeonLayout; if (zone !== 'dungeon' || !lay || Math.random() > 0.6) return;
  let best = -1, rid = -1;
  for (const rm of lay.rooms) { if (rm.id === lay.spawnRoom || rm.id === lay.portalRoom) continue; if (lay.dist[rm.id] > best) { best = lay.dist[rm.id]; rid = rm.id; } }
  if (rid < 0) return;
  const p = layoutRoomPoint(lay, rid, 8);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 1.15), new THREE.MeshPhongMaterial({ specular: 0x222211, color: 0x6a4a22, flatShading: true, map: texWood(1, 1) })); body.position.y = 0.5; body.castShadow = true; g.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 1.15), new THREE.MeshPhongMaterial({ specular: 0x333322, color: 0x7a5a2a, flatShading: true, map: texWood(1, 1) })); lid.position.set(0, 1.2, -0.55); g.add(lid); g.userData.lid = lid;
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.18, 1.2), new THREE.MeshPhongMaterial({ specular: 0x555533, color: 0xc8a03a, emissive: 0x3a2a08, flatShading: true })); band.position.y = 0.75; g.add(band);
  g.position.set(p.x, 0, p.z); shrineGroup.add(g);
  chest = { x: p.x, z: p.z, opened: false, mesh: g };
}
function openChest() {
  if (!chest || chest.opened) return; chest.opened = true; invalidateDungeonInter();
  if (chest.mesh && chest.mesh.userData.lid) { chest.mesh.userData.lid.rotation.x = -1.15; chest.mesh.userData.lid.position.z = -0.85; }
  spawnExplosion(chest.x, chest.z, 0xffd24d); sfx('gold'); showMsg('The chest creaks open…'); _ev('chest');
  const n = randi(2, 3);
  for (let i = 0; i < n; i++) { const ang = i / n * 6.28; let best = rollItem(curScale.ilvl + 2, null, 0.25); for (let k = 0; k < 2; k++) { const c = rollItem(curScale.ilvl + 2, null, 0.25); if (itemScore(c) > itemScore(best)) best = c; } dropLoot(chest.x + Math.cos(ang) * 2.2, chest.z + Math.sin(ang) * 2.2, 'item', best); }
  dropLoot(chest.x, chest.z, 'gold', Math.round(rand(60, 140) + depth * 12));
  if (Math.random() < 0.4) dropLoot(chest.x + 1, chest.z + 1, 'gem', { t: choice(GEM_KEYS), q: Math.random() < 0.6 ? 0 : 1 });
}
function activateShrine(s) {
  if (!s || s.used) return; s.used = true; invalidateDungeonInter(); _ev('shrine');
  if (zone === 'dungeon' && floorObj && !floorObj.done && bountyProgress(floorObj, 'shrine')) payBounty();
  renderObjective();
  const cr = s.mesh.userData.crystal; if (cr) { cr.material.color.setHex(0x555555); cr.material.emissive.setHex(0x222222); cr.material.emissiveIntensity = 0.05; }
  spawnExplosion(s.x, s.z, SHRINE_COL[s.type] || 0xffffff); sfx('level');
  if (s.type === 'empowered') { player.buffs.empUntil = now() + 30000; player.buffs.empMul = 1.25; floatText('Empowered!', player.x, player.z - 1, '#ff8a6a'); showMsg('Shrine of Power — +25% damage (30s)'); }
  else if (s.type === 'fleet') { player.buffs.fleetUntil = now() + 30000; player.buffs.fleetMul = 1.3; floatText('Fleet!', player.x, player.z - 1, '#6affa0'); showMsg('Shrine of Haste — +30% speed (30s)'); }
  else if (s.type === 'blessed') { const amt = Math.round(player.hpMax * 0.4); player.hp = Math.min(player.hpMax, player.hp + amt); if (player.statuses) player.statuses = player.statuses.filter(x => x.type !== 'burn' && x.type !== 'poison' && x.type !== 'bleed'); player.chillUntil = 0; updateGlobes(); floatText('+' + amt, player.x, player.z, '#ff6b5b'); showMsg('Blessed Shrine — restored & cleansed'); }
  else if (s.type === 'stoneskin') { player.buffs.stoneUntil = now() + 30000; floatText('Stoneskin!', player.x, player.z - 1, '#c8b89a'); showMsg('Shrine of Stone — 30% less damage taken (30s)'); }
  else if (s.type === 'greed') { const g = Math.round((rand(80, 160) + depth * 12) * (1 + (player.goldFind || 0))); player.gold += g; goldTxt.textContent = player.gold + ' g'; player.buffs.greedUntil = now() + 30000; floatText('+' + g + 'g', player.x, player.z, '#ffe27a'); sfx('gold'); showMsg('Shrine of Greed — gold rains, double gold (30s)'); }
  else { showMsg('Cursed Shrine — they come!'); spawnPack(); let best = rollItem(curScale.ilvl + 3, null, 0.3); for (let k = 0; k < 2; k++) { const c = rollItem(curScale.ilvl + 3, null, 0.3); if (itemScore(c) > itemScore(best)) best = c; } dropLoot(s.x, s.z, 'item', best); dropLoot(s.x + 1, s.z, 'gold', Math.round(rand(100, 200) + depth * 16)); }
}
/* ---- floor bounty payout + HUD ---- */
function payBounty() {
  for (let i = 0; i < 2; i++) { const ang = i / 2 * 6.28 + 0.6; let best = rollItem(curScale.ilvl + 2, null, 0.25); for (let k = 0; k < 2; k++) { const c = rollItem(curScale.ilvl + 2, null, 0.25); if (itemScore(c) > itemScore(best)) best = c; } dropLoot(player.x + Math.cos(ang) * 3, player.z + Math.sin(ang) * 3, 'item', best); }
  dropLoot(player.x, player.z, 'gold', Math.round(rand(60, 120) + depth * 10)); dropLoot(player.x + rand(-2, 2), player.z + rand(-2, 2), 'potion', 1);
  gainXP(Math.round(player.xpNext * 0.15)); showMsg('Bounty complete!'); sfx('level'); _ev('bounty');
}
let _objTxt = null;
function renderObjective() {
  if (!_objTxt) _objTxt = document.getElementById('objTxt'); if (!_objTxt) return;
  let s = '';
  if (zone === 'dungeon' && floorObj && !floorObj.done) s = floorObj.kind === 'champion' ? 'Bounty — Slay the Champion' : floorObj.kind === 'elites' ? ('Bounty — Slay elites ' + floorObj.count + '/' + floorObj.target) : floorObj.kind === 'shrines' ? ('Bounty — Commune with shrines ' + floorObj.count + '/' + floorObj.target) : ('Bounty — Slay foes ' + floorObj.count + '/' + floorObj.target);
  else if (zone === 'wild' && wildObj && !wildObj.done) s = wildObj.kind === 'stalker' ? 'Hunt — Slay the Stalker' : ('Hunt — Cull the wilds ' + wildObj.count + '/' + wildObj.target);
  if (s !== _objTxt._s) { _objTxt._s = s; _objTxt.textContent = s; _objTxt.style.display = s ? 'block' : 'none'; }
}
function enterDungeon(d) {
  zone = 'dungeon'; depth = d; invalidateDungeonInter(); if (d > character.maxDepth && d !== COW_DEPTH) { character.maxDepth = d; } /* the cow level never counts as a depth checkpoint (keeps it out of waypoints) */ _ev('depth');
  const _dl = d === COW_DEPTH ? '???' : 'Depth ' + d;   /* depth-only curtain label — curTheme isn't known until buildDungeon runs inside the buildFn */
  warmScene(_dl, () => {
    buildDungeon(d); clearField(); setZoneVisuals(); setScale(); player.x = 0; player.z = 0; waveTimer = 0; zoneTxt.textContent = (curTheme ? curTheme.name : 'Dungeon') + ' — ' + _dl; townBtn.style.display = 'inline-block'; showMsg((curTheme ? curTheme.name + ' · ' : '') + _dl);
    if (depth === COW_DEPTH) {
      floorObj = null; if (d_deeperPortal) d_deeperPortal.group.visible = false; if (d_cowExit) d_cowExit.group.visible = false;
      spawnCowKing(); bossActive = true;
      /* pre-spawn the herd directly (the _spawnQueue drain is gated on !bossActive); inside buildFn so the first-frame pipeline compile stays behind the loading gate */
      for (let i = 0; i < 22; i++) { const a = rand(0, 6.28), dd = rand(14, DUNG_HALF - 12); spawnMonster('cow', null, { x: Math.cos(a) * dd, z: Math.sin(a) * dd }); }
      setTimeout(() => showMsg('The herd stirs… Moo.'), 900);
    }
    else if (depth === 666) { floorObj = null; if (d_deeperPortal) d_deeperPortal.group.visible = false; spawnDevil(depth); bossActive = true; setTimeout(() => showMsg('The Devil of the Inferno bars the way…'), 900); }
    else if (depth % 5 === 0) { floorObj = null; if (d_deeperPortal) d_deeperPortal.group.visible = false; spawnBoss(depth); bossActive = true; setTimeout(() => showMsg('A guardian blocks the way down…'), 900); }
    else { if (d_deeperPortal) d_deeperPortal.group.visible = true; floorObj = rollFloorObjective(depth); if (floorObj && floorObj.kind === 'champion') { spawnChampion(depth); setTimeout(() => showMsg('A Champion stalks this floor…'), 900); } }
    placeShrines(); placeChest(); renderObjective();
    saveProgress(false);
  }); /* placeCamera handled by warmScene's reveal */
}

/* ---------- interaction ---------- */
/* shops stay walkable: opening one records the NPC spot, and update() closes it once the player wanders off. */
const SHOP_KINDS = new Set(['vendor', 'stash', 'smith', 'alchemist', 'enchanter', 'gambler', 'jeweler', 'premiumVendor']);
let shopAnchor = null;
/* The town interactable list (NPC filter + portals) is static for a whole town visit but was rebuilt — with a
   fresh filter/map and one object per NPC — twice a frame (nearest() + drawMinimap()). Cache it and rebuild only
   on town entry (invalidateTownInter). Wild/dungeon lists stay live: they're a few literals and carry dynamic
   state (bossActive gate, shrine `used`) that must be re-read each frame. */
let _townInter = null;
function invalidateTownInter() { _townInter = null; }
/* wild list is static for a whole wild visit (region fixed on entry by enterWild); dungeon list is static for a
   whole floor except for its dynamic state (shrine used/chest opened/boss slain), each of which invalidates it.
   Same cache-or-build-then-store shape as _townInter above — just multi-statement instead of one literal. */
let _wildInter = null;
function invalidateWildInter() { _wildInter = null; }
let _dungeonInter = null;
function invalidateDungeonInter() { _dungeonInter = null; }
/** @returns {Interactable[]} */
function interactables() {
  if (zone === 'town') return _townInter || (_townInter = [...npcs.filter(n => !n.towns || (curTownArea && n.towns.includes(curTownArea.id))).map(n => ({ kind: n.kind, x: n.x, z: n.z })), { kind: 'wild', x: t_wildPortal.x, z: t_wildPortal.z }, { kind: 'waypoint', x: t_waypoint.x, z: t_waypoint.z }, { kind: 'cauldron', x: t_cauldron.x, z: t_cauldron.z }, ...(curTownArea && curTownArea.id === 'town' && character && character.flags && character.flags.devilSlain ? [{ kind: 'cowportal', x: t_cowIdol.x, z: t_cowIdol.z }] : [])]); /* the bovine idol only answers in Aldermere after the Devil falls; cache invalidates on every town entry */
  if (zone === 'wild') {
    if (_wildInter) return _wildInter;
    const r = curRegion || REGIONS[0];
    /** @type {Interactable[]} */
    const arr = [{ kind: 'towngate', x: wpTown.x, z: wpTown.z, area: r.town }, { kind: 'cave', x: wpCave.x, z: wpCave.z }, { kind: 'waypoint', x: w_waypoint.x, z: w_waypoint.z }];
    if (r.next) arr.push({ kind: 'wildnext', x: wpNext.x, z: wpNext.z, to: r.next });
    if (r.prev) arr.push({ kind: 'wildprev', x: wpPrev.x, z: wpPrev.z, to: r.prev });
    return (_wildInter = arr);
  }
  if (bossActive) return [];
  if (_dungeonInter) return _dungeonInter;
  /** @type {Interactable[]} */
  const arr = depth === COW_DEPTH ? [{ kind: 'cowexit', x: d_cowExit.x, z: d_cowExit.z }] : [{ kind: 'deeper', x: d_deeperPortal.x, z: d_deeperPortal.z }]; /* cow floor is a dead end — no way down */
  for (const s of shrines) if (!s.used) arr.push({ kind: 'shrine', x: s.x, z: s.z, ref: s });
  if (chest && !chest.opened) arr.push({ kind: 'chest', x: chest.x, z: chest.z });
  return (_dungeonInter = arr);
}
function markDiscovered(id) { if (character && character.discovered && !character.discovered[id]) { character.discovered[id] = true; showMsg('Discovered ' + ((AREAS.find(a => a.id === id) || {}).name || id) + '!'); saveProgress(false); } }
function wildForTown(townId) { const w = REGIONS.find(r => r.town === townId); return w ? w.id : REGIONS[0].id; }
function nearest() { let best = null, bd = 6; for (const o of interactables()) { const d = Math.hypot(o.x - player.x, o.z - player.z); if (d < bd) { bd = d; best = o; } } return best; }
function refillPotions() { const cap = character.potionCap || 10; if (player.hpPotions >= cap && player.mpPotions >= cap && player.hp >= player.hpMax && player.mp >= player.mpMax) { showMsg('Already fully rested'); floatText('Full', player.x, player.z, '#9affc8'); return; } player.hpPotions = cap; player.mpPotions = cap; player.hp = player.hpMax; player.mp = player.mpMax; updateGlobes(); showMsg('Rested — HP, mana & potions restored'); floatText('+Restored', player.x, player.z, '#9affc8'); sfx('potion'); saveProgress(false); }
function interact() {
  if (anyPanel()) { closeAll(); return; } const o = nearest(); if (!o) return;
  if (o.kind === 'vendor') openVendor(); else if (o.kind === 'stash') openStash(); else if (o.kind === 'smith') openSmith(); else if (o.kind === 'alchemist') openAlchemist();
  else if (o.kind === 'enchanter') openEnchanter(); else if (o.kind === 'gambler') openGambler(); else if (o.kind === 'jeweler') openJeweler(); else if (o.kind === 'premiumVendor') openVendor(2);
  else if (o.kind === 'wild') enterWild(wildForTown(curTownArea.id)); else if (o.kind === 'towngate') { markDiscovered(o.area); enterTown(AREAS.find(a => a.id === o.area)); }
  else if (o.kind === 'cave') enterDungeon(1); else if (o.kind === 'deeper') enterDungeon(depth + 1); else if (o.kind === 'shrine') activateShrine(o.ref); else if (o.kind === 'chest') openChest();
  else if (o.kind === 'cowportal') enterDungeon(COW_DEPTH); else if (o.kind === 'cowexit') enterTown(AREAS[0]);
  else if (o.kind === 'wildnext') { const w = wildById(o.to); if (curRegion && curRegion.nextGate && ((character && character.maxDepth) || 0) < curRegion.nextGate) showMsg('Reach Depth ' + curRegion.nextGate + ' in the Descent to breach ' + (w ? w.name : 'the way') + '…'); else enterWild(o.to); }
  else if (o.kind === 'wildprev') enterWild(o.to);
  else if (o.kind === 'waypoint') openWaypoints(); else if (o.kind === 'cauldron') refillPotions();
  // set AFTER opening — each open*() calls closeAll(), which clears shopAnchor
  if (SHOP_KINDS.has(o.kind)) { shopAnchor = { x: o.x, z: o.z }; moveTarget = target = null; }
}
function travelTo(id, mode, depthArg) {
  closeAll(); closeWaypoints();
  if (wildById(id)) { enterWild(id); return; }                 // a specific biome (greenwilds/frostfen/ashlands)
  const a = AREAS.find(x => x.id === id); if (!a) return;
  if (a.kind === 'town') enterTown(a); else if (a.kind === 'wild') enterWild(REGIONS[0].id);   // legacy 'wilds' → Greenwilds
  else if (a.kind === 'dungeon') { const max = Math.max(1, (character && character.maxDepth) || 1); const sigil666 = depthArg === 666 && character && character.flags && character.flags.sigil; /* the Sigil of the Inferno is the only bypass of the maxDepth clamp */ const d = mode === 'depth' ? (sigil666 ? 666 : clamp(Math.round(depthArg || 1), 1, max)) : (mode === 'deep' && character.maxDepth > 1 ? character.maxDepth : 1); enterDungeon(d); }
}

let last = now(), waveTimer = 0, running = false, saveTimer = 0, invOpen = false, skillOpen = false, vendorOpen = false, stashOpen = false, smithOpen = false, enchantOpen = false, gambleOpen = false, jewelerOpen = false, alchemistOpen = false;
function anyPanel() { return invOpen || skillOpen || vendorOpen || stashOpen || smithOpen || enchantOpen || gambleOpen || jewelerOpen || alchemistOpen; }
/* Move/fight stay live with the inventory OR any shop open, so the player can walk away (update() auto-closes
   a shop once they leave shopAnchor). Only the full-screen skill forest pauses input. */
function busyPanel() { return skillOpen; }
function anyModal() { try { return (wpModal && wpModal.style.display === 'block') || (mpModal && mpModal.style.display === 'block') || (settingsModal && settingsModal.style.display === 'block') || (helpModal && helpModal.style.display === 'block'); } catch (_) { return false; } }
function syncBackdrop() { const b = document.getElementById('backdrop'); if (b) b.style.display = anyModal() ? 'block' : 'none'; }

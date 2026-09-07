# Der Koloss — rendering & feel architecture

Version 2 keeps version 1's map layout, gameplay rules, economy, rounds and
netcode, and rebuilds everything around them: the renderer, the lighting, the
materials, the level dressing, the camera, the movement, the effects and the
audio engine.

No version 1 system was modified — only what sits on top of it.

---

## 1. Render pipeline

The forward renderer no longer draws to the screen. `js/render/PostFX.js` owns
the frame:

```
world  ──► sceneRT (RGBA16F, 4x MSAA, float depth texture)
             │
             ├─► SAO ambient occlusion (½ res) ─► depth-aware bilateral blur
             ├─► volumetric raymarch (½ res, shadow-mapped sun + 4 practicals)
             └─► depth
             ▼
        resolve: colour × AO, + in-scattered light, bilateral upsample
             ▼
        screen-space reflections (puddle mask only)
             ▼
        camera motion blur (depth reprojection vs. previous view-projection)
             ▼
        depth of field (ADS / cinematic)
             ▼
        VIEWMODEL PASS  ◄── own camera, own FOV, own depth
             ▼
        bloom: soft-knee prefilter ─► 6-mip Karis downsample ─► tent upsample
             ▼
        composite: chromatic aberration, CAS sharpen, bloom + lens dirt,
                   exposure, AgX tonemap, lift/gamma/gain grade, damage
                   vignette, film grain, linear→sRGB
             ▼
        FXAA ─► backbuffer
```

Key decisions worth knowing before editing:

- **The forward pass is linear.** `renderer.toneMapping = NoToneMapping` and the
  scene renders into a half-float buffer. Tone mapping, colour conversion and
  exposure all happen in the composite. The map authors a single production
  exposure baseline in `GRADE` (`js/map.js`); the player's brightness slider
  only scales it.
- **AgX, not ACES.** Highlights desaturate toward white instead of clipping to a
  hue, which is what lets muzzle flashes and sodium lamps read like film.
- **`scene.background` must stay `null`.** A `Color` background sets `forceClear`
  inside three's `WebGLBackground`, which wipes the HDR buffer at the start of
  the viewmodel pass even with `autoClear` disabled. The shader skybox covers
  every pixel the world pass does not.
- **The viewmodel is a separate pass** on layer 1 with a fixed 75° lens, its own
  near/far range, and its own depth buffer (the ping-pong HDR targets carry a
  depth *renderbuffer* for exactly this). It runs after every depth-consuming
  pass, so the weapon gets bloom, grading, grain and AA but contributes nothing
  to ambient occlusion, volumetrics, motion blur or DOF. A weapon welded to the
  camera should not smear when you turn or darken the screen with occlusion.
- **`vmRoot`** compensates for the FOV change: the rig's parts are authored
  against the 110° world lens, so filming them at 75° would double their
  apparent size. The node preserves eye-to-weapon distance while scaling the
  weapon back down. Author weapons at real-world dimensions; never scale a
  weapon group to fix framing.
- **The world near plane is 0.15**, not 0.05, because the viewmodel no longer
  needs to fit in front of it. That is a 3× depth-precision gain, and every
  depth-based pass reads it.

Quality presets live in `QUALITY_PRESETS`. `low` drops AO, volumetrics, motion
blur, DOF and SSR and keeps bloom + FXAA.

## 2. Lighting

- `js/render/Sky.js` — procedural atmosphere: gradient with horizon haze, moon
  disc with limb darkening and a two-lobe halo, drifting stratus, hash-based
  stars. Baked once through `PMREMGenerator` into `scene.environment`, which is
  where every `MeshStandardMaterial` gets its directional ambient and specular.
- `js/render/SunShadow.js` — the moon's shadow box follows the player in a tight
  34m frustum, biased forward, and snaps its centre to the shadow map's texel
  grid. The snapping is what stops the crawling stair-step shimmer when walking.
- `MOON_DIR` in `js/map.js` is shared by the sky shader, the key light and the
  post stack's in-scatter direction. Change it in one place.
- Practicals (hanging lamps, wall lamps, fluorescents, emergency domes, fires)
  live in `js/map-props.js` and are driven from `props.update(dt, time, powerOn)`.
  The four nearest lit ones are fed to the volumetric raymarch each frame by
  `Game._updateVolumetricLights`.

### Measuring the light pool: "lit-light teleports"

`js/render/LightPool.js` hides all ~68 authored point lights and mirrors the
best few onto a fixed pool of real ones, so a pooled light necessarily changes
which source it represents as you move. The metric that says whether it does
that acceptably is the **lit-light teleport**, and it has been measured three
different ways by three different people with three different answers. Define it
exactly once, here:

> A lit-light teleport is a frame on which a pooled `THREE.PointLight` moves
> more than 0.25 m from its position on the previous frame **and has non-zero
> intensity on that frame**, excluding sources that genuinely moved that far
> themselves.

Three clauses that all matter, because dropping any one changes the number by
two orders of magnitude:

- **Measure the POOLED lights, not the sources.** `pool.lights[i].position` is
  what the shader samples. A source-side count answers a different question.
- **"Lit" means `intensity > 0`, on the frame of the move.** Not "lit on the
  previous frame", not "above some visibility threshold". The pool's whole
  no-pop guarantee is that the move lands on a frame that emits *exactly*
  nothing, so a threshold of literally zero is the one that tests it. This is
  the clause the two disagreeing measurements differed on: one counted the dark
  handover frame, the other counted the frame after it, when the light had
  re-lit at 1.3% of full at the new position. Both were reporting real frames;
  only one was reporting a defect.
- **Genuinely-moving sources are excluded, and must be named.** The pool
  correctly follows a source that moves; that is not a teleport. The movers are
  `WeaponRig.fill` (a point light parented to the **camera**, so it travels at
  player speed — 8.5 m/s at sprint, which crosses 0.25 m per frame below ~34fps
  and is why this metric is frame-rate sensitive), the mystery-box beacon across
  a `map.moveBox()`, `fx.muzzleLight`, `fx.boomLights`, and the four
  `HellhoundFX` lights riding hounds. Classify by comparing the source's own
  `matrixWorld` delta over the same frame; do not just eyeball the count.

Harness hygiene, learned the hard way: stop the frame loop outright
(`cancelAnimationFrame` **and** replace `tick` with a no-op) rather than
stubbing systems one at a time, drive the camera by writing its transform
directly, use a fixed `dt` and a 60-frame warm-up, and prove a stationary camera
differences to *exactly* 0.000 m before trusting any moving number. Measure
against a `git archive` snapshot on its own port — several sessions share this
working tree.

## 3. Materials

`js/render/Materials.js` extends `MeshStandardMaterial` through
`onBeforeCompile` with three world-space layers:

1. **Triplanar detail normal** at metre-scale tiling, so surfaces keep relief at
   any base UV density. It fades out with view distance — past a few metres one
   texel covers many pixels and the perturbation aliases into a crawling lattice.
2. **Macro variation** — very low frequency albedo and roughness mottling that
   breaks visible texture repeat at a distance.
3. **Wetness** — a two-frequency puddle mask (damp patches with standing water
   inside) that darkens albedo, flattens the normal and drops roughness on
   up-facing surfaces low in the world.

Plus **geometric specular antialiasing**: roughness is widened by the
screen-space variance of the normal, which is what stops glossy surfaces
sparkling under point lights.

And **normal-map level of detail**, which is what stops brick walls crawling
with bright dashes at a glancing angle. The shader measures the pixel's world
footprint (`fwidth` of the world position — this blows up at grazing incidence,
which is exactly where the artifact lives) and fades the whole normal
perturbation toward the geometric normal once one pixel covers more relief than
it can resolve. Close up the footprint is millimetres and nothing is lost. Two
things to know before touching it:

- the roughness widened in its place must come from a *local average*
  (`dFdx` of the normal). Scaling it by the instantaneous perturbation just
  moves the aliasing from the normal into the roughness, and measures worse
  than no fade at all;
- filtering cannot save a normal map whose source height field has one-texel
  cliffs, because the mip chain averages normals and three renormalises them.
  The generated brick height field is box-blurred before its Sobel for exactly
  this reason. Any new generated normal map needs the same treatment, plus
  `anisotropy` — the CC0 sets get 16 in `assets.js` and code-drawn canvas
  textures default to 1. `js/props/materials.js` follows the same rule:
  `normalFromHeight` blurs, and `finish()` sets trilinear + anisotropy 16.
  That blur is the single largest win measured at the bridge doorway — 32% off
  the oscillation at >8/255, against the 39% available from deleting the prop
  normal maps outright — because every prop height field is drawn as one- and
  two-pixel rectangles (14000 grains of sand-cast speckle, 2600 dots of orange
  peel, 220 casting pits).

  Filtering the SHADING is the second half, not a substitute: `enhanceMaterial`
  and `applyNormalFilter` in `js/render/Materials.js` share one copy of a
  normal-map LOD fade plus geometric specular AA. Turning the map's copy off
  costs 57% more oscillation in the courtyard, so it is load-bearing. But it
  does not scale — pushing the specular-AA strength from 2 to 8 to 24 made the
  doorway monotonically WORSE (3.43 → 3.97 → 5.24 at >8/255), because the
  screen-space derivative of an already-aliasing normal is itself an aliasing
  signal. Band-limit at the source first; filter the residue second.

## 3a. Coplanar surfaces

Two visible faces in the same plane cannot be resolved by the depth buffer, and
the seam between them crawls as the camera moves. This is the most common cause
of a "random parts of the map are flickering" report here. Three rules, guarded
by `scripts/validate-coplanar-surfaces.mjs`:

- **Doorways.** `wallRun()` leaves the brick a cut face at exactly ±w/2. The
  jamb from `js/props/door.js` rebates *past* that plane and the leaf is inset
  to sit inside the rebate. All three numbers live in `DOOR_FIT`
  (`js/map-layout.js`) so they can never be re-derived independently.
- **Stacked walls.** An elevated wall run's brickwork starts a `skirt` below its
  authored `y0`, burying the ground run's top face and the deck slab's top face
  that would otherwise share the plane. The collider still starts at `y0`.
- **Capped runs.** A run with another run standing on it also sinks its own
  cap (`cappedWallRuns` in `js/map-layout.js`). The skirt above only helps
  where the upper run is solid; inside an elevated door opening there is
  nothing below the lintel, and that is exactly where the player walks.
- **Ceiling slabs abut, never overlap.** An overlap at equal height puts two
  soffits in one plane, and the soffit is the face you look straight up at. The
  animal lab against the generator room was 11.8m² of it over a doorway.
- **Trims and nosings.** Anything laid on a surface stands proud of it, never
  flush. The spawn-platform step nosings are 4mm proud.

`scripts/validate-coplanar-surfaces.mjs` guards those specific arrangements
from layout data and from the map source.

### The triangle-level audit

The data-level guard above cannot see two classes of defect that shipped
anyway, because neither is visible in the numbers that describe the map:

- **inside a prop.** A machine is a hundred boxes merged by `Kit.finish()` into
  one mesh. The two faces that fight are triangles in the same buffer, with no
  seam in the source for a data check to name.
- **between two correct props.** Nothing was wrong with the pallet; there were
  simply two of them in one spot.

So `scripts/lib/coplanar-faces.mjs` measures the triangles, and
`scripts/validate-coplanar-geometry.mjs` builds every hero prop AND the whole
map headlessly (`scripts/lib/headless-map.mjs`) and holds both to a budget. A
pair counts when it is parallel, faces the **same** way, is within ~1.5mm of one
plane, and genuinely OVERLAPS inside it — two triangles of a quad share an edge
and overlap by zero, and so do two boxes butted together. Opposite-facing pairs
are ignored: only one of those can ever be front-facing.

It found 187.7 m² of fighting surface. What it was:

- **every crate drew its rails twice.** `crate()` placed the rail box at both
  `ry` and `ry + 90°`, but the rail is scaled equally in x and z, so the second
  placement is the *same box in the same place*. 150 m², and crates are in every
  room — this was the bulk of the "the whole map flickers" report on its own.
- **every pallet stacked its five deck boards along the axis each board already
  spans**, instead of across the deck. All five ended up coplanar, and the
  pallet did not read as a pallet either.
- **paired drums stood closer together than their rolling hoops are wide.**
- **props placed inside other props.** `alongWalls` tested candidates against
  everything the player must reach, but never against the props it had already
  put down. Decorative props that register no collider (pallets) need their own
  footprint list; solid ones need `propFree`.
- **the Pack-a-Punch core mass ran 0.125m past the plane its front skin starts
  on**, so the cabinet's side and top fought the skin's side and top. That is
  the one a player photographed.
- **lapped frames.** Four boxes around an opening where the head and sill run
  the full width *and* the jambs run the full height laps every corner twice,
  and since the members share a depth the lap puts two faces in one plane on the
  front, the back and the outer edge. Cut the jambs to the CLEAR span so the
  four members butt. Where two members must end level, overrun one by ~5mm so
  its end cap is buried inside the other rather than landing on the joint.
- **the room floor slabs were staggered by 0.4mm.** The comment said that was
  "orders of magnitude larger than the depth precision". It is not: with
  near = 0.15 and a 24-bit window one depth step is ~0.36mm at 30m and ~1.0mm at
  50m, and the map is 76 × 88m — so the near floor resolved and the far floor
  still fought, which is why it read as "it flickers over there but not here".
  They are now graph-coloured: a slab takes the lowest level not taken by a slab
  it overlaps, 2mm apart, which needs only two levels and so cannot drift away
  from the y = 0 that colliders and floor decals are placed against.

Two things to know before trusting any number it prints:

- **the kernel self-tests first, and that is not ceremony.** The first version
  clipped each triangle against its own interior — inverted winding — and
  reported 0.0000 m² for every prop in the game, including one already proven by
  hand to have 0.4 m² of coplanar cabinet side. An audit that cannot fail is
  worse than none, so the validator plants defects of known area and requires
  them to be measured before it reports on anything real.
- **a downward face lying on a floor is a prop's underside**, not a defect; it
  is never rasterised against anything. That is 36 m² of the raw total, and
  counted it buries the real findings. The floor levels come from the map's own
  `floorZones`, not from assuming y = 0 — the Chemical Testing teleporter rests
  on a deck 2.9m up.

Still inside the budget, deliberately: the tops of the tall wall runs where two
runs cross and cap at the same height (y = 4.5, 6.1, 7.0 — above the 3m
ceilings). Those live in `wallRun`, which `validate-wall-overlaps.mjs` and
`validate-coplanar-surfaces.mjs` already constrain from layout data, and are
better changed against those guards than around them.

## 3b. The shadow box edge

`ShadowEdgeFade.js` patches three's shadow ShaderChunk so the directional
shadow ramps to nothing over the outer 14% of the box instead of cliff-edging.
Read that file for why a receiver-side fade is the *complete* fix and casters
are not a separate problem.

**It is insurance, not a repair.** Measured at the shipping extent of 32 the
box edge is not visible at all: its ground footprint is 64 × 92.7m under a
43.7° moon, against a 76 × 88m map, and the box is centred on the player, so
the boundary is essentially always outside the world. Sweeping the box across
nine long-sightline stations with the camera pinned changed at most 13/255 on
0.0001% of pixels. The ramp earns its place the moment anyone shrinks `extent`
for performance: at extent 12 it removes 99% of the boundary artifact
(mean 0.102 → 0.0006), at extent 8, 78% (0.451 → 0.099).

The SSR pass reproduces the puddle mask *exactly* — same hash, same fbm, same
thresholds. If you change `wetScale` or `wetHeight` on the floor material, change
`postfx.ssrWetScale` / `ssrWetHeight` to match or the reflections will drift off
the puddles.

Merged map geometry uses **world-scaled UVs** (`solidGeos.*.uvScale`) so texel
density is uniform in metres rather than per-face. Materials in those buckets
keep a 1:1 texture repeat.

## 4. Level art

`js/map-props.js` dresses the map from a seeded PRNG — the layout is identical
every session. Crates, drums, pallets, sandbags, rubble, pipe runs, ducts,
I-beams, cable catenaries, chains, machines, workbenches, spools, a wrecked
truck and an overhead crane, merged into a handful of draw calls.

Solid props register real colliders. That makes placement a gameplay concern, so
every candidate position is tested against a keep-clear list built in `map.js`
from the interactables, doors, window barriers, ground-spawn risers, wall-buys,
perk machines, teleporters, the mystery box locations and the spawn. Decoration
runs *before* the map's clearance audits so those audits cover it.

## 5. Camera & movement

`js/render/CameraRig.js` produces local-frame offsets: stride-locked view bob,
mouse-lag sway, strafe and sprint roll, a landing spring, slide dip, breathing
that quickens with damage, and a recoil kick that is a separate spring from the
aim pitch — so recoil recovers to where you were aiming, not to where recoil
left you.

The springs use the **closed-form critically-damped solution**, not explicit
Euler. The explicit form goes unstable when `2·ω·dt > 1`, which for the recoil
spring is any frame slower than ~44fps, and the camera detonates into a spin.

`js/player.js` carries real velocity: acceleration toward a wish velocity,
friction on release, collision response fed back into velocity, air control at a
fraction of ground control, coyote time, jump buffering, a momentum slide on the
crouch key-down edge, and ledge mantling with headroom and room checks.

**Control budget:** `Q` is weapon swap and `E` is aim-down-sights. Any new
movement verb that grabs either silently breaks a core control — which is
exactly what a first pass at lean did. `scripts/validate-movement-feel.mjs`
guards this along with the spring stability and the slide edge behaviour.

## 6. Effects

`js/render/Particles.js` is a shader-backed pool with per-particle size,
rotation and colour/alpha ramps, split into additive (sparks, fire) and
alpha-blended (smoke, dust, blood) emitters. The old system was a single
`PointsMaterial`, which cannot read a per-particle size attribute — every effect
in the game drew at one fixed dot size.

`js/fx.js` builds on it: surface-aware bullet impacts (concrete, metal, wood,
dirt, glass — each with its own dust plume, ejecta, sparks and decal), oriented
bullet-hole and blood decals, a layered muzzle flash with a real light,
camera-facing tracers with a hot core, tumbling brass, and explosions with a
fireball, ember shrapnel, a smoke column and a ground dust ring.

## 7. Audio

`js/audio.js` plus `js/audio/*`: procedurally generated convolution reverb per
map zone, geometry-derived occlusion with a throttled cache, distance rolloff
with air-absorption low-pass, layered gunshots (sample + sub thump + reverb tail
+ action clack, with last-round and first-of-burst treatments), a compressed and
limited master bus with voice/explosion ducking and a concussion ring, low-health
tinnitus and heartbeat, surface-aware two-part footsteps, and a layered ambience
bed that scales with the round.

`Game` drives it through `audio.setListenerRoom`, `setIntensity`, `setAmmoState`,
`setRound`, `setOcclusionTest` and `bulletImpact`.

## 8. Validators

Run all of them before deploying:

```sh
for f in scripts/*.mjs; do node "$f" || exit 1; done
```

`validate-movement-feel.mjs` and `validate-performance-invariants.mjs` guard
fixes that were expensive to find: a control-key collision, an unstable camera
spring, the slide's key-edge behaviour, viewmodel/depth isolation, and the
allocation budget of the collision and particle hot paths.

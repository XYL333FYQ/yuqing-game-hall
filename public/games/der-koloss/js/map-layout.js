// Pure map topology shared by the runtime and deterministic route checks.
// Keep this module free of DOM/Three.js dependencies so CI can import it.

export const MAP_ROOMS = [
  // Stacked areas must precede their ground-level footprints.
  { id: 'upstairsa', name: 'Lab Balcony', rect: { minX: -14, maxX: -6, minZ: -22, maxZ: -8 }, yMin: 2.0 },
  { id: 'upstairsg', name: 'Garage Balcony', rect: { minX: 6, maxX: 14, minZ: -22, maxZ: -8 }, yMin: 2.0 },
  { id: 'chemtesting', name: 'Chemical Testing', rect: { minX: 10, maxX: 24, minZ: -38, maxZ: -22 }, yMin: 2.0 },
  { id: 'bridge', name: 'Bridge', rect: { minX: -6, maxX: 6, minZ: -13, maxZ: -11 }, yMin: 2.0 },
  { id: 'catwalk', name: 'Catwalk', rect: { minX: -12, maxX: 12, minZ: -53.1, maxZ: -50.9 }, yMin: 2.2 },
  { id: 'mainframe', name: 'Mainframe', rect: { minX: -10, maxX: 10, minZ: 14, maxZ: 26 }, outdoor: true },
  { id: 'leftcorridor', name: 'Left Corridor', rect: { minX: -14, maxX: -6, minZ: -22, maxZ: 14 } },
  { id: 'garageentrance', name: 'Garage Entrance', rect: { minX: 6, maxX: 14, minZ: -22, maxZ: 14 } },
  { id: 'animallab', name: 'Animal Testing Lab', rect: { minX: -32, maxX: -14, minZ: -20, maxZ: -6 } },
  { id: 'genroom', name: 'Generator Room', rect: { minX: -44, maxX: -32, minZ: -20, maxZ: -6 } },
  { id: 'autogarage', name: 'Automobile Garage', rect: { minX: 14, maxX: 32, minZ: -20, maxZ: -6 } },
  { id: 'courtyard', name: 'Courtyard', rect: { minX: -16, maxX: 10, minZ: -42, maxZ: -22 }, outdoor: true },
  { id: 'factory', name: 'Main Factory', rect: { minX: -14, maxX: 14, minZ: -62, maxZ: -42 } },
];

// Doorway fit, in metres. These numbers exist as data because the wall opening
// and the things that fill it are built by three different modules, and they
// used to agree EXACTLY — which is the one thing they must never do.
//
// `wallRun()` cuts the opening by leaving a gap of the door's width, so the
// brick has a cut face at exactly ±w/2. The channel-iron jamb's inner face and
// the steel leaf's edge both landed on that same plane, so three coplanar
// surfaces fought for every pixel down both sides of every doorway and along
// every lintel. That is the thin bright line players see beside a door.
//
// The jamb now REBATES into the opening, hiding the brick cut face behind it,
// and the leaf is inset far enough to sit inside that rebate. A real door jamb
// is built exactly this way, so it also reads better.
export const DOOR_FIT = {
  // How far the jamb post reaches past the wall cut plane, into the opening.
  jambRebate: 0.06,
  // Structural post section (across the opening x through the wall).
  postWidth: 0.28,
  postDepth: 0.34,
  // How much narrower/shorter the moving leaf is than the raw opening.
  leafInset: 0.06,
  // Wall thickness, mirrored from WALL_T in map.js.
  wallThickness: 0.4,
};

/**
 * Wall runs whose TOP is exactly the base of another run standing on them.
 *
 * Two stacked runs meet at a shared height, and so does the floor deck poured
 * at that height — three upward-facing surfaces in one plane. Where the upper
 * run is solid its skirt (see `wallRun` in map.js) swallows the joint, but a
 * DOOR OPENING in the upper run leaves a hole with nothing in it below the
 * lintel, and that is precisely where the player walks. On the Lab Balcony's
 * bridge doorway this put the ground wall's cap and the deck's surface in the
 * same plane right across the threshold.
 *
 * Sinking the capped run's visible top puts it inside the deck slab instead.
 * Returns a Set of run ids; `map.js` lowers their brickwork, never the
 * collider.
 * @param {Array} runs wall-run records, as in MAP_WALL_RUNS
 */
export function cappedWallRuns(runs) {
  const box = (w) => {
    const horiz = Math.abs(w.z2 - w.z1) < 0.001;
    const T = 0.4;
    return {
      minX: horiz ? Math.min(w.x1, w.x2) : w.x1 - T / 2,
      maxX: horiz ? Math.max(w.x1, w.x2) : w.x1 + T / 2,
      minZ: horiz ? w.z1 - T / 2 : Math.min(w.z1, w.z2),
      maxZ: horiz ? w.z1 + T / 2 : Math.max(w.z1, w.z2),
      y0: w.y0 || 0,
    };
  };
  const boxes = runs.map(box);
  const capped = new Set();
  for (let i = 0; i < runs.length; i++) {
    const top = boxes[i].y0 + runs[i].h;
    for (let j = 0; j < runs.length; j++) {
      if (i === j) continue;
      if (Math.abs(boxes[j].y0 - top) > 0.001) continue;
      const dx = Math.min(boxes[i].maxX, boxes[j].maxX) - Math.max(boxes[i].minX, boxes[j].minX);
      const dz = Math.min(boxes[i].maxZ, boxes[j].maxZ) - Math.max(boxes[i].minZ, boxes[j].minZ);
      if (dx > 0.05 && dz > 0.05) { capped.add(runs[i].id); break; }
    }
  }
  return capped;
}

const purchasableDoor = (door) => ({ ...door, visibilityTreatment: 'framed-lit-cost' });

export const MAP_DOOR_DEFS = [
  purchasableDoor({ id: 'd_mainL', rooms: ['mainframe', 'leftcorridor'], x: -8, z: 14, cost: 750 }),
  purchasableDoor({ id: 'd_mainR', rooms: ['mainframe', 'garageentrance'], x: 8, z: 14, cost: 750 }),
  // Animal Lab remains connected by a permanent lit opening below. Keeping a
  // second paid slab here beside d_pwrL made the Juggernog side read as two
  // adjacent doors buying the same route.
  // One deliberate Automobile Garage entrance is enough. d_gar used to sit
  // five metres north of this gate and joined the same two rooms, so opening
  // either adjacent door bought the exact same route and made the Double Tap
  // stairs look unfinished.
  purchasableDoor({ id: 'd_upG', rooms: ['autogarage', 'garageentrance'], x: 14, z: -12, cost: 1000, vert: true }),
  purchasableDoor({ id: 'd_gen', rooms: ['animallab', 'genroom'], x: -32, z: -13, cost: 1250, vert: true }),
  purchasableDoor({ id: 'd_chem', rooms: ['upstairsg', 'chemtesting'], x: 12, z: -22, cost: 750, y: 2.9 }),
  purchasableDoor({ id: 'd_fact', rooms: ['courtyard', 'factory'], x: -2, z: -42, cost: 1250, w: 2.2 }),
  purchasableDoor({ id: 'd_pwrL', rooms: ['leftcorridor', 'courtyard'], x: -10, z: -22, cost: 1000 }),
  // The Double Tap side needs a player-controlled entrance just like the
  // Juggernog route. This used to be power-sealed, which made the nearby open
  // undercroft look like the only route and led players outside the map.
  purchasableDoor({
    id: 'd_pwrR', rooms: ['garageentrance', 'courtyard'], x: 8, z: -22,
    cost: 1000, w: 3.2, openingStyle: 'wide-passage',
  }),
  purchasableDoor({ id: 'd_bridgeW', rooms: ['upstairsa', 'bridge'], x: -6, z: -12, cost: 750, vert: true, y: 2.9 }),
  purchasableDoor({ id: 'd_bridgeE', rooms: ['upstairsg', 'bridge'], x: 6, z: -12, cost: 750, vert: true, y: 2.9 }),
];

// Physical shell for the whole playable map. A gap is deliberately one of:
// - window: a board barrier with an explicit inward normal;
// - door: exactly one MAP_DOOR_DEFS entry occupies the opening;
// - passage: a permanent opening (never rendered as a misleading metal door).
// Keeping this data pure lets CI prove that visible walls, colliders, barriers,
// and door interactions all describe the same geometry.
const windowGap = (at, inward, room, w = 1.6) => ({ at, w, kind: 'window', in: inward, room });
const doorGap = (at, doorId, w = 1.9) => ({ at, w, kind: 'door', doorId });
const passageGap = (at, w = 1.9) => ({ at, w, kind: 'passage' });

export const MAP_WALL_RUNS = [
  { id: 'mainframe_north', x1: -10, z1: 26, x2: 10, z2: 26, h: 4.5, gaps: [windowGap(6, -1, 'mainframe'), windowGap(14, -1, 'mainframe')] },
  { id: 'mainframe_west', x1: -10, z1: 14, x2: -10, z2: 26, h: 4.5, gaps: [windowGap(6, 1, 'mainframe')] },
  { id: 'mainframe_east', x1: 10, z1: 14, x2: 10, z2: 26, h: 4.5, gaps: [windowGap(6, -1, 'mainframe')] },
  { id: 'mainframe_south', x1: -14, z1: 14, x2: 14, z2: 14, h: 4.5, gaps: [doorGap(6, 'd_mainL'), doorGap(22, 'd_mainR')] },

  { id: 'left_outer', x1: -14, z1: -8, x2: -14, z2: 14, h: 4.5, gaps: [windowGap(10, 1, 'leftcorridor'), windowGap(16, 1, 'leftcorridor')] },
  { id: 'left_inner', x1: -6, z1: -8, x2: -6, z2: 14, h: 4.5, gaps: [] },
  { id: 'lab_balcony_south', x1: -14, z1: -8, x2: -6, z2: -8, h: 3.2, y0: 2.9, gaps: [] },
  { id: 'lab_balcony_outer', x1: -14, z1: -22, x2: -14, z2: -8, h: 4.5, gaps: [passageGap(10, 2.4)] },
  // y0 starts where courtyard_north ENDS, not at balcony deck height. Both of
  // these sit at the same z and thickness as courtyard_north (y 0-4.5), so a
  // y0 of 2.9 put two identical brick walls in the same space from 2.9 to 4.5
  // — an 8m x 1.6m pair of coplanar faces that z-fought into a shimmering grey
  // slab across the wall at balcony height. Nothing is lost by starting at
  // 4.5: courtyard_north already blocks the balcony edge below that, and the
  // door gap there lines up with this run's passage gap.
  { id: 'lab_balcony_drop', x1: -14, z1: -22, x2: -6, z2: -22, h: 1.6, y0: 4.5, gaps: [passageGap(4)] },
  { id: 'left_alley_ground', x1: -6, z1: -22, x2: -6, z2: -8, h: 2.9, gaps: [] },
  // Elevated fake windows were removed: ground-level zombies spawned against
  // them and attacked empty air. The only opening here is the real bridge gate.
  { id: 'lab_balcony_inner', x1: -6, z1: -22, x2: -6, z2: -8, h: 3.2, y0: 2.9, gaps: [doorGap(10, 'd_bridgeW')] },

  { id: 'animal_south', x1: -32, z1: -20, x2: -14, z2: -20, h: 4.5, gaps: [windowGap(8, 1, 'animallab')] },
  { id: 'animal_west', x1: -32, z1: -20, x2: -32, z2: -6, h: 4.5, gaps: [windowGap(4, 1, 'animallab'), doorGap(7, 'd_gen'), windowGap(10, 1, 'animallab')] },
  { id: 'animal_north', x1: -32, z1: -6, x2: -14, z2: -6, h: 4.5, gaps: [] },
  { id: 'generator_west', x1: -44, z1: -20, x2: -44, z2: -6, h: 4.5, gaps: [windowGap(4, 1, 'genroom'), windowGap(10, 1, 'genroom')] },
  { id: 'generator_south', x1: -44, z1: -20, x2: -32, z2: -20, h: 4.5, gaps: [] },
  { id: 'generator_north', x1: -44, z1: -6, x2: -32, z2: -6, h: 4.5, gaps: [] },

  { id: 'garage_inner', x1: 6, z1: -8, x2: 6, z2: 14, h: 4.5, gaps: [] },
  { id: 'garage_outer', x1: 14, z1: -8, x2: 14, z2: 14, h: 4.5, gaps: [windowGap(12, -1, 'garageentrance'), windowGap(18, -1, 'garageentrance')] },
  { id: 'garage_balcony_south', x1: 6, z1: -8, x2: 14, z2: -8, h: 3.2, y0: 2.9, gaps: [] },
  // Solid bulkhead: the former underbridge pocket is deliberately not a room.
  { id: 'central_void_bulkhead', x1: -6, z1: -8, x2: 6, z2: -8, h: 4.5, gaps: [] },
  { id: 'auto_west', x1: 14, z1: -20, x2: 14, z2: -8, h: 4.5, gaps: [doorGap(8, 'd_upG')] },
  { id: 'auto_east', x1: 32, z1: -20, x2: 32, z2: -6, h: 4.5, gaps: [windowGap(4, -1, 'autogarage'), windowGap(10, -1, 'autogarage')] },
  { id: 'auto_south', x1: 14, z1: -20, x2: 32, z2: -20, h: 4.5, gaps: [] },
  { id: 'auto_north', x1: 14, z1: -6, x2: 32, z2: -6, h: 4.5, gaps: [] },
  { id: 'auto_stub', x1: 14, z1: -22, x2: 14, z2: -20, h: 4.5, gaps: [] },
  { id: 'right_alley_ground', x1: 6, z1: -22, x2: 6, z2: -8, h: 2.9, gaps: [] },
  { id: 'garage_balcony_inner', x1: 6, z1: -22, x2: 6, z2: -8, h: 3.2, y0: 2.9, gaps: [doorGap(10, 'd_bridgeE')] },
  { id: 'garage_balcony_drop', x1: 6, z1: -22, x2: 10, z2: -22, h: 1.6, y0: 4.5, gaps: [passageGap(2)] },

  { id: 'chem_north_upper', x1: 10, z1: -22, x2: 24, z2: -22, h: 3.2, y0: 2.9, gaps: [doorGap(2, 'd_chem')] },
  { id: 'chem_west_upper', x1: 10, z1: -38, x2: 10, z2: -22, h: 3.2, y0: 2.9, gaps: [passageGap(8, 2.4)] },
  { id: 'chem_south_upper', x1: 10, z1: -38, x2: 24, z2: -38, h: 3.2, y0: 2.9, gaps: [] },
  { id: 'chem_east_upper', x1: 24, z1: -38, x2: 24, z2: -22, h: 3.2, y0: 2.9, gaps: [] },
  { id: 'chem_north_ground', x1: 10, z1: -22, x2: 24, z2: -22, h: 2.9, gaps: [] },
  { id: 'chem_east_ground', x1: 24, z1: -38, x2: 24, z2: -22, h: 2.9, gaps: [] },
  { id: 'chem_south_ground', x1: 10, z1: -38, x2: 24, z2: -38, h: 2.9, gaps: [] },

  // The Courtyard holds the first mystery box but had no windows of its own, so
  // every zombie reaching it had to walk the whole way from Mainframe through a
  // door. That made the box a safe room. These two put the pressure back.
  //
  // The west perimeter is the only courtyard wall that can carry them. North
  // faces the Left Corridor and Garage Entrance, south is the Factory, and the
  // east wall backs onto Chemical Testing's undercroft — a barrier alcove
  // stands 2.8m out from the wall, so on any of those it would be a brick
  // pocket in the middle of a playable room. West of x=-16 is outside the
  // shell, which is where the other sixteen alcoves live.
  { id: 'courtyard_west', x1: -16, z1: -42, x2: -16, z2: -22, h: 4.5, gaps: [windowGap(5, 1, 'courtyard'), windowGap(14, 1, 'courtyard')] },
  { id: 'courtyard_east_south', x1: 10, z1: -42, x2: 10, z2: -38, h: 4.5, gaps: [] },
  { id: 'courtyard_east_north', x1: 10, z1: -38, x2: 10, z2: -22, h: 2.9, gaps: [] },
  { id: 'courtyard_north', x1: -16, z1: -22, x2: 10, z2: -22, h: 4.5, gaps: [doorGap(6, 'd_pwrL'), doorGap(24, 'd_pwrR', 3.2)] },
  { id: 'factory_north', x1: -16, z1: -42, x2: 14, z2: -42, h: 7, gaps: [doorGap(14, 'd_fact', 2.2)] },
  { id: 'factory_west', x1: -14, z1: -62, x2: -14, z2: -42, h: 7, gaps: [windowGap(10, 1, 'factory')] },
  { id: 'factory_east', x1: 14, z1: -62, x2: 14, z2: -42, h: 7, gaps: [windowGap(14, -1, 'factory')] },
  { id: 'factory_south', x1: -14, z1: -62, x2: 14, z2: -62, h: 7, gaps: [] },
];

export const MAP_WALLBUYS = [
  // The starter rifles used to overlap the two mainframe side windows at z=20,
  // making them look like floating props. z=23 centers them on solid panels.
  { x: -9.78, z: 23, nx: 1, nz: 0, weapon: 'kar98', price: 200, wallId: 'mainframe_west' },
  { x: 9.78, z: 23, nx: -1, nz: 0, weapon: 'gewehr43', price: 600, wallId: 'mainframe_east' },
  { x: -13.78, z: 12, nx: 1, nz: 0, weapon: 'm1a1', price: 600, wallId: 'left_outer' },
  { x: 13.78, z: 6, nx: -1, nz: 0, weapon: 'dbshotgun', price: 1200, wallId: 'garage_outer' },
  { x: 31.78, z: -13, nx: -1, nz: 0, weapon: 'thompson', price: 1200, wallId: 'auto_east' },
  { x: -19.5, z: -19.78, nx: 0, nz: 1, weapon: 'trench', price: 1500, wallId: 'animal_south' },
  { x: -6.22, z: -14, nx: -1, nz: 0, weapon: 'mp40', price: 1000, wallId: 'left_alley_ground' },
  // Chemical Testing is elevated. Keeping this buy at ground level placed it
  // inside the sealed exterior undercroft after the perimeter fix.
  { x: 16, y: 2.9, z: -37.78, nx: 0, nz: 1, weapon: 'type100', price: 1000, wallId: 'chem_south_upper' },
  { x: 9.78, z: -36, nx: -1, nz: 0, weapon: 'fg42', price: 1500, wallId: 'courtyard_east_north' },
  { x: -13.78, z: -46, nx: 1, nz: 0, weapon: 'stg44', price: 1200, wallId: 'factory_west' },
];

// Keep gameplay props in pure layout data so windows can be audited for a
// clear survivor rebuild zone and an unobstructed zombie approach. Speed Cola
// formerly sat at (13.4, 10), directly in front of garage_outer's window.
export const MAP_PERKS = [
  { id: 'qr', name: 'Quick Revive', price: 1500, color: 0x7ec8e3, x: -13.3, z: -58, ry: Math.PI / 2 },
  { id: 'jug', name: 'Juggernog', price: 2500, color: 0xd23c2a, x: -13.4, z: -18, ry: Math.PI / 2 },
  { id: 'speed', name: 'Speed Cola', price: 3000, color: 0x3fae5a, x: 13.4, z: 12.5, ry: -Math.PI / 2 },
  { id: 'dtap', name: 'Double Tap', price: 2000, color: 0xe8a33d, x: 13.4, z: -21, ry: -Math.PI / 2 },
];

export const INITIAL_MYSTERY_BOX = { x: -4, z: -23.2 };

// Teleporters are topology, not decorative props. Keeping their floor and room
// declarations here lets CI catch the former Teleporter B regression where the
// machine was constructed at y=0 beneath Chemical Testing's 2.9m upper floor.
export const MAP_TELEPORTERS = [
  { id: 'teleA', label: 'A', room: 'genroom', x: -38, y: 0, z: -13, clearance: 1.9, frameHeight: 3.2 },
  // Chemical Testing has 3.1m of headroom above its upper floor. B uses a
  // compact 2.5m gantry so its frame and letter sit visibly below the ceiling.
  { id: 'teleB', label: 'B', room: 'chemtesting', x: 17, y: 2.9, z: -30.5, clearance: 1.9, frameHeight: 2.5 },
  { id: 'teleC', label: 'C', room: 'factory', x: 0, y: 0, z: -56, clearance: 1.9, frameHeight: 3.2 },
];

export const MAINFRAME_PLATFORM = {
  minX: -6, maxX: 6, minZ: 14, maxZ: 18.5, y: 0.9,
  sideDropOpen: true,
};

// Physical step zones leading up to the mainframe deck. These mirror the
// visible concrete boxes in map.js so the stairs are walkable from the front
// and sides instead of being decorative geometry over a flat floor.
export const MAINFRAME_STEPS = [
  { minX: -6, maxX: 6, minZ: 18.65, maxZ: 19.75, y: 0.6 },
  { minX: -6, maxX: 6, minZ: 19.85, maxZ: 20.95, y: 0.3 },
];

export const MAINFRAME_EAST_ENTRY_KEEP_CLEAR = {
  minX: 6.5, maxX: 9.8, minZ: 13.2, maxZ: 17.4,
};

// The factory stair reaches its landing at x=-8.4. The visible deck and rails
// must begin there rather than spanning back over the ascending flight.
export const FACTORY_CATWALK = {
  minX: -8.4, maxX: 12, minZ: -53.1, maxZ: -50.9, y: 3.1,
  stairLandingX: -8.4,
};

export const PAP_ENERGY_VISUAL = {
  ringSegments: 24,
  tubeSegments: 6,
  arcCount: 3,
  arcPoints: 7,
  centerY: 1,
  centerZ: 0.39,
  coreRadius: 0.08,
  coreOffsetZ: 0.1,
  ringRadii: [0.14, 0.19],
  ringTube: 0.008,
  boltHalfWidth: 0.18,
  boltDepth: 0.12,
  aperture: { halfWidth: 0.45, halfHeight: 0.25, frontZ: 0.6 },
};

export function papEnergyEnvelope(config = PAP_ENERGY_VISUAL) {
  const ringExtent = Math.max(...config.ringRadii) + config.ringTube;
  const coreFront = config.coreOffsetZ + config.coreRadius;
  const boltFront = config.boltDepth + 0.04;
  return {
    minX: -Math.max(ringExtent, config.boltHalfWidth),
    maxX: Math.max(ringExtent, config.boltHalfWidth),
    minY: config.centerY - ringExtent,
    maxY: config.centerY + ringExtent,
    maxZ: config.centerZ + Math.max(ringExtent, coreFront, boltFront),
  };
}

// The colliders that close in a stair flight climbing along X.
//
// A flight is visual boxes sitting over a floorY ramp: nothing about it is solid
// on its own, so without these you walk straight in from the side or from behind
// and end up standing inside the staircase, under the treads.
//
// One collider per step down each long edge rather than one wall per flight,
// following the mainframe platform fascia: each segment is only as tall as the
// stairs beside it, and is a one-way side keyed to the tread it guards.
// Approaching at floor level you launched from y=0, so every segment blocks and
// the flight reads as closed from below. Once you are on the flight you launched
// from the tread itself, so the segments release and you can run off either side
// and drop — a staircase in the open, not a trench. Zombies ignore the one-way
// flag entirely (see moveZombie), so for them a flight stays solid and the
// stairs remain the only way up.
export function stairFlightColliders({
  xLow, xHigh, zMin, zMax, yTop, steps, closeHighEnd = false, playerRadius = 0.35,
}) {
  const out = [];
  const sign = Math.sign(xHigh - xLow);
  const run = Math.abs(xHigh - xLow);
  const stepRun = run / steps, stepRise = yTop / steps;
  // Release at the tread height a player-radius BACK down the flight, so the
  // step you stand on also frees the segment of the step above — your collision
  // circle always overlaps it, and keying each segment to its own height would
  // fence you in for the lower half of every step.
  const releaseAt = (y) => Math.max(0, y - (yTop / run) * playerRadius);
  for (let i = 0; i < steps; i++) {
    const a = xLow + sign * stepRun * i, b = a + sign * stepRun;
    for (const sz of [zMin, zMax]) out.push({
      minX: Math.min(a, b), maxX: Math.max(a, b),
      minZ: sz - 0.09, maxZ: sz + 0.09,
      // Stand proud of the tread so a zombie on the flight is held on it at
      // every height, the way a full-height stringer wall would.
      y0: 0, h: stepRise * (i + 1) + 1.1, prop: true,
      // ...but a full-height stringer wall is not what you SEE. These flights
      // are drawn as eight bare tread plates with open sides, so the volume
      // this collider occupies above and below the treads is empty air to the
      // eye. It still ate every bullet crossing it, which is why shooting a
      // zombie standing in the open void under the balcony stairs — the ones by
      // Juggernog and Double Tap — never registered. Physical for bodies,
      // transparent to shots; the treads carry their own bullet collider.
      bulletPass: true,
      // A stringer is what makes the flight a flight, not clutter standing in
      // it — the traversal audit must not read its own structure as a blocker.
      keepClearExempt: true,
      oneWayPlatformSide: true, oneWayDeckTop: releaseAt(stepRise * i),
    });
  }
  // Wall off the top of the flight where it butts into a slab: the space under
  // the treads is structure, not a room to walk into from the far side. Stops
  // just under the deck so standing on the deck above can never re-activate it.
  //
  // It has to release for the climber, though. A player is a 0.35m circle, so
  // their body reaches this wall while their feet are still a step and a bit
  // below the landing — solid at that height, the wall meant the last 0.21m of
  // both balcony flights could only be cleared with a jump. Keyed the same way
  // as the side segments it opens the moment you are actually on the top of the
  // flight, and stays solid for anyone on the floor underneath.
  if (closeHighEnd) out.push({
    minX: Math.min(xHigh, xHigh + sign * 0.18), maxX: Math.max(xHigh, xHigh + sign * 0.18),
    minZ: zMin, maxZ: zMax, y0: 0, h: yTop - 0.06, prop: true, keepClearExempt: true,
    oneWayPlatformSide: true, oneWayDeckTop: releaseAt(yTop),
    bulletPass: true, // invisible, like the side segments — see the note above
  });
  return out;
}

export function platformSideBlocksAtFeet(collider, feetY, launchY = feetY) {
  if (!collider?.oneWayPlatformSide) return true;
  const top = (collider.y0 || 0) + (collider.h || 0);
  if (Number.isFinite(collider.oneWayDeckTop)) {
    // Decide by the surface the player launched from, not jump apex. Someone
    // already on the deck may leave; a courtyard jump cannot phase inward.
    return launchY < collider.oneWayDeckTop - 0.06;
  }
  // Ground-level approaches collide with the platform fascia. A player whose
  // feet are already on the deck (or airborne above it) may cross outward.
  // The 0.28m release band is below a normal jump apex but above floor-level
  // walking, so a deliberate jump can mount the 0.9m deck from either side.
  return feetY < top - 0.28;
}

export function auditInteractableApproaches({ interactables = [], colliders = [], roomAt, floorY } = {}) {
  const issues = [];
  const playerRadius = 0.34;
  const overlaps = (x, z, y, collider) => {
    if (collider.shootOk || collider.noRaycast) return false;
    if (collider.y0 !== undefined && (collider.y0 > y + 1.7 || collider.y0 + collider.h < y + 0.02)) return false;
    const nearestX = Math.max(collider.minX, Math.min(x, collider.maxX));
    const nearestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ));
    return Math.hypot(x - nearestX, z - nearestZ) < playerRadius;
  };

  for (const item of interactables) {
    if (!item?.id || !item.pos || !Number.isFinite(item.radius)) {
      issues.push(`${item?.id || '(unknown)'} has incomplete interaction geometry`);
      continue;
    }
    const referenceY = Math.max(0, (item.pos.y || 1.2) - 1.2);
    const outer = Math.max(0.72, item.radius - 0.42);
    const radii = [outer, Math.max(0.72, outer * 0.72)];
    let clearSamples = 0;
    for (const radius of radii) {
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI * 2 / 24;
        const x = item.pos.x + Math.cos(angle) * radius;
        const z = item.pos.z + Math.sin(angle) * radius;
        const y = typeof floorY === 'function' ? floorY(x, z, referenceY + 0.25) : referenceY;
        if (typeof roomAt === 'function' && !roomAt(x, z, y)) continue;
        if (Math.abs((y + 1.2) - (item.pos.y || 1.2)) > 2.4) continue;
        if (colliders.some((collider) => overlaps(x, z, y, collider))) continue;
        clearSamples++;
      }
    }
    // Two distinct samples prevent a single numerical seam from satisfying the
    // audit while still permitting wall-mounted controls and narrow door faces.
    if (clearSamples < 2) issues.push(`${item.id} has no clear player approach inside its use radius`);
  }
  return { ok: issues.length === 0, issues, checked: interactables.length };
}

export function auditKeepClearZone(zone, colliders = []) {
  // A zone that names the floor it belongs to is only obstructed by props on
  // THAT level. One room's floor is the room below's ceiling, so the machine
  // standing under the garage balcony shares its footprint with the stair
  // landing 2.9m above it and is no obstacle to anyone walking up there.
  const floorY = Number.isFinite(zone.floorY) ? zone.floorY : null;
  const blockers = colliders.filter((collider) => {
    if (!collider?.prop || collider.keepClearExempt) return false;
    if (floorY !== null && collider.y0 !== undefined
      && (collider.y0 + collider.h <= floorY + 0.12 || collider.y0 >= floorY + 2.0)) return false;
    return collider.maxX > zone.minX && collider.minX < zone.maxX
      && collider.maxZ > zone.minZ && collider.minZ < zone.maxZ;
  });
  return { ok: blockers.length === 0, blockers };
}

export function teleporterPromptState({ powerOn, charging = false, cooldown = 0 } = {}) {
  if (!powerOn) return 'no-power';
  if (charging) return 'charging';
  if (cooldown > 0) return 'recharging';
  return 'ready';
}

export const MAP_RAMPS = [
  { id: 'mainframeSteps', minX: -6, maxX: 6, minZ: 18.5, maxZ: 21.5, axis: 'z', dir: 1, y0: 0.9, y1: 0 },
  { id: 'labStairs', minX: -13.2, maxX: -8.8, minZ: -13.2, maxZ: -10.8, axis: 'x', dir: 1, y0: 0, y1: 2.9, approach: 2.6 },
  { id: 'garageStairs', minX: 8.8, maxX: 13.2, minZ: -13.2, maxZ: -10.8, axis: 'x', dir: -1, y0: 0, y1: 2.9, approach: 2.6 },
  // The bottom of this flight used to start at x = -13.2, but factory_west sits
  // at x = -14 with a 0.4m thickness, so its inner face is at -13.8. That left
  // a 0.6m pocket at the foot of the stairs — narrower than the player's own
  // 0.7m diameter — so you could not physically stand at the bottom and the
  // flight was unclimbable. Pulled back to -12.6 for 1.2m of approach room.
  { id: 'catwalkStairs', minX: -12.6, maxX: -8.4, minZ: -53.4, maxZ: -50.8, axis: 'x', dir: 1, y0: 0, y1: 3.1, approach: 2.6 },
];

// Every volume a player actually moves through, and the headroom it needs kept
// empty. Dressing must never enter one.
//
// Decoration is placed from a room's RECTANGLE at a height fixed per room, and
// that height knows nothing about what is underneath it. A ceiling duct pinned
// 3.55m above the ground floor of the two corridor rooms crossed both balcony
// stairwells — where the top tread is already at 2.9m — so it hung 0.65m over
// the landing with nothing holding it up and nothing above it: a box floating
// in mid-air across the only route upstairs, on the Double Tap flight and its
// mirror above Juggernog. The factory catwalk had the identical bug and was
// patched on its own (the old `clearOfCatwalk`, cables only); this generalises
// the guard so it covers every walkway and every kind of dressing instead.
//
// `floorY` is the surface a player stands on, `clearTop` the height below which
// nothing decorative may sit. Elevated decks are listed too, because one room's
// floor is the room below's ceiling: a run hung at "ceiling height" for the
// lower room surfaces just above the deck of the upper one.
const WALKWAY_HEADROOM = 2.3;

const rampWalkway = (r) => ({
  id: r.id,
  minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ,
  floorY: Math.min(r.y0, r.y1),
  clearTop: Math.max(r.y0, r.y1) + WALKWAY_HEADROOM,
});

// A doorway is only as wide as its opening, but the approach on both sides has
// to stay walkable too, so the volume is padded across the wall line.
const doorWalkway = (d) => {
  const half = (d.w || 1.9) / 2, y = d.y || 0;
  return {
    id: d.id,
    minX: d.vert ? d.x - 0.9 : d.x - half,
    maxX: d.vert ? d.x + 0.9 : d.x + half,
    minZ: d.vert ? d.z - half : d.z - 0.9,
    maxZ: d.vert ? d.z + half : d.z + 0.9,
    floorY: y,
    clearTop: y + WALKWAY_HEADROOM,
  };
};

export const MAP_WALKWAYS = [
  ...MAP_RAMPS.map(rampWalkway),
  ...MAP_DOOR_DEFS.map(doorWalkway),
  {
    id: 'catwalkDeck',
    minX: FACTORY_CATWALK.minX, maxX: FACTORY_CATWALK.maxX,
    minZ: FACTORY_CATWALK.minZ, maxZ: FACTORY_CATWALK.maxZ,
    floorY: FACTORY_CATWALK.y, clearTop: FACTORY_CATWALK.y + WALKWAY_HEADROOM,
  },
  // Elevated decks — these match the slabs built in map.js (`slabHole`, and the
  // bridge deck), so dressing hung for the room underneath cannot surface here.
  { id: 'labBalconyDeck', minX: -14, maxX: -6, minZ: -22, maxZ: -8, floorY: 2.9, clearTop: 2.9 + WALKWAY_HEADROOM },
  { id: 'garageBalconyDeck', minX: 6, maxX: 14, minZ: -22, maxZ: -8, floorY: 2.9, clearTop: 2.9 + WALKWAY_HEADROOM },
  { id: 'bridgeDeck', minX: -6, maxX: 6, minZ: -13, maxZ: -11, floorY: 2.9, clearTop: 2.9 + WALKWAY_HEADROOM },
];

// Routes that carry no door record. A doorway announces itself to the dressing
// pipeline through MAP_DOOR_DEFS; an opening cut in a wall announces nothing, so
// nothing knew these existed and a workbench spawned squarely in the Chemical
// Testing courtyard exit. Each of these is the only route it serves.
export const MAP_OPEN_EXITS = [
  { id: 'chemCourtyardExit', minX: 9.2, maxX: 11.8, minZ: -31.4, maxZ: -28.6, floorY: 2.9 },
  { id: 'labBalconyDrop', minX: -11.4, maxX: -8.6, minZ: -23.0, maxZ: -21.0, floorY: 2.9 },
  { id: 'garageBalconyDrop', minX: 6.6, maxX: 9.4, minZ: -23.0, maxZ: -21.0, floorY: 2.9 },
];

// Both balcony flights are set into the outer wall of a corridor, so you meet
// them side-on: the approach is the band ACROSS the hallway in front of the
// mouth, not just the strip in line with the run that `approach` describes. A
// prop on the near wall and one on the far wall need not touch the stairs at all
// to turn that band into a chicane at the one point you most want to be running,
// and that is exactly what a machine and a crate facing each other did. Full
// room width, because the point of the band is that you can cross it.
//
// Only the balcony flights get one. The catwalk stairs open onto twenty-eight
// metres of factory floor, where there is no lane to pinch.
export const MAP_STAIR_MOUTHS = [
  { id: 'labStairsMouth', minX: -14, maxX: -6, minZ: -10.8, maxZ: -8.2, floorY: 0 },
  { id: 'garageStairsMouth', minX: 6, maxX: 14, minZ: -10.8, maxZ: -8.2, floorY: 0 },
];

// A flight is only usable if you can walk ONTO it. The ramp footprint was
// described (see rampWalkway) but the apron at each end — where you turn in off
// the floor, and where you step off onto the deck — was not, so a crate parked
// against the wall a couple of metres short of the balcony stairs stood in the
// only lane to them and nothing said that was wrong.
//
// The apron reaches the same distance in every direction, not only along the
// run: a 2.4m flight boxed in against an outer wall is approached on whatever
// heading the room gives you, and clutter beside its mouth blocks it as surely
// as clutter on the treads. Only ramps that declare an `approach` get one — the
// mainframe terrace is twelve metres wide and open on three sides, so there is
// no lane there to keep clear and a landmark 1.4m off its end blocks nothing.
const rampTraversalZones = (r) => {
  const zones = [
    { id: r.id, minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, floorY: Math.min(r.y0, r.y1) },
  ];
  if (!r.approach) return zones;
  const alongX = r.axis === 'x';
  const pad = r.approach;
  // `dir` points at the tt=1 end, which is where y1 is — not necessarily the top.
  const apron = (id, at, floorY) => zones.push({
    id,
    minX: alongX ? at - pad : r.minX - pad,
    maxX: alongX ? at + pad : r.maxX + pad,
    minZ: alongX ? r.minZ - pad : at - pad,
    maxZ: alongX ? r.maxZ + pad : at + pad,
    floorY,
  });
  const start = alongX ? (r.dir > 0 ? r.minX : r.maxX) : (r.dir > 0 ? r.minZ : r.maxZ);
  const end = alongX ? (r.dir > 0 ? r.maxX : r.minX) : (r.dir > 0 ? r.maxZ : r.minZ);
  apron(`${r.id}${r.y0 <= r.y1 ? 'Foot' : 'Landing'}`, start, r.y0);
  apron(`${r.id}${r.y0 <= r.y1 ? 'Landing' : 'Foot'}`, end, r.y1);
  return zones;
};

// Every volume that has to stay walkable end to end. Dressing is kept out of
// these at placement time (map-props) and a build-time audit fails the map if
// anything solid lands inside one anyway.
export const MAP_TRAVERSAL_ZONES = [
  ...MAP_RAMPS.flatMap(rampTraversalZones),
  ...MAP_STAIR_MOUTHS,
  ...MAP_OPEN_EXITS,
];

export const MAP_NAV_LINKS = [
  { from: 'leftcorridor', to: 'animallab', x: -14, z: -12, passage: true },
  { from: 'animallab', to: 'leftcorridor', x: -14, z: -12, passage: true },
  { from: 'leftcorridor', to: 'upstairsa', x: -11, z: -12, stair: true, route: 'labStairs' },
  { from: 'upstairsa', to: 'leftcorridor', x: -11, z: -12, stair: true, route: 'labStairs' },
  { from: 'garageentrance', to: 'upstairsg', x: 11, z: -12, stair: true, route: 'garageStairs' },
  { from: 'upstairsg', to: 'garageentrance', x: 11, z: -12, stair: true, route: 'garageStairs' },
  { from: 'upstairsa', to: 'courtyard', x: -10, z: -22, drop: true },
  { from: 'upstairsg', to: 'courtyard', x: 8, z: -22, drop: true },
  { from: 'factory', to: 'catwalk', x: -13, z: -52, stair: true, route: 'catwalkStairs' },
  { from: 'catwalk', to: 'factory', x: -13, z: -52, stair: true, route: 'catwalkStairs' },
];

// Return every room from which an enemy can follow the CURRENT directed graph
// to at least one player. Doors are bidirectional once open; nav links retain
// their declared direction (in particular, balcony drops never become ladders).
// Traversing predecessors from each player room computes that set directly.
/**
 * Same reverse walk as `roomsThatCanReachPlayers`, but keyed by how many room
 * transitions separate each room from the nearest player.
 *
 * The spawner needs the hop count, not just membership: pooling every reachable
 * window with equal weight meant the tail of a wave was routinely born at the
 * far shell of the map. Measured, with a player in the Factory on round one, the
 * sixth of six zombies spawned at a Mainframe window 76m away and walked for 80
 * seconds — the player spent the round hunting for a zombie that was still on
 * its way. Ringing by depth keeps the overflow adjacent instead of anywhere.
 *
 * Direction is preserved exactly as in the Set version: an open door is
 * bidirectional, a nav link keeps its declared direction, so a balcony drop
 * never becomes a ladder.
 *
 * @returns {Map<string, number>} room id -> hop count (0 for a player's room)
 */
export function roomDepthsToPlayers(playerRooms, openDoors = [], navLinks = MAP_NAV_LINKS) {
  const predecessors = new Map();
  const addPredecessor = (to, from) => {
    if (!predecessors.has(to)) predecessors.set(to, []);
    predecessors.get(to).push(from);
  };
  for (const door of openDoors) {
    if (!Array.isArray(door?.rooms) || door.rooms.length !== 2) continue;
    addPredecessor(door.rooms[0], door.rooms[1]);
    addPredecessor(door.rooms[1], door.rooms[0]);
  }
  for (const link of navLinks || []) {
    if (!link?.from || !link?.to) continue;
    addPredecessor(link.to, link.from);
  }
  const depth = new Map();
  const queue = [];
  for (const room of playerRooms || []) {
    if (room && !depth.has(room)) { depth.set(room, 0); queue.push(room); }
  }
  // Breadth-first, so the first time a room is reached is by a shortest path.
  for (let i = 0; i < queue.length; i++) {
    const room = queue[i];
    const next = depth.get(room) + 1;
    for (const predecessor of predecessors.get(room) || []) {
      if (depth.has(predecessor)) continue;
      depth.set(predecessor, next);
      queue.push(predecessor);
    }
  }
  return depth;
}

export function roomsThatCanReachPlayers(playerRooms, openDoors = [], navLinks = MAP_NAV_LINKS) {
  const predecessors = new Map();
  const addPredecessor = (to, from) => {
    if (!predecessors.has(to)) predecessors.set(to, []);
    predecessors.get(to).push(from);
  };
  for (const door of openDoors) {
    if (!Array.isArray(door?.rooms) || door.rooms.length !== 2) continue;
    addPredecessor(door.rooms[0], door.rooms[1]);
    addPredecessor(door.rooms[1], door.rooms[0]);
  }
  for (const link of navLinks || []) {
    if (!link?.from || !link?.to) continue;
    addPredecessor(link.to, link.from);
  }

  const reachable = new Set((playerRooms || []).filter(Boolean));
  const queue = [...reachable];
  while (queue.length) {
    const room = queue.shift();
    for (const predecessor of predecessors.get(room) || []) {
      if (reachable.has(predecessor)) continue;
      reachable.add(predecessor);
      queue.push(predecessor);
    }
  }
  return reachable;
}

// Pick a rise point on the survivor's actual floor and in their actual room.
// Stacked rectangles (balcony over corridor, catwalk over factory) make a plain
// roomAt(x,z) query resolve the ground floor and were the source of underground
// emergency spawns that could not reach an upper-only survivor.
export function elevationAwareRiseCandidate({ target, candidates, roomAt, floorY }) {
  if (!target || typeof roomAt !== 'function' || typeof floorY !== 'function') return null;
  const targetY = Number.isFinite(Number(target.y)) ? Number(target.y) : 0;
  const targetRoom = roomAt(target.x, target.z, targetY);
  if (!targetRoom) return null;
  for (const candidate of candidates || []) {
    if (!candidate || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) continue;
    const y = floorY(candidate.x, candidate.z, targetY);
    const room = roomAt(candidate.x, candidate.z, y);
    if (room === targetRoom) return { x: candidate.x, z: candidate.z, y, room };
  }
  return null;
}

export function auditMapStructure({
  rooms = MAP_ROOMS,
  doors = MAP_DOOR_DEFS,
  walls = MAP_WALL_RUNS,
  wallbuys = MAP_WALLBUYS,
  perks = MAP_PERKS,
} = {}) {
  const issues = [];
  const roomIds = new Set(rooms.map((room) => room.id));
  const doorById = new Map(doors.map((door) => [door.id, door]));
  const wallById = new Map(walls.map((wall) => [wall.id, wall]));
  const seenWallIds = new Set();
  const doorOpenings = new Map();
  let windowCount = 0;
  let solidSegments = 0;

  const axisInfo = (wall) => {
    const horizontal = Math.abs(wall.z2 - wall.z1) < 0.001;
    const vertical = Math.abs(wall.x2 - wall.x1) < 0.001;
    const len = horizontal ? wall.x2 - wall.x1 : wall.z2 - wall.z1;
    return { horizontal, vertical, len };
  };
  const gapWorld = (wall, gap) => {
    const { horizontal } = axisInfo(wall);
    return horizontal
      ? { x: wall.x1 + gap.at, z: wall.z1, vert: false }
      : { x: wall.x1, z: wall.z1 + gap.at, vert: true };
  };
  const groundRoomAt = (x, z) => rooms.find((room) => (
    room.yMin === undefined
    && x >= room.rect.minX && x <= room.rect.maxX
    && z >= room.rect.minZ && z <= room.rect.maxZ
  ))?.id || null;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const gameplayProps = [
    ...wallbuys.map((item) => ({ ...item, label: `wallbuy ${item.weapon}`, clearance: 0.9 })),
    ...perks.map((item) => ({ ...item, label: `perk ${item.id}`, clearance: 1.05 })),
    ...doors.map((item) => ({ ...item, label: `door ${item.id}`, clearance: (item.w || 1.9) / 2 })),
  ];
  // Ground-level wall collider footprints, excluding their declared gaps.
  // These let CI validate both sides of every barricade without constructing a
  // Three.js scene.
  const solidFootprints = [];
  for (const wall of walls) {
    const { horizontal, vertical, len } = axisInfo(wall);
    if (horizontal === vertical || len <= 0 || (wall.y0 || 0) > 1.8) continue;
    const gaps = [...(wall.gaps || [])].sort((a, b) => a.at - b.at);
    let cursor = 0;
    const addSolid = (start, end) => {
      if (end - start < 0.01) return;
      solidFootprints.push(horizontal
        ? { minX: wall.x1 + start, maxX: wall.x1 + end, minZ: wall.z1 - 0.2, maxZ: wall.z1 + 0.2, wallId: wall.id }
        : { minX: wall.x1 - 0.2, maxX: wall.x1 + 0.2, minZ: wall.z1 + start, maxZ: wall.z1 + end, wallId: wall.id });
    };
    for (const gap of gaps) {
      addSolid(cursor, gap.at - gap.w / 2);
      cursor = gap.at + gap.w / 2;
    }
    addSolid(cursor, len);
  }
  const clearOfWallColliders = (point, radius = 0.42) => solidFootprints.every((box) => {
    const nearestX = Math.max(box.minX, Math.min(point.x, box.maxX));
    const nearestZ = Math.max(box.minZ, Math.min(point.z, box.maxZ));
    return Math.hypot(point.x - nearestX, point.z - nearestZ) >= radius;
  });

  for (const wall of walls) {
    if (!wall.id || seenWallIds.has(wall.id)) issues.push(`wall id ${wall.id || '(missing)'} must be unique`);
    seenWallIds.add(wall.id);
    const { horizontal, vertical, len } = axisInfo(wall);
    if (horizontal === vertical || len <= 0) {
      issues.push(`wall ${wall.id} must be a positive axis-aligned run`);
      continue;
    }
    const gaps = [...(wall.gaps || [])].sort((a, b) => a.at - b.at);
    let cursor = 0;
    for (const gap of gaps) {
      const start = gap.at - gap.w / 2;
      const end = gap.at + gap.w / 2;
      if (start < -1e-6 || end > len + 1e-6) issues.push(`gap on ${wall.id} extends beyond its wall`);
      if (start < cursor - 1e-6) issues.push(`gaps overlap on ${wall.id}`);
      if (start > cursor + 0.01) solidSegments++;
      cursor = end;
      if (gap.kind === 'window') {
        windowCount++;
        if (!roomIds.has(gap.room)) issues.push(`window on ${wall.id} references unknown room ${gap.room}`);
        if (gap.in !== -1 && gap.in !== 1) issues.push(`window on ${wall.id} needs an explicit ±1 inward normal`);
        if ((wall.y0 || 0) !== 0) issues.push(`window on ${wall.id} is elevated; zombie barrier logic is ground-level only`);
        const world = gapWorld(wall, gap);
        const inward = axisInfo(wall).horizontal ? { x: 0, z: gap.in } : { x: gap.in, z: 0 };
        const rebuild = { x: world.x + inward.x * 1.25, z: world.z + inward.z * 1.25 };
        const approach = { x: world.x - inward.x * 1.5, z: world.z - inward.z * 1.5 };
        if (groundRoomAt(rebuild.x, rebuild.z) !== gap.room) {
          issues.push(`window on ${wall.id} has no unobstructed rebuild zone inside ${gap.room}`);
        }
        if (!clearOfWallColliders(rebuild)) {
          issues.push(`window on ${wall.id} rebuild zone overlaps a wall collider`);
        }
        if (!clearOfWallColliders(approach)) {
          issues.push(`window on ${wall.id} zombie approach overlaps a wall collider`);
        }
        if (distance(world, approach) < 1.4 || gap.w < 1.4) {
          issues.push(`window on ${wall.id} has no visible zombie approach opening`);
        }
        for (const prop of gameplayProps) {
          if (distance(world, prop) < prop.clearance + gap.w / 2 + 0.2) {
            issues.push(`window on ${wall.id} overlaps ${prop.label}`);
          }
          if (distance(rebuild, prop) < prop.clearance + 0.55) {
            issues.push(`window on ${wall.id} rebuild zone is obstructed by ${prop.label}`);
          }
          if (distance(approach, prop) < prop.clearance + 0.55) {
            issues.push(`window on ${wall.id} zombie approach is obstructed by ${prop.label}`);
          }
        }
      } else if (gap.kind === 'door') {
        if (!doorById.has(gap.doorId)) issues.push(`door gap on ${wall.id} references unknown ${gap.doorId}`);
        if (!doorOpenings.has(gap.doorId)) doorOpenings.set(gap.doorId, []);
        doorOpenings.get(gap.doorId).push({ wall, gap, world: gapWorld(wall, gap) });
      } else if (gap.kind !== 'passage') {
        issues.push(`gap on ${wall.id} has unsupported kind ${gap.kind}`);
      }
    }
    if (cursor < len - 0.01) solidSegments++;
  }

  for (const door of doors) {
    const openings = doorOpenings.get(door.id) || [];
    if (openings.length !== 1) {
      issues.push(`door ${door.id} must occupy exactly one wall opening; found ${openings.length}`);
      continue;
    }
    const { wall, gap, world } = openings[0];
    if (Math.abs(world.x - door.x) > 0.01 || Math.abs(world.z - door.z) > 0.01) {
      issues.push(`door ${door.id} does not align with its wall opening`);
    }
    if (Boolean(door.vert) !== world.vert) issues.push(`door ${door.id} orientation does not match ${wall.id}`);
    if (Math.abs((door.y || 0) - (wall.y0 || 0)) > 0.01) issues.push(`door ${door.id} elevation does not match ${wall.id}`);
    if (Math.abs((door.w || 1.9) - gap.w) > 0.01) issues.push(`door ${door.id} width does not match ${wall.id}`);
    if (!Number.isFinite(door.cost) || door.cost < 0) issues.push(`door ${door.id} must have a direct finite interaction cost`);
    if (door.visibilityTreatment !== 'framed-lit-cost') {
      issues.push(`door ${door.id} must use the framed-lit-cost visibility treatment`);
    }
  }

  for (const wb of wallbuys) {
    const wall = wallById.get(wb.wallId);
    if (!wall) { issues.push(`wallbuy ${wb.weapon} references unknown wall ${wb.wallId}`); continue; }
    const { horizontal, len } = axisInfo(wall);
    const wallCoord = horizontal ? wall.z1 : wall.x1;
    const buyCoord = horizontal ? wb.z : wb.x;
    const along = horizontal ? wb.x - wall.x1 : wb.z - wall.z1;
    if (Math.abs(wallCoord - buyCoord) > 0.3 || along < 0 || along > len) {
      issues.push(`wallbuy ${wb.weapon} is not mounted on ${wall.id}`);
      continue;
    }
    if (Math.abs((wb.y || 0) - (wall.y0 || 0)) > 0.01) {
      issues.push(`wallbuy ${wb.weapon} elevation does not match ${wall.id}`);
    }
    const overlappingGap = (wall.gaps || []).find((gap) => Math.abs(gap.at - along) < gap.w / 2 + 0.76);
    if (overlappingGap) issues.push(`wallbuy ${wb.weapon} overlaps a ${overlappingGap.kind} on ${wall.id}`);
  }

  return {
    ok: issues.length === 0,
    issues,
    wallsChecked: walls.length,
    doorsChecked: doors.length,
    windowsChecked: windowCount,
    solidSegments,
  };
}

export function auditMapEgress({ rooms = MAP_ROOMS, doors = MAP_DOOR_DEFS, navLinks = MAP_NAV_LINKS, ramps = MAP_RAMPS } = {}) {
  const issues = [];
  const roomIds = new Set(rooms.map((room) => room.id));
  const rampIds = new Set(ramps.map((ramp) => ramp.id));
  const outgoing = new Map([...roomIds].map((id) => [id, []]));
  const incoming = new Map([...roomIds].map((id) => [id, []]));

  const addEdge = (from, to, edge) => {
    if (!roomIds.has(from) || !roomIds.has(to)) {
      issues.push(`route ${edge.id || edge.route || `${from}->${to}`} references an unknown room`);
      return;
    }
    outgoing.get(from).push({ to, ...edge });
    incoming.get(to).push({ from, ...edge });
  };

  for (const door of doors) {
    if (!door.rooms || door.rooms.length !== 2) {
      issues.push(`door ${door.id} must join exactly two rooms`);
      continue;
    }
    addEdge(door.rooms[0], door.rooms[1], { id: door.id, kind: 'door' });
    addEdge(door.rooms[1], door.rooms[0], { id: door.id, kind: 'door' });
  }
  for (const link of navLinks) {
    addEdge(link.from, link.to, { ...link, kind: link.drop ? 'drop' : 'route' });
    if (link.stair && (!link.route || !rampIds.has(link.route))) {
      issues.push(`stair ${link.from}->${link.to} has no matching physical ramp`);
    }
  }

  for (const room of rooms) {
    const outs = outgoing.get(room.id) || [];
    const ins = incoming.get(room.id) || [];
    if (!outs.length) issues.push(`${room.id} has no exit`);
    if (!ins.length) issues.push(`${room.id} has no entrance`);
    if (room.minExits) {
      const distinct = new Set(outs.map((edge) => edge.route || edge.id || edge.to));
      if (distinct.size < room.minExits) issues.push(`${room.id} needs ${room.minExits} independent exits; found ${distinct.size}`);
    }
  }

  // With progression doors open, every playable room must be able to return to
  // Mainframe. This catches one-way drops and isolated additions before runtime.
  for (const start of roomIds) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift();
      for (const edge of outgoing.get(current) || []) {
        if (!seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to); }
      }
    }
    if (!seen.has('mainframe')) issues.push(`${start} cannot return to mainframe`);
  }

  // Every stair is physically bidirectional; require matching route data too.
  for (const link of navLinks.filter((entry) => entry.stair)) {
    const reverse = navLinks.some((entry) => entry.stair && entry.from === link.to && entry.to === link.from && entry.route === link.route);
    if (!reverse) issues.push(`stair ${link.route} is missing ${link.to}->${link.from}`);
  }

  return { ok: issues.length === 0, issues, roomsChecked: rooms.length };
}

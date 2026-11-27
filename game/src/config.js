// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// The turkey runs left to right through three stages — the farmyard, the barn and the
// kitchen — and the farmer chases from behind. Distance is measured in metres; the run ends
// at ESCAPE_DISTANCE, the back gate of the kitchen, where the turkey gets away.

export const FIELD = { width: 1280, height: 720, groundY: 620 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Metres of run to reach the back gate and escape. */
export const ESCAPE_DISTANCE = 1800;

export const PLAYER = {
  width: 64,
  height: 56,
  /** Base run speed in pixels per second; stages and dash add to it. */
  speed: 330,
  /** Pixels per second the turkey gains while holding right, loses while holding left. */
  nudge: 120,
  jumpVelocity: 950,
  gravity: 1900,
  /** How long a jump may be held for extra lift, in seconds. */
  jumpHold: 0.16,
  dashSpeed: 780,
  dashTime: 0.22,
  dashCooldown: 1.4,
  invulnerable: 1.6,
  /** Crouching halves the turkey's height and lets it slip under low things and hide. */
  crouchHeight: 30,
  /** Airborne the turkey tucks its legs, so its box is shorter while it jumps. */
  airHeight: 32,
};

export const FARMER = {
  width: 58,
  height: 96,
  /** How far behind the turkey, in metres, the farmer starts. */
  startGap: 26,
  /** Metres the farmer gains per second when the turkey is slowed or hit. */
  closeOnHit: 5,
  closeOnStumble: 4,
  /** Metres the farmer falls back when he gives up a search. */
  searchGiveUp: 9,
  /** Metres the farmer closes per second while charging after spotting the turkey. */
  chargeRate: 11,
  /** Seconds he searches a hiding place before giving up. */
  searchTime: 2.2,
  /** Seconds between thrown knives, shorter in later stages. */
  throwInterval: [4.2, 3.4, 2.8],
};

export const LIVES = 3;

export const STAGES = [
  {
    name: 'The Farmyard',
    from: 0,
    to: 600,
    speedBonus: 0,
    spawnInterval: 1.4,
    knifeInterval: 3.2,
    coverChance: 0.5,
  },
  {
    name: 'The Barn',
    from: 600,
    to: 1200,
    speedBonus: 45,
    spawnInterval: 1.3,
    knifeInterval: 2.6,
    coverChance: 0.45,
  },
  {
    name: 'The Kitchen',
    from: 1200,
    to: ESCAPE_DISTANCE,
    speedBonus: 90,
    spawnInterval: 1.2,
    knifeInterval: 2.2,
    coverChance: 0.35,
  },
];

/** Obstacle kinds. */
export const OB_FENCE = 0;
export const OB_BALE = 1;
export const OB_MUD = 2;
export const OB_PUMPKIN = 3;
export const OB_OVEN = 4;
export const OB_KNIFE_FALL = 5;
export const OB_KNIFE_THROW = 6;
export const OB_COVER = 7;

export const OBSTACLE = {
  fence: { width: 46, height: 58 },
  bale: { width: 78, height: 62 },
  mud: { width: 130, height: 14 },
  pumpkin: { width: 52, height: 48, rollSpeed: 260 },
  oven: { width: 150, height: 120 },
  knifeFall: { width: 34, height: 64, fallSpeed: 520 },
  knifeThrow: { width: 56, height: 20, speed: 640 },
  cover: { width: 110, height: 84 },
};

export const CORN = { size: 26, points: 10, goldenPoints: 25, goldenChance: 0.12 };
export const NEAR_MISS_POINTS = 5;

/** How many obstacles and pickups can exist at once; the pools are allocated once, at boot. */
export const POOL_OBSTACLES = 40;
export const POOL_CORN = 24;

/** The autumn palette: golden fields, barn red, kitchen cream and oven glow. */
export const PALETTE = {
  backdrop: '#2b1d12',
  farmSky: '#f2a65a',
  farmSkyTop: '#e07b39',
  farmGround: '#b98a3e',
  farmGrass: '#8a6d2f',
  barnSky: '#7a4a28',
  barnSkyTop: '#4a2c1a',
  barnGround: '#5d3a22',
  barnWood: '#6e4526',
  kitchenSky: '#e8d9b0',
  kitchenSkyTop: '#d9b98a',
  kitchenGround: '#c9a86a',
  kitchenTile: '#f2e6c8',
  oven: '#8c2f26',
  ovenGlow: '#ff7a2f',
  ovenDoor: '#3a3a3a',
  turkey: '#8a5230',
  turkeyDark: '#6e3f22',
  tail: ['#a0522d', '#d2691e', '#e8a33c', '#c94f32'],
  head: '#f2e6d0',
  wattle: '#e5534b',
  beak: '#f2b234',
  farmerShirt: '#4a6b8a',
  farmerOveralls: '#3d5a73',
  farmerSkin: '#e8b98a',
  farmerHat: '#c9a227',
  knife: '#d7dce2',
  knifeHandle: '#5a3a22',
  corn: '#f2c94c',
  cornHusk: '#7a9a4a',
  pumpkin: '#e07b2a',
  mud: '#6b4a2f',
  coverHay: '#d9a94f',
  coverBush: '#5d7a3a',
  panel: '#2b1d12',
  panelEdge: '#e8a33c',
  text: '#fff3dd',
  muted: '#e8c98a',
  danger: '#ff5a3c',
  good: '#8fd14f',
  hudBack: 'rgba(43, 29, 18, 0.55)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'turkey-run.best';

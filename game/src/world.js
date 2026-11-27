// The game's rules and state, with no drawing and no browser in it: the turkey, the
// farmer's chase, the obstacles and corn, the three stages, the score, lives and
// distance. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react without the world knowing about screens or sound. Nothing here
// allocates after createWorld returns.

import {
  CORN,
  ESCAPE_DISTANCE,
  FARMER,
  FIELD,
  LIVES,
  NEAR_MISS_POINTS,
  OB_BALE,
  OB_COVER,
  OB_FENCE,
  OB_KNIFE_FALL,
  OB_KNIFE_THROW,
  OB_MUD,
  OB_OVEN,
  OB_PUMPKIN,
  OBSTACLE,
  PLAYER,
  POOL_CORN,
  POOL_OBSTACLES,
  STAGES,
  STEP,
} from './config.js';
import { createFarmer, PX_PER_M } from './farmer.js';

export const EVENT_HIT = 1;
export const EVENT_CORN = 2;
export const EVENT_OVER = 4;
export const EVENT_ESCAPE = 8;
export const EVENT_SPOT = 16;
export const EVENT_HIDE = 32;
export const EVENT_DASH = 64;
export const EVENT_NEAR_MISS = 128;

const FARMER_EVENTS = { SPOT: EVENT_SPOT, HIDE: EVENT_HIDE };

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The turkey's box, in screen pixels: x is the left edge, y the feet. */
function turkeyBox(turkey) {
  const height = turkey.crouching
    ? PLAYER.crouchHeight
    : (turkey.onGround ? PLAYER.height : PLAYER.airHeight);
  return { x: turkey.x, y: turkey.y - height, width: PLAYER.width, height };
}

export function createWorld(random) {
  const turkey = {
    x: 340,
    y: FIELD.groundY,
    vy: 0,
    onGround: true,
    crouching: false,
    dashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    invulnerable: 0,
    runPhase: 0,
    hidden: false,
    stumbleTimer: 0,
    jumpHoldTimer: 0,
  };
  const obstacles = [];
  for (let i = 0; i < POOL_OBSTACLES; i += 1) {
    obstacles.push({
      active: false, kind: OB_FENCE, x: 0, y: 0, width: 0, height: 0,
      speed: 0, telegraph: 0, targetX: 0, flameTimer: 0, flameActive: 0, stuck: 0, passed: false,
    });
  }
  const corns = [];
  for (let i = 0; i < POOL_CORN; i += 1) {
    corns.push({ active: false, x: 0, y: 0, golden: false });
  }
  const { farmer, reset: resetFarmer, update: updateFarmer, speed: farmerSpeed, screenX: farmerScreenX } = createFarmer(random);
  const state = {
    turkey, obstacles, corns, farmer,
    score: 0, lives: LIVES, distance: 0, stage: 0, elapsed: 0,
    spawnTimer: 0, knifeTimer: 0, cornTimer: 0, inMud: false, lastCornGolden: false,
    lastHitKind: -1, lastHitDistance: 0,
    lastHitCrouching: false, lastHitOnGround: true, lastHitFeet: 0,
  };

  function stageIndex(distance) {
    for (let i = STAGES.length - 1; i >= 0; i -= 1) {
      if (distance >= STAGES[i].from) return i;
    }
    return 0;
  }

  function reset() {
    turkey.x = 340;
    turkey.y = FIELD.groundY;
    turkey.vy = 0;
    turkey.onGround = true;
    turkey.crouching = false;
    turkey.dashing = false;
    turkey.dashTimer = 0;
    turkey.dashCooldown = 0;
    turkey.invulnerable = 0;
    turkey.runPhase = 0;
    turkey.hidden = false;
    turkey.stumbleTimer = 0;
    turkey.jumpHoldTimer = 0;
    for (const o of obstacles) o.active = false;
    for (const c of corns) c.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.distance = 0;
    state.stage = 0;
    state.elapsed = 0;
    state.spawnTimer = 0.8;
    state.knifeTimer = 2.2;
    state.cornTimer = 1.6;
    state.inMud = false;
    resetFarmer();
  }

  function freeObstacle() {
    for (let i = 0; i < obstacles.length; i += 1) if (!obstacles[i].active) return obstacles[i];
    return null;
  }

  function freeCorn() {
    for (let i = 0; i < corns.length; i += 1) if (!corns[i].active) return corns[i];
    return null;
  }

  function spawnObstacle() {
    // While a thrown knife is in flight the path stays clear of ground obstacles, so
    // the turkey's only job is to duck the blade — a knife and a fence at the same
    // moment would be an unfair pair.
    for (const active of obstacles) {
      if (active.active && active.kind === OB_KNIFE_THROW) return;
    }
    const stage = STAGES[state.stage];
    const o = freeObstacle();
    if (o === null) return;
    const roll = random();
    const x = FIELD.width + 60;
    o.active = true;
    o.passed = false;
    o.telegraph = 0;
    o.flameTimer = 1.6 + random() * 1.2;
    o.flameActive = 0;
    if (roll < 0.16) {
      // A cover to hide behind: a haystack in the farmyard, a bush, a table in the kitchen.
      o.kind = OB_COVER;
      o.width = OBSTACLE.cover.width;
      o.height = OBSTACLE.cover.height;
      o.x = x;
      o.y = FIELD.groundY - o.height;
      o.speed = 0;
    } else if (state.stage === 2 && roll < 0.42) {
      o.kind = OB_OVEN;
      o.width = 90;
      o.height = 90;
      o.x = x;
      o.y = FIELD.groundY - o.height;
      o.speed = 0;
    } else if (state.stage >= 1 && roll < 0.58) {
      o.kind = OB_PUMPKIN;
      o.width = OBSTACLE.pumpkin.width;
      o.height = OBSTACLE.pumpkin.height;
      o.x = x;
      o.y = FIELD.groundY - o.height;
      o.speed = OBSTACLE.pumpkin.rollSpeed;
    } else if (roll < 0.74) {
      o.kind = OB_MUD;
      o.width = OBSTACLE.mud.width;
      o.height = OBSTACLE.mud.height;
      o.x = x;
      o.y = FIELD.groundY - o.height;
      o.speed = 0;
    } else if (roll < 0.88) {
      o.kind = OB_BALE;
      o.width = OBSTACLE.bale.width;
      o.height = OBSTACLE.bale.height;
      o.x = x;
      o.y = FIELD.groundY - o.height;
      o.speed = 0;
    } else {
      o.kind = OB_FENCE;
      o.width = OBSTACLE.fence.width;
      o.height = OBSTACLE.fence.height;
      o.x = x;
      o.y = FIELD.groundY - o.height;
      o.speed = 0;
    }
    // A corn arc over the taller obstacles, so jumping pays.
    if (o.kind === OB_FENCE || o.kind === OB_BALE || o.kind === OB_OVEN) {
      spawnCornArc(o.x + o.width / 2, o.y - 90);
    }
  }

  function spawnCornArc(cx, topY) {
    for (let i = -1; i <= 1; i += 1) {
      const c = freeCorn();
      if (c === null) return;
      c.active = true;
      c.x = cx + i * 52;
      c.y = topY + Math.abs(i) * 34;
      c.golden = random() < CORN.goldenChance;
    }
  }

  function spawnCorn() {
    const c = freeCorn();
    if (c === null) return;
    c.active = true;
    c.x = FIELD.width + 60;
    c.y = FIELD.groundY - 60 - random() * 120;
    c.golden = random() < CORN.goldenChance;
  }

  function spawnFallingKnife() {
    const o = freeObstacle();
    if (o === null) return;
    o.active = true;
    o.kind = OB_KNIFE_FALL;
    o.width = OBSTACLE.knifeFall.width;
    o.height = OBSTACLE.knifeFall.height;
    // It falls where the turkey will be: ahead of the turkey, with a telegraph first.
    o.targetX = turkey.x + 60 + random() * 260;
    o.x = o.targetX;
    o.y = -o.height;
    o.speed = OBSTACLE.knifeFall.fallSpeed;
    o.telegraph = 0.6;
    o.stuck = 0;
    o.passed = false;
  }

  function spawnThrownKnife() {
    const o = freeObstacle();
    if (o === null) return;
    o.active = true;
    o.kind = OB_KNIFE_THROW;
    o.width = OBSTACLE.knifeThrow.width;
    o.height = OBSTACLE.knifeThrow.height;
    o.x = farmerScreenX(turkey.x) + 30;
    // It flies at chest height: a crouching turkey (30 px tall) ducks under it, and a
    // jumping turkey clears it once its feet are above the blade.
    o.y = FIELD.groundY - 55;
    o.speed = OBSTACLE.knifeThrow.speed;
    o.passed = false;
  }

  function scrollSpeed() {
    const stage = STAGES[state.stage];
    if (turkey.hidden) return 0;
    if (turkey.dashing) return PLAYER.dashSpeed;
    let speed = PLAYER.speed + stage.speedBonus;
    if (state.inMud) speed *= 0.55;
    if (turkey.stumbleTimer > 0) speed *= 0.6;
    return speed;
  }

  /**
   * One fixed step. `controls` is { steer, crouch, jump, dash, jumpHeld } from the input.
   * With `harmless` set (the title screen's backdrop) things move but nothing touches the
   * player and nothing scores.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    const stage = STAGES[state.stage];
    state.elapsed += dt;
    state.stage = stageIndex(state.distance);

    // The turkey's own motion.
    turkey.x = Math.min(600, Math.max(160, turkey.x + controls.steer * PLAYER.nudge * dt));
    turkey.crouching = controls.crouch && turkey.onGround;
    if (controls.dash && turkey.dashCooldown <= 0 && !turkey.dashing && !harmless) {
      turkey.dashing = true;
      turkey.dashTimer = PLAYER.dashTime;
      turkey.dashCooldown = PLAYER.dashCooldown;
      farmer.gap += 2.5;
      events |= EVENT_DASH;
    }
    if (turkey.dashing) {
      turkey.dashTimer -= dt;
      if (turkey.dashTimer <= 0) turkey.dashing = false;
    }
    if (turkey.dashCooldown > 0) turkey.dashCooldown -= dt;
    if (controls.jump && turkey.onGround && !harmless) {
      turkey.vy = -PLAYER.jumpVelocity;
      turkey.onGround = false;
      turkey.jumpHoldTimer = PLAYER.jumpHold;
    }
    if (!turkey.onGround) {
      const gravity = (controls.jumpHeld && turkey.jumpHoldTimer > 0) ? PLAYER.gravity * 0.55 : PLAYER.gravity;
      turkey.vy += gravity * dt;
      turkey.y += turkey.vy * dt;
      if (turkey.jumpHoldTimer > 0) turkey.jumpHoldTimer -= dt;
      if (turkey.y >= FIELD.groundY) {
        turkey.y = FIELD.groundY;
        turkey.vy = 0;
        turkey.onGround = true;
      }
    }
    if (turkey.invulnerable > 0) turkey.invulnerable = Math.max(0, turkey.invulnerable - dt);
    if (turkey.stumbleTimer > 0) turkey.stumbleTimer -= dt;
    turkey.runPhase += dt * 10;

    const speed = harmless ? 130 : scrollSpeed();

    // Hidden means crouching behind a cover object.
    turkey.hidden = false;
    if (!harmless && turkey.crouching) {
      const box = turkeyBox(turkey);
      for (const o of obstacles) {
        if (o.active && o.kind === OB_COVER && overlaps(box, o)) {
          turkey.hidden = true;
          break;
        }
      }
    }

    // Spawning runs in harmless mode too, so the title screen has a living backdrop.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnObstacle();
      state.spawnTimer = stage.spawnInterval * (0.85 + random() * 0.3);
    }
    state.knifeTimer -= dt;
    if (state.knifeTimer <= 0) {
      spawnFallingKnife();
      state.knifeTimer = stage.knifeInterval * (0.85 + random() * 0.3);
    }
    state.cornTimer -= dt;
    if (state.cornTimer <= 0) {
      spawnCorn();
      state.cornTimer = 1.4 + random() * 1.2;
    }

    // The farmer's chase, search and charge.
    if (!harmless) {
      const farmerEvents = updateFarmer(dt, {
        turkeyHidden: turkey.hidden,
        stage: state.stage,
        throwKnife: spawnThrownKnife,
      }, FARMER_EVENTS);
      events |= farmerEvents;
      farmer.gap += (speed - farmerSpeed(speed)) * dt / PX_PER_M;
      farmer.gap = Math.min(40, farmer.gap);
      if (farmer.gap <= 0) {
        farmer.gap = 0;
        events |= EVENT_OVER;
        return events;
      }
    }

    // Distance and score.
    if (!harmless) {
      state.distance += speed * dt / PX_PER_M;
      state.score += speed * dt / PX_PER_M;
      if (state.distance >= ESCAPE_DISTANCE) {
        events |= EVENT_ESCAPE;
        return events;
      }
    }

    // Move the obstacles and the corn, and resolve what touches the turkey.
    const box = turkeyBox(turkey);
    state.inMud = false;
    function hit() {
      state.lives -= 1;
      turkey.invulnerable = PLAYER.invulnerable;
      turkey.stumbleTimer = 0.8;
      farmer.gap -= FARMER.closeOnHit;
      if (farmer.gap <= 0) farmer.gap = 0;
      if (state.lives <= 0) return EVENT_HIT | EVENT_OVER;
      return EVENT_HIT;
    }
    for (const o of obstacles) {
      if (!o.active) continue;
      if (o.kind === OB_KNIFE_FALL) {
        if (o.telegraph > 0) {
          o.telegraph -= dt;
        } else if (o.stuck > 0) {
          // It sticks in the ground for a moment, then is gone.
          o.stuck -= dt;
          if (o.stuck <= 0) o.active = false;
        } else {
          o.y += o.speed * dt;
          if (o.y >= FIELD.groundY - o.height) {
            o.y = FIELD.groundY - o.height;
            o.stuck = 0.6;
          }
        }
      } else if (o.kind === OB_KNIFE_THROW) {
        o.x += (o.speed - speed) * dt;
        if (o.x > FIELD.width + 120) o.active = false;
      } else if (o.kind === OB_PUMPKIN) {
        o.x -= (speed + o.speed) * dt;
        if (o.x + o.width < -80) o.active = false;
      } else {
        o.x -= speed * dt;
        if (o.x + o.width < -80) o.active = false;
      }
      // The oven's flame: a burst of heat from the door, on a timer; while it is on,
      // the column in front of the oven burns.
      if (o.kind === OB_OVEN && o.active) {
        o.flameTimer -= dt;
        if (o.flameTimer <= 0) {
          if (o.flameActive > 0) {
            o.flameActive = 0;
            o.flameTimer = 2.2 + random() * 1.2;
          } else {
            o.flameActive = 1;
            o.flameTimer = 0.8;
          }
        }
      }
      if (harmless || !o.active) continue;
      // A knife that slips past the turkey's beak is a near miss.
      if (!o.passed && (o.kind === OB_KNIFE_FALL || o.kind === OB_KNIFE_THROW) && o.x + o.width < box.x) {
        o.passed = true;
        const dy = Math.abs((o.y + o.height / 2) - (box.y + box.height / 2));
        if (dy < 90) {
          state.score += NEAR_MISS_POINTS;
          events |= EVENT_NEAR_MISS;
        }
      }
      if (o.kind === OB_MUD) {
        if (turkey.onGround && overlaps(box, o)) state.inMud = true;
        continue;
      }
      if (o.kind === OB_COVER) continue;
      if (o.kind === OB_OVEN && o.flameActive > 0) {
        const flame = { x: o.x - 46, y: FIELD.groundY - 90, width: 46, height: 90 };
        if (turkey.invulnerable === 0 && overlaps(box, flame)) {
          o.active = false;
          state.lastHitKind = OB_OVEN;
          state.lastHitDistance = state.distance;
          events |= hit();
          if (events & EVENT_OVER) return events;
          continue;
        }
      }
      if (turkey.invulnerable === 0 && overlaps(box, o)) {
        o.active = false;
        state.lastHitKind = o.kind;
        state.lastHitDistance = state.distance;
        state.lastHitCrouching = turkey.crouching;
        state.lastHitOnGround = turkey.onGround;
        state.lastHitFeet = FIELD.groundY - turkey.y;
        events |= hit();
        if (events & EVENT_OVER) return events;
      }
    }
    for (const c of corns) {
      if (!c.active) continue;
      c.x -= speed * dt;
      if (c.x < -40) {
        c.active = false;
        continue;
      }
      if (!harmless && overlaps(box, { x: c.x - 13, y: c.y - 13, width: 26, height: 26 })) {
        c.active = false;
        state.lastCornGolden = c.golden;
        state.score += c.golden ? CORN.goldenPoints : CORN.points;
        events |= EVENT_CORN;
      }
    }
    return events;
  }

  /** The nearest obstacle ahead of the turkey, for the autopilot in shots.js. */
  function nextObstacle() {
    let best = null;
    for (const o of obstacles) {
      if (!o.active || o.kind === OB_COVER) continue;
      if (o.x + o.width < turkey.x) continue;
      if (best === null || o.x < best.x) best = o;
    }
    return best;
  }

  /** The nearest cover the turkey could hide behind, for the autopilot. */
  function nextCover() {
    let best = null;
    for (const o of obstacles) {
      if (!o.active || o.kind !== OB_COVER) continue;
      if (o.x + o.width < turkey.x) continue;
      if (best === null || o.x < best.x) best = o;
    }
    return best;
  }

  reset();
  return { state, reset, step, nextObstacle, nextCover, farmerScreenX };
}

// The farmer: he chases the turkey from behind, throws carving knives, searches a
// hiding place when the turkey slips behind cover, and charges when he spots it. His
// distance behind the turkey is the gap, in metres; when it reaches zero he catches the
// turkey. He never touches the world directly: the world passes him what he needs and
// he answers with his speed and his state, so the gap math stays in one place.

import { FARMER, PLAYER } from './config.js';

export const FARMER_CHASE = 'chase';
export const FARMER_SEARCH = 'search';
export const FARMER_CHARGE = 'charge';

/** Pixels per metre, for turning the gap into a screen position. */
export const PX_PER_M = 14;

export function createFarmer(random) {
  const farmer = {
    mode: FARMER_CHASE,
    gap: FARMER.startGap,
    searchTimer: 0,
    chargeTimer: 0,
    throwTimer: FARMER.throwInterval[0],
    runPhase: 0,
    /** True while the farmer is looking toward the turkey (searching). */
    looking: false,
  };

  function reset() {
    farmer.mode = FARMER_CHASE;
    farmer.gap = FARMER.startGap;
    farmer.searchTimer = 0;
    farmer.chargeTimer = 0;
    farmer.throwTimer = FARMER.throwInterval[0];
    farmer.runPhase = 0;
    farmer.looking = false;
  }

  /**
   * One fixed step. `view` is what the farmer can see: the turkey's hidden state, the
   * stage index, the scroll speed in pixels per second, and a hook to throw a knife.
   * Returns bit flags (see world.js) for what happened.
   */
  function update(dt, view, events) {
    farmer.runPhase += dt * 9;
    if (farmer.mode === FARMER_SEARCH) {
      farmer.searchTimer -= dt;
      // He looks left, then right, then left again while he searches.
      farmer.looking = Math.floor(farmer.searchTimer * 2) % 2 === 0;
      if (!view.turkeyHidden) {
        // The turkey moved out of cover while he was looking: spotted.
        farmer.mode = FARMER_CHARGE;
        farmer.chargeTimer = 1.2;
        farmer.looking = true;
        return events.SPOT;
      }
      if (farmer.searchTimer <= 0) {
        // He gives up and falls back, muttering.
        farmer.gap += FARMER.searchGiveUp;
        farmer.mode = FARMER_CHASE;
        farmer.throwTimer = Math.max(farmer.throwTimer, 1.2);
        farmer.looking = false;
      }
      return 0;
    }
    if (farmer.mode === FARMER_CHARGE) {
      farmer.chargeTimer -= dt;
      if (farmer.chargeTimer <= 0) {
        farmer.mode = FARMER_CHASE;
        farmer.throwTimer = Math.max(farmer.throwTimer, 0.8);
      }
      return 0;
    }
    // Chase: throw a knife on his timer, and start searching when the turkey hides close by.
    farmer.throwTimer -= dt;
    if (farmer.throwTimer <= 0) {
      farmer.throwTimer = FARMER.throwInterval[view.stage] * (0.85 + random() * 0.3);
      view.throwKnife();
    }
    if (view.turkeyHidden && farmer.gap < 14) {
      farmer.mode = FARMER_SEARCH;
      farmer.searchTimer = FARMER.searchTime;
      farmer.looking = true;
      return events.HIDE;
    }
    return 0;
  }

  /** The farmer's speed in pixels per second, for the gap math in world.js. */
  function speed(scrollSpeed) {
    if (farmer.mode === FARMER_SEARCH) return 0;
    if (farmer.mode === FARMER_CHARGE) return scrollSpeed + FARMER.chargeRate * PX_PER_M;
    return scrollSpeed - 7;
  }

  /** The farmer's screen x, from the turkey's x and the gap. */
  function screenX(turkeyX) {
    return turkeyX - farmer.gap * PX_PER_M;
  }

  return { farmer, reset, update, speed, screenX };
}

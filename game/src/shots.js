// The screenshot scenes behind ?shot=start|play|end|kitchen. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (jump the obstacles, duck the thrown knives, step away from a falling
// knife's mark, dash when the farmer is close, hide when he is near cover), so the
// frame is what a short game really looks like and the same seed always gives the same
// frame. The play and kitchen pilots are good and survive; the end pilot jumps late and
// never dashes or hides, so it is caught once the farmer closes in, as a hurried player
// is.

import { FIELD, OB_FENCE, OB_KNIFE_FALL, OB_KNIFE_THROW, OB_MUD, OB_OVEN, OB_PUMPKIN, OB_BALE, PLAYER, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_ESCAPED, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 22;
const KITCHEN_SECONDS = 10;
const END_LIMIT_SECONDS = 600;

/** How far ahead, in pixels, the autopilot reacts to an obstacle. */
const JUMP_AHEAD_GOOD = 180;
const JUMP_AHEAD_POOR = 110;

/** Steer the turkey for one step. `skill` is 'good' (play, kitchen) or 'poor' (end). */
export function autopilot(state, world, skill) {
  const turkey = state.turkey;
  const farmer = state.farmer;
  const controls = { steer: 0, crouch: false, jump: false, dash: false, jumpHeld: false };
  if (skill === 'good') {
    if (farmer.gap < 5 && turkey.dashCooldown <= 0) {
      // Only dash when the path ahead is clear, so the burst does not carry the
      // turkey into a fence.
      const ahead = world.nextObstacle();
      if (ahead === null || ahead.x - turkey.x > 380) controls.dash = true;
    }
    // Hide when the farmer is close and there is cover right here.
    const cover = world.nextCover();
    if (farmer.gap < 12 && cover && cover.x < turkey.x + 130 && cover.x + cover.width > turkey.x - 20) {
      controls.crouch = true;
      return controls;
    }
  }
  // Step away from a falling knife's mark.
  for (const o of state.obstacles) {
    if (!o.active || o.kind !== OB_KNIFE_FALL || o.telegraph <= 0) continue;
    const target = o.targetX + o.width / 2;
    const centre = turkey.x + PLAYER.width / 2;
    if (Math.abs(target - centre) < 95) {
      controls.steer = target > centre ? -1 : 1;
    }
  }
  // Jump the nearest ground obstacle. A rolling pumpkin comes at the turkey fast,
  // so it is jumped earlier than a fence.
  const obstacle = world.nextObstacle();
  const jumpAhead = skill === 'good' ? JUMP_AHEAD_GOOD : JUMP_AHEAD_POOR;
  if (obstacle !== null) {
    const dx = obstacle.x - turkey.x;
    const ahead = obstacle.kind === OB_PUMPKIN ? jumpAhead + 90 : jumpAhead;
    if (
      obstacle.kind === OB_OVEN || obstacle.kind === OB_FENCE || obstacle.kind === OB_BALE ||
      obstacle.kind === OB_PUMPKIN || obstacle.kind === OB_MUD
    ) {
      if (turkey.onGround && dx < ahead && dx > -10) {
        controls.jump = true;
        controls.jumpHeld = true;
      }
    }
  }
  // Duck under a thrown knife — but only when not already jumping over something, since
  // a jump dodges the low knife too. A thrown knife comes from behind (the farmer), so
  // duck while it is anywhere near, whether behind the turkey or just ahead of it.
  if (skill === 'good' && !controls.jump) {
    for (const o of state.obstacles) {
      if (!o.active || o.kind !== OB_KNIFE_THROW) continue;
      const dx = o.x - turkey.x;
      if (dx > -450 && dx < 200) {
        controls.crouch = true;
        break;
      }
    }
  }
  return controls;
}

/**
 * Set `world` to the named scene (start, play, end or kitchen; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'kitchen') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { steer: 0, crouch: false, jump: false, dash: false, jumpHeld: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'kitchen') {
    // Skip ahead to the kitchen, then let it populate with its own dangers.
    world.state.distance = 1200;
    world.state.spawnTimer = 0.2;
    world.state.knifeTimer = 0.5;
    for (let index = 0; index < KITCHEN_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state, world, 'good'), false);
      if (events & EVENT_OVER) break;
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.floor(world.state.score) };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const skill = name === 'end' ? 'poor' : 'good';
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world.state, world, skill), false);
    if (events & EVENT_OVER) break;
  }
  const over = world.state.lives === 0 || world.state.farmer.gap <= 0;
  if (name === 'end' && !over) {
    // The poor pilot survived the limit (it should not): run it on until it is caught.
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state, world, 'poor'), false);
      if (events & EVENT_OVER) break;
    }
  }
  const caught = world.state.lives === 0 || world.state.farmer.gap <= 0;
  return { screen: caught ? SCREEN_OVER : SCREEN_PLAY, best: Math.floor(world.state.score) };
}

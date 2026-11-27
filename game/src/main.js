// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, caught and escaped.
//
// ?seed=N fixes the run. ?shot=start|play|end|kitchen (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  EVENT_CORN, EVENT_DASH, EVENT_ESCAPE, EVENT_HIDE, EVENT_HIT, EVENT_NEAR_MISS,
  EVENT_OVER, EVENT_SPOT, createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_JUMP, ACTION_MUTE, ACTION_PAUSE, createInput,
} from './input.js';
import {
  SCREEN_ESCAPED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, true);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    audio.click();
    announce(`Playing. ${LIVES} lives. Run to the back gate!`);
  }

  function endGame(escaped) {
    screen = escaped ? SCREEN_ESCAPED : SCREEN_OVER;
    audio.stopMusic();
    if (escaped) audio.escaped();
    else audio.caught();
    if (world.state.score > best) {
      best = Math.floor(world.state.score);
      saveBest(best);
    }
    announce(escaped
      ? `Escaped! Score ${Math.floor(world.state.score)}. Best ${best}.`
      : `Caught for dinner. Score ${Math.floor(world.state.score)}. Best ${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_ESCAPED)) {
      startGame();
      // The press that started the game must not also make the turkey jump.
      return actions & ~(ACTION_JUMP | ACTION_DASH);
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { steer: 0, crouch: false, jump: false, dash: false, jumpHeld: false }, true);
      return;
    }
    const wasOnGround = world.state.turkey.onGround;
    const controls = {
      steer: input.steer(),
      crouch: input.crouching(),
      jump: Boolean(actions & ACTION_JUMP),
      dash: Boolean(actions & ACTION_DASH),
      jumpHeld: input.jumpHeld(),
    };
    if (controls.jump && wasOnGround) audio.jump();
    if (controls.dash) audio.dash();
    const events = world.step(STEP, controls, false);
    if (events & EVENT_CORN) audio.corn(world.state.lastCornGolden);
    if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 life left. The farmer is closing in!' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_SPOT) {
      audio.spot();
      announce('The farmer spotted you! Run!');
    }
    if (events & EVENT_HIDE) {
      audio.hide();
      announce('Hidden in the hay. Hold still…');
    }
    if (events & EVENT_NEAR_MISS) audio.nearMiss();
    if (events & EVENT_ESCAPE) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // The one-shot presses are taken once per frame and handed to both the screens and the world.
    const actions = handleActions(input.takeActions());
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting the farmer catch the turkey unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // The first pointer or key press unlocks the audio, since a browser will not play before one.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  announce('Turkey Run. Press Space or click to start. Jump with Space, hide with Down, dash with Shift.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

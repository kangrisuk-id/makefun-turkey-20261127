// Keyboard and pointer input. Held keys steer the turkey; one-shot presses (jump, dash,
// start or restart, pause, mute) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_JUMP = 4;
export const ACTION_DASH = 8;
export const ACTION_MUTE = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
const DASH = new Set(['ShiftLeft', 'ShiftRight', 'KeyX']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let left = false;
  let right = false;
  let down = false;
  let jumpHeld = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (DOWN.has(event.code)) down = true;
    else if (JUMP.has(event.code)) {
      jumpHeld = true;
      if (!event.repeat) actions |= ACTION_JUMP;
      // Space also starts and restarts, so it is a confirm too.
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (DOWN.has(event.code)) down = false;
    else if (JUMP.has(event.code)) jumpHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    down = false;
    jumpHeld = false;
  });
  target.addEventListener('pointerdown', (event) => {
    // A click on the canvas is a confirm (start, restart) and, while playing, a jump.
    actions |= ACTION_CONFIRM;
    actions |= ACTION_JUMP;
    event.preventDefault();
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    steer() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** True while the crouch/hide key is held. */
    crouching() {
      return down;
    },
    /** True while the jump key is held (for a higher jump while held). */
    jumpHeld() {
      return jumpHeld;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

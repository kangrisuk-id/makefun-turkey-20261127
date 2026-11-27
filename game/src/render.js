// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. The three stages each have their own autumn scene — the golden farmyard, the
// lamplit barn, the tiled kitchen — drawn in flat canvas shapes, with a parallax
// background that scrolls with the turkey's distance. Canvas text for the HUD and the
// panels. Text that holds a number is rebuilt only when the number changes, so a frame
// allocates nothing.

import {
  CORN,
  FIELD,
  FONT,
  LIVES,
  OB_BALE,
  OB_COVER,
  OB_FENCE,
  OB_KNIFE_FALL,
  OB_KNIFE_THROW,
  OB_MUD,
  OB_OVEN,
  OB_PUMPKIN,
  PALETTE,
  PLAYER,
} from './config.js';
import { FARMER_CHARGE, FARMER_SEARCH, PX_PER_M } from './farmer.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_ESCAPED = 'escaped';

/** The panel's width; its height grows with its lines. */
const PANEL = { width: 780, top: 150, line: 32, bottom: 76 };
const HEART = 22;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const distanceLabel = cachedLabel('');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const gapLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.arcTo(x + width, y, x + width, y + radius, radius);
    context.lineTo(x + width, y + height - radius);
    context.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    context.lineTo(x + radius, y + height);
    context.arcTo(x, y + height, x, y + height - radius, radius);
    context.lineTo(x, y + radius);
    context.arcTo(x, y, x + radius, y, radius);
    context.closePath();
  }

  // ----- The three stages' scenery -----

  function drawFarmyard(distance) {
    const sky = context.createLinearGradient(0, 0, 0, FIELD.groundY);
    sky.addColorStop(0, PALETTE.farmSkyTop);
    sky.addColorStop(1, PALETTE.farmSky);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.groundY);
    // The sun and a few drifting clouds.
    context.fillStyle = '#ffe9a8';
    context.beginPath();
    context.arc(1080, 110, 46, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 243, 221, 0.85)';
    const cloudX = 1280 - ((distance * 6) % 1400);
    for (let i = 0; i < 3; i += 1) {
      const cx = ((cloudX + i * 460) % 1400) - 60;
      context.beginPath();
      context.ellipse(cx, 90 + i * 42, 70, 22, 0, 0, Math.PI * 2);
      context.fill();
    }
    // The red barn, far away, scrolling slowly.
    const barnX = 1280 - ((distance * 4) % 1500) - 160;
    context.fillStyle = '#a83c2a';
    context.fillRect(barnX, 380, 220, 180);
    context.fillStyle = '#7e2a1e';
    context.beginPath();
    context.moveTo(barnX - 12, 380);
    context.lineTo(barnX + 110, 300);
    context.lineTo(barnX + 232, 380);
    context.closePath();
    context.fill();
    context.fillStyle = '#f2e6c8';
    context.fillRect(barnX + 92, 440, 36, 60);
    // A fence line, closer, scrolling faster.
    context.fillStyle = '#8a6d2f';
    const fenceX = -((distance * 14) % 120);
    for (let x = fenceX; x < FIELD.width; x += 120) {
      context.fillRect(x, FIELD.groundY - 46, 8, 46);
      context.fillRect(x + 8, FIELD.groundY - 40, 112, 6);
      context.fillRect(x + 8, FIELD.groundY - 24, 112, 6);
    }
    // The ground: golden grass with darker tufts.
    context.fillStyle = PALETTE.farmGround;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = PALETTE.farmGrass;
    const grassX = -((distance * 14) % 90);
    for (let x = grassX; x < FIELD.width; x += 90) {
      context.beginPath();
      context.moveTo(x, FIELD.groundY + 30);
      context.lineTo(x + 8, FIELD.groundY + 12);
      context.lineTo(x + 16, FIELD.groundY + 30);
      context.closePath();
      context.fill();
    }
  }

  function drawBarn(distance) {
    context.fillStyle = PALETTE.barnSky;
    context.fillRect(0, 0, FIELD.width, FIELD.groundY);
    // Wooden beams across the top and a hanging lantern.
    context.fillStyle = PALETTE.barnWood;
    context.fillRect(0, 0, FIELD.width, 26);
    context.fillRect(0, 150, FIELD.width, 18);
    for (let x = 60; x < FIELD.width; x += 320) {
      context.fillRect(x, 0, 22, 168);
    }
    const lampX = 640 - ((distance * 7) % 640);
    context.fillStyle = '#3a2415';
    context.fillRect(lampX - 2, 26, 4, 40);
    context.fillStyle = '#ffd98a';
    context.beginPath();
    context.arc(lampX, 84, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 217, 138, 0.18)';
    context.beginPath();
    context.arc(lampX, 84, 90, 0, Math.PI * 2);
    context.fill();
    // Haylofts and a big barn door, far away.
    context.fillStyle = '#8a5a30';
    const loftX = 1280 - ((distance * 5) % 1600) - 200;
    context.fillRect(loftX, 420, 260, 140);
    context.fillStyle = '#6e4526';
    context.fillRect(loftX + 20, 440, 220, 10);
    context.fillRect(loftX + 20, 480, 220, 10);
    // The ground: straw.
    context.fillStyle = PALETTE.barnGround;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = '#d9a94f';
    const strawX = -((distance * 14) % 70);
    for (let x = strawX; x < FIELD.width; x += 70) {
      context.fillRect(x, FIELD.groundY + 24, 44, 4);
      context.fillRect(x + 18, FIELD.groundY + 52, 40, 4);
    }
  }

  function drawKitchen(distance) {
    // Cream tiles on the wall, a window onto the yard, hanging pots.
    context.fillStyle = PALETTE.kitchenSky;
    context.fillRect(0, 0, FIELD.width, FIELD.groundY);
    context.fillStyle = PALETTE.kitchenTile;
    for (let y = 0; y < FIELD.groundY; y += 64) {
      for (let x = (y % 128 === 0 ? 0 : 32); x < FIELD.width; x += 64) {
        context.fillRect(x + 2, y + 2, 60, 60);
      }
    }
    const winX = 900 - ((distance * 3) % 1200);
    context.fillStyle = '#7a4a28';
    context.fillRect(winX, 90, 200, 180);
    context.fillStyle = '#f2a65a';
    context.fillRect(winX + 10, 100, 180, 160);
    context.fillStyle = '#8a6d2f';
    context.fillRect(winX + 10, 220, 180, 40);
    context.fillStyle = '#7a4a28';
    context.fillRect(winX + 96, 100, 8, 160);
    context.fillRect(winX + 10, 176, 180, 8);
    // Hanging pots and pans.
    context.fillStyle = '#5a5a5a';
    for (let i = 0; i < 4; i += 1) {
      const px = 140 + i * 130;
      context.beginPath();
      context.arc(px, 190, 26, 0, Math.PI * 2);
      context.fill();
      context.fillRect(px - 3, 140, 6, 26);
    }
    // The checkered floor.
    for (let y = FIELD.groundY; y < FIELD.height; y += 50) {
      for (let x = 0; x < FIELD.width; x += 50) {
        context.fillStyle = ((x / 50 + y / 50) % 2 === 0) ? '#e8d9b0' : '#c9a86a';
        context.fillRect(x, y, 50, 50);
      }
    }
  }

  // ----- The characters and the things -----

  /** The turkey: a brown body, a fan of tail feathers, a small head and a red wattle. */
  function drawTurkey(turkey) {
    const height = turkey.crouching
      ? PLAYER.crouchHeight
      : (turkey.onGround ? PLAYER.height : PLAYER.airHeight);
    const cx = turkey.x + PLAYER.width / 2;
    const base = turkey.y;
    const run = Math.sin(turkey.runPhase);
    const hidden = turkey.hidden;
    // Blink while invulnerable after a hit.
    if (turkey.invulnerable > 0 && Math.floor(turkey.invulnerable * 10) % 2 === 0) return;
    // A dash leaves motion lines behind.
    if (turkey.dashing) {
      context.strokeStyle = 'rgba(255, 243, 221, 0.7)';
      context.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        const ly = base - 14 - i * 12;
        context.beginPath();
        context.moveTo(turkey.x - 14 - i * 10, ly);
        context.lineTo(turkey.x - 54 - i * 10, ly);
        context.stroke();
      }
    }
    // The tail fan.
    const tailSpread = turkey.crouching ? 0.35 : 1;
    for (let i = 0; i < 4; i += 1) {
      context.fillStyle = PALETTE.tail[i];
      context.beginPath();
      const angle = -Math.PI / 2 + (i - 1.5) * 0.42 * tailSpread;
      context.ellipse(
        cx - 14 + Math.cos(angle) * 26, base - 18 + Math.sin(angle) * 26,
        12, 24, angle + Math.PI / 2, 0, Math.PI * 2,
      );
      context.fill();
    }
    // The body.
    context.fillStyle = PALETTE.turkey;
    context.beginPath();
    context.ellipse(cx, base - height * 0.55, PLAYER.width * 0.34, height * 0.62, 0, 0, Math.PI * 2);
    context.fill();
    // The wing, flapping a little when airborne.
    const flap = turkey.onGround ? 0 : -0.5;
    context.fillStyle = PALETTE.turkeyDark;
    context.beginPath();
    context.ellipse(cx - 4, base - height * 0.55 + flap * 10, 18, 10, flap, 0, Math.PI * 2);
    context.fill();
    // The head, beak and wattle.
    const headY = base - height - 8 + (turkey.crouching ? 10 : 0);
    context.fillStyle = PALETTE.head;
    context.beginPath();
    context.arc(cx + 12, headY, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.beak;
    context.beginPath();
    context.moveTo(cx + 20, headY - 2);
    context.lineTo(cx + 32, headY + 2);
    context.lineTo(cx + 20, headY + 6);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.wattle;
    context.beginPath();
    context.arc(cx + 14, headY + 10, 5, 0, Math.PI * 2);
    context.fill();
    // The legs, running.
    context.strokeStyle = '#e8b25a';
    context.lineWidth = 4;
    const legSwing = turkey.onGround ? run * 10 : 6;
    context.beginPath();
    context.moveTo(cx - 8, base - 8);
    context.lineTo(cx - 8 + legSwing, base);
    context.moveTo(cx + 8, base - 8);
    context.lineTo(cx + 8 - legSwing, base);
    context.stroke();
    if (hidden) {
      text('Hidden!', cx, base - height - 34, 20, PALETTE.good, 'center');
    }
  }

  /** The farmer: straw hat, plaid shirt, overalls, and a pitchfork. */
  function drawFarmer(state) {
    const farmer = state.farmer;
    const x = state.turkey.x - farmer.gap * PX_PER_M;
    if (x < -120) return;
    const base = FIELD.groundY;
    const run = Math.sin(farmer.runPhase);
    const searching = farmer.mode === FARMER_SEARCH;
    const charging = farmer.mode === FARMER_CHARGE;
    const lean = charging ? 0.25 : searching ? 0 : 0.12;
    context.save();
    context.translate(x + 29, base);
    context.rotate(lean);
    context.translate(-29, 0);
    // The legs.
    context.strokeStyle = '#2e3a45';
    context.lineWidth = 7;
    const legSwing = searching ? 0 : run * 12;
    context.beginPath();
    context.moveTo(-6, -34);
    context.lineTo(-6 + legSwing, 0);
    context.moveTo(6, -34);
    context.lineTo(6 - legSwing, 0);
    context.stroke();
    // The overalls and the plaid shirt.
    context.fillStyle = PALETTE.farmerOveralls;
    context.fillRect(-16, -62, 32, 32);
    context.fillStyle = '#a83c2a';
    context.fillRect(-18, -88, 36, 28);
    context.fillStyle = '#7e2a1e';
    context.fillRect(-18, -80, 36, 4);
    context.fillRect(-18, -70, 36, 4);
    // The arms; one holds the pitchfork.
    context.strokeStyle = PALETTE.farmerSkin;
    context.lineWidth = 6;
    const armSwing = searching ? 0 : -run * 10;
    context.beginPath();
    context.moveTo(-14, -82);
    context.lineTo(-26, -58 + armSwing);
    context.moveTo(14, -82);
    context.lineTo(26, -58 - armSwing);
    context.stroke();
    // The pitchfork.
    context.strokeStyle = '#8a6d2f';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(26, -58 - armSwing);
    context.lineTo(40, -104);
    context.stroke();
    context.beginPath();
    context.moveTo(34, -104);
    context.lineTo(34, -118);
    context.moveTo(40, -104);
    context.lineTo(40, -120);
    context.moveTo(46, -104);
    context.lineTo(46, -118);
    context.stroke();
    // The head and the straw hat.
    context.fillStyle = PALETTE.farmerSkin;
    context.beginPath();
    context.arc(0, -98, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.farmerHat;
    context.beginPath();
    context.ellipse(0, -106, 24, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-12, -122, 24, 16);
    // A moustache.
    context.fillStyle = '#5a3a22';
    context.fillRect(-8, -94, 16, 4);
    context.restore();
    // "?" while searching, "!" while charging.
    if (searching) {
      text('?', x + 29, base - 140, 40, PALETTE.text, 'center');
    } else if (charging) {
      text('!', x + 29, base - 140, 44, PALETTE.danger, 'center');
    }
  }

  function drawKnife(item) {
    context.fillStyle = PALETTE.knifeHandle;
    context.fillRect(item.x + item.width * 0.4, item.y, item.width * 0.2, item.height * 0.3);
    context.fillStyle = PALETTE.knife;
    context.beginPath();
    context.moveTo(item.x, item.y + item.height * 0.3);
    context.lineTo(item.x + item.width, item.y + item.height * 0.3);
    context.lineTo(item.x + item.width / 2, item.y + item.height);
    context.closePath();
    context.fill();
  }

  function drawCorn(item) {
    context.fillStyle = PALETTE.cornHusk;
    context.beginPath();
    context.ellipse(item.x, item.y + 4, 10, 14, -0.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = item.golden ? '#ffd94a' : PALETTE.corn;
    context.beginPath();
    context.ellipse(item.x, item.y, 9, 15, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = -1; i <= 1; i += 1) context.fillRect(item.x + i * 5 - 1, item.y - 12, 2, 24);
  }

  function drawObstacle(o, stage) {
    if (o.kind === 0) {
      // A fence.
      context.fillStyle = '#8a6d2f';
      context.fillRect(o.x, o.y, 6, o.height);
      context.fillRect(o.x + o.width - 6, o.y, 6, o.height);
      context.fillRect(o.x, o.y + 10, o.width, 6);
      context.fillRect(o.x, o.y + 30, o.width, 6);
    } else if (o.kind === 1) {
      // A hay bale.
      context.fillStyle = '#d9a94f';
      context.beginPath();
      context.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#a87c2e';
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width / 2 - 8, o.height / 2 - 8, 0, 0, Math.PI * 2);
      context.stroke();
    } else if (o.kind === 2) {
      // A mud puddle.
      context.fillStyle = PALETTE.mud;
      context.beginPath();
      context.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.15)';
      context.beginPath();
      context.ellipse(o.x + o.width / 2 - 20, o.y + 4, 18, 3, 0, 0, Math.PI * 2);
      context.fill();
    } else if (o.kind === 3) {
      // A rolling pumpkin.
      context.fillStyle = PALETTE.pumpkin;
      context.beginPath();
      context.arc(o.x + o.width / 2, o.y + o.height / 2, o.width / 2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#b85e1a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(o.x + o.width / 2, o.y + 4);
      context.lineTo(o.x + o.width / 2, o.y + o.height - 4);
      context.stroke();
      context.fillStyle = '#5d7a3a';
      context.fillRect(o.x + o.width / 2 - 3, o.y - 8, 6, 10);
    } else if (o.kind === 4) {
      // The oven, with its glowing door and a flame when it bursts.
      context.fillStyle = PALETTE.oven;
      context.fillRect(o.x, o.y, o.width, o.height);
      context.fillStyle = '#6e231c';
      context.fillRect(o.x, o.y, o.width, 14);
      context.fillStyle = o.flameActive > 0 ? PALETTE.ovenGlow : '#3a3a3a';
      context.fillRect(o.x + 18, o.y + 34, o.width - 36, 54);
      context.fillStyle = '#d9d9d9';
      context.fillRect(o.x + 18, o.y + 22, o.width - 36, 6);
      if (o.flameActive > 0) {
        context.fillStyle = 'rgba(255, 122, 47, 0.85)';
        context.beginPath();
        context.moveTo(o.x - 46, FIELD.groundY);
        context.lineTo(o.x - 30, FIELD.groundY - 90);
        context.lineTo(o.x - 14, FIELD.groundY);
        context.closePath();
        context.fill();
        context.fillStyle = '#ffd94a';
        context.beginPath();
        context.moveTo(o.x - 40, FIELD.groundY);
        context.lineTo(o.x - 30, FIELD.groundY - 56);
        context.lineTo(o.x - 20, FIELD.groundY);
        context.closePath();
        context.fill();
      }
      text('OVEN', o.x + o.width / 2, o.y + 78, 15, '#e8c98a', 'center');
    } else if (o.kind === 5) {
      // A falling knife: a telegraph shadow and "!" first, then the blade.
      if (o.telegraph > 0) {
        context.fillStyle = 'rgba(255, 90, 60, 0.35)';
        context.beginPath();
        context.ellipse(o.targetX + o.width / 2, FIELD.groundY - 4, o.width, 8, 0, 0, Math.PI * 2);
        context.fill();
        text('!', o.targetX + o.width / 2, FIELD.groundY - 66, 36, PALETTE.danger, 'center');
      } else {
        drawKnife(o);
      }
    } else if (o.kind === 6) {
      // A knife thrown by the farmer, spinning as it flies.
      context.save();
      context.translate(o.x + o.width / 2, o.y + o.height / 2);
      context.rotate(o.x * 0.03);
      context.fillStyle = PALETTE.knife;
      context.beginPath();
      context.moveTo(-o.width / 2, 0);
      context.lineTo(o.width / 2, -6);
      context.lineTo(o.width / 2, 6);
      context.closePath();
      context.fill();
      context.restore();
    } else if (o.kind === 7) {
      // A cover to hide behind: a haystack, a bush, or a kitchen table by stage.
      if (stage === 2) {
        context.fillStyle = '#7a4a28';
        context.fillRect(o.x, o.y + 18, o.width, o.height - 18);
        context.fillStyle = '#f2e6c8';
        context.fillRect(o.x, o.y + 18, o.width, 10);
        context.fillStyle = '#5a5a5a';
        context.beginPath();
        context.arc(o.x + 24, o.y + 8, 12, 0, Math.PI * 2);
        context.fill();
      } else if (stage === 1) {
        context.fillStyle = PALETTE.coverBush;
        context.beginPath();
        context.arc(o.x + 30, o.y + 50, 34, 0, Math.PI * 2);
        context.arc(o.x + 70, o.y + 44, 38, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = PALETTE.coverHay;
        context.beginPath();
        context.moveTo(o.x, o.y + o.height);
        context.lineTo(o.x + o.width / 2, o.y);
        context.lineTo(o.x + o.width, o.y + o.height);
        context.closePath();
        context.fill();
        context.strokeStyle = '#a87c2e';
        context.lineWidth = 3;
        for (let i = 1; i < 4; i += 1) {
          context.beginPath();
          context.moveTo(o.x + (o.width / 4) * i, o.y + o.height);
          context.lineTo(o.x + o.width / 2, o.y + 8);
          context.stroke();
        }
      }
    }
  }

  function drawField(state) {
    const stage = state.stage;
    if (stage === 0) drawFarmyard(state.distance);
    else if (stage === 1) drawBarn(state.distance);
    else drawKitchen(state.distance);
    // The corn, the obstacles, the farmer and the turkey, in that order.
    for (const c of state.corns) {
      if (c.active) drawCorn(c);
    }
    for (const o of state.obstacles) {
      if (o.active) drawObstacle(o, stage);
    }
    drawFarmer(state);
    drawTurkey(state.turkey);
  }

  function drawHeart(x, y, size, filled) {
    context.fillStyle = filled ? '#e5534b' : 'rgba(255,255,255,0.25)';
    context.beginPath();
    context.moveTo(x, y + size * 0.35);
    context.bezierCurveTo(x, y, x - size * 0.5, y - size * 0.1, x - size * 0.5, y + size * 0.2);
    context.bezierCurveTo(x - size * 0.5, y + size * 0.55, x, y + size * 0.75, x, y + size);
    context.bezierCurveTo(x, y + size * 0.75, x + size * 0.5, y + size * 0.55, x + size * 0.5, y + size * 0.2);
    context.bezierCurveTo(x + size * 0.5, y - size * 0.1, x, y, x, y + size * 0.35);
    context.fill();
  }

  function drawHud(state, muted) {
    const stageNames = ['The Farmyard', 'The Barn', 'The Kitchen'];
    context.fillStyle = PALETTE.hudBack;
    context.fillRect(0, 0, FIELD.width, 64);
    context.textBaseline = 'top';
    text(scoreLabel(Math.floor(state.score)), 24, 14, 28, PALETTE.text, 'left');
    text(distanceLabel(`${Math.floor(state.distance)} m`), 24, 44, 18, PALETTE.muted, 'left');
    text(stageNames[state.stage], FIELD.width / 2, 16, 24, PALETTE.text, 'center');
    // Lives as hearts.
    for (let i = 0; i < LIVES; i += 1) {
      drawHeart(FIELD.width - 260 + i * 30, 16, HEART, i < state.lives);
    }
    // The farmer meter: how far behind he is, red when he is close.
    const gap = state.farmer.gap;
    const gapText = gapLabel(gap < 1 ? 'ON YOU!' : `${gap.toFixed(0)} m`);
    const barX = FIELD.width - 260;
    const barW = 236;
    const fill = Math.max(0, Math.min(1, gap / 26));
    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(barX, 44, barW, 10);
    context.fillStyle = gap < 8 ? PALETTE.danger : gap < 16 ? '#e8a33c' : PALETTE.good;
    context.fillRect(barX, 44, barW * (1 - fill), 10);
    text('FARMER', barX, 28, 13, PALETTE.muted, 'left');
    text(gapText, barX + barW, 28, 13, gap < 8 ? PALETTE.danger : PALETTE.text, 'right');
    // The dash recharge, bottom left.
    const dashFill = 1 - Math.max(0, state.turkey.dashCooldown) / 1.4;
    context.fillStyle = PALETTE.hudBack;
    context.fillRect(24, FIELD.height - 34, 150, 18);
    context.fillStyle = dashFill >= 1 ? PALETTE.good : '#e8a33c';
    context.fillRect(24, FIELD.height - 34, 150 * dashFill, 18);
    text('DASH  [Shift]', 30, FIELD.height - 32, 13, PALETTE.text, 'left');
    if (muted) text('Muted  [M]', FIELD.width - 24, FIELD.height - 32, 13, PALETTE.muted, 'right');
    else text('Sound on  [M]', FIELD.width - 24, FIELD.height - 32, 13, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(20, 12, 6, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, PANEL.width, height, 18);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(x, y, PANEL.width, height, 18);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.corn, 'center');
  }

  const TITLE_LINES = [
    'Thanksgiving is coming — and you are the dinner.',
    'Run from the farmyard to the kitchen and out the back gate.',
    'Jump fences and the oven · dodge the carving knives · hide in the hay.',
    'Space jump · Down hide · Shift dash · P pause · M mute',
    '',
  ];
  const PAUSED_LINES = ['The farmer will wait for you. Probably.'];
  const OVER_LINES = ['', ''];
  const ESCAPED_LINES = ['', 'The turkey lives to gobble another day.'];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('TURKEY RUN', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(Math.floor(state.score));
      OVER_LINES[1] = bestLabel(best);
      drawPanel('Caught for dinner!', OVER_LINES, 'Press Space or click to run again');
    } else if (screen === SCREEN_ESCAPED) {
      ESCAPED_LINES[0] = finalLabel(Math.floor(state.score));
      drawPanel('Escaped!', ESCAPED_LINES, 'Press Space or click to run again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

'use strict';

const MOVE_DURATION = 560;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);

// World-space travel and local joint motion are independent. Feet stay planted
// during anticipation, tuck during flight, then absorb the landing.
function hopPosition(origin, destination, progress, variant = 0) {
  const p = clamp(progress);
  const flight = clamp((p - 0.14) / 0.60);
  const travel = smooth(flight);
  const arc = Math.sin(Math.PI * flight);
  const side = destination.x === origin.x ? (variant % 2 ? -1 : 1) : Math.sign(destination.x - origin.x);
  const height = 30 + Math.min(180, Math.abs(destination.y - origin.y)) * 0.12 + variant % 3 * 4;
  const land = clamp((p - 0.74) / 0.26);
  const contact = p < 0.14 ? Math.sin(p / 0.14 * Math.PI) * 2.5 : p > 0.74 ? Math.sin(land * Math.PI) * 3 : 0;
  return {
    x: origin.x + (destination.x - origin.x) * travel + arc * side * 13,
    y: origin.y + (destination.y - origin.y) * travel - arc * height + contact,
    groundX: origin.x + (destination.x - origin.x) * travel,
    groundY: origin.y + (destination.y - origin.y) * travel,
    height: arc * height,
    facing: side
  };
}

function catRig(options = {}) {
  const variant = options.variant || 0;
  const time = options.time || 0;
  const phase = variant * 1.71;
  const breath = Math.sin(time * 1.65 + phase);
  const selected = Boolean(options.selected);
  const sleeping = Boolean(options.sleeping);
  const moving = Number.isFinite(options.moveProgress);
  const p = moving ? clamp(options.moveProgress) : 0;
  const flight = moving ? clamp((p - 0.14) / 0.60) : 0;
  const airborne = moving && p > 0.14 && p < 0.74;
  const windup = moving && p < 0.14 ? Math.sin(p / 0.14 * Math.PI) : 0;
  const impact = moving && p > 0.74 ? Math.sin((p - 0.74) / 0.26 * Math.PI) : 0;
  const stretch = airborne ? Math.sin(Math.PI * flight) : 0;
  const look = (variant % 3 - 1) * 0.045;
  const lickClock = (time + phase) % 6.7;
  const pawLift = !moving && !sleeping && time > 0 && lickClock < 0.9 ? Math.sin(lickClock / 0.9 * Math.PI) : 0;
  const blinkClock = (time + phase * 2.7) % (4.1 + variant * 0.09);
  return {
    body: {
      y: windup * 3 + impact * 2 - (selected ? 1.8 : 0),
      angle: look * 0.35 + (options.facing || 1) * stretch * 0.13,
      scaleX: 1 + windup * 0.10 + impact * 0.12 - stretch * 0.06,
      scaleY: 1 - windup * 0.13 - impact * 0.14 + stretch * 0.10 + breath * 0.012
    },
    head: {
      x: Math.sin(time * 0.55 + phase) * 0.8,
      y: breath * 0.35 + windup * 1.7 - impact * 0.7 + (sleeping ? 2 : 0),
      angle: look + Math.sin(time * 0.67 + phase) * 0.025 - (options.facing || 1) * stretch * 0.09 + pawLift * 0.08
    },
    frontLeft: { angle: airborne ? -0.65 + Math.sin(flight * Math.PI) * 0.20 : pawLift * -0.65, lift: airborne ? 5 : pawLift * 5 },
    frontRight: { angle: airborne ? 0.55 - Math.sin(flight * Math.PI) * 0.22 : selected ? -0.17 : 0.025, lift: airborne ? 7 : selected ? 2.5 : 0 },
    backLeft: { angle: airborne ? 0.78 - flight * 0.45 : -windup * 0.15, lift: airborne ? 3 : 0 },
    backRight: { angle: airborne ? -0.68 + flight * 0.35 : impact * 0.12, lift: airborne ? 4 : 0 },
    tail: {
      angle: Math.sin(time * 1.3 + phase) * (sleeping ? 0.06 : 0.19) - (options.facing || 1) * stretch * 0.34,
      curl: Math.sin(time * 1.85 + phase + 0.6) * (sleeping ? 1.5 : 4.5)
    },
    blink: !selected && !airborne && time > 0 && blinkClock < 0.14,
    airborne,
    crouching: sleeping || (!moving && variant % 3 === 2)
  };
}

module.exports = { MOVE_DURATION, hopPosition, catRig };

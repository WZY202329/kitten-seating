'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hopPosition, catRig, MOVE_DURATION } = require('../src/motion.js');

test('hop begins and ends at the seats and rises above the ground while travelling', () => {
  const start = { x: 80, y: 500 }, end = { x: 270, y: 350 };
  const first = hopPosition(start, end, 0, 2);
  const last = hopPosition(start, end, 1, 2);
  assert.equal(first.x, start.x); assert.equal(first.y, start.y);
  assert.ok(Math.abs(last.x - end.x) < 0.001 && Math.abs(last.y - end.y) < 0.001);
  const mid = hopPosition(start, end, 0.44, 2);
  assert.ok(mid.height > 25);
  assert.ok(mid.y < mid.groundY);
  for (let i = 0; i <= 100; i++) {
    const position = hopPosition(start, end, i / 100, 2);
    assert.ok(Object.values(position).every(Number.isFinite));
  }
});

test('vertical hops have variant-specific arcs instead of a single straight slide', () => {
  const a = { x: 160, y: 400 }, b = { x: 160, y: 550 };
  const left = hopPosition(a, b, 0.44, 1);
  const right = hopPosition(a, b, 0.44, 2);
  assert.ok(left.x < a.x && right.x > a.x);
});

test('takeoff, independent limbs and landing absorption are visible phases', () => {
  assert.ok(MOVE_DURATION >= 400);
  const ready = catRig({ time: 1, moveProgress: 0.07 });
  const flight = catRig({ time: 1, moveProgress: 0.42, facing: 1 });
  const land = catRig({ time: 1, moveProgress: 0.87 });
  assert.ok(ready.body.scaleY < 1 && ready.body.scaleX > 1);
  assert.ok(flight.airborne && flight.frontLeft.lift > 0 && flight.backRight.lift > 0);
  assert.notEqual(flight.frontLeft.angle, flight.frontRight.angle);
  assert.notEqual(flight.frontLeft.angle, flight.backLeft.angle);
  assert.notEqual(flight.head.angle, flight.body.angle);
  assert.ok(land.body.scaleY < 1 && !land.airborne);
});

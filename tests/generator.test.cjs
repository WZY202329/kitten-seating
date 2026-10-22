'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LEVELS, LEVEL_COUNT, getLevel } = require('../src/levels.js');
const { generateLevel, hintFromSolution } = require('../src/generator.js');
const { copyBoard, isSolved, move, validBoard, solve } = require('../src/core.js');

function permutations(values) {
  return values.length ? values.flatMap((v, i) => permutations(values.filter((_, j) => i !== j)).map(tail => [v, ...tail])) : [[]];
}
function shapeKey(level) {
  const permutationsOfColors = permutations([...new Set(level.board.flat())]);
  return `${level.capacity}:` + permutationsOfColors.map(p => level.board.map(row => row.map(cat => p[cat]).join(',')).sort().join('|')).sort()[0];
}

test('all 100 puzzles are distinct even when row order and color names are ignored', () => {
  assert.equal(LEVELS.length, LEVEL_COUNT);
  assert.equal(LEVEL_COUNT, 100);
  const shapes = new Set();
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const level = getLevel(i);
    assert.ok(!isSolved(level.board, level.capacity));
    assert.ok(validBoard(level.board, level));
    assert.ok(level.board.length <= 6);
    const key = shapeKey(level);
    assert.ok(!shapes.has(key), `structurally duplicated level ${i + 1}`);
    shapes.add(key);
  }
});

test('every generated witness is legal and ends in a complete solution', () => {
  for (let i = 5; i < LEVEL_COUNT; i++) {
    const level = getLevel(i);
    let board = copyBoard(level.board);
    for (const action of level.solution) {
      const hint = hintFromSolution(board, level);
      assert.ok(hint, `verified hint available at level ${i + 1}`);
      board = move(board, level.capacity, action.from, action.to);
      assert.ok(board, `level ${i + 1}: reverse path must yield legal forward moves`);
    }
    assert.ok(isSolved(board, level.capacity));
  }
});

test('generated puzzles are reproducible independently of play order', () => {
  const first = generateLevel(99);
  for (const number of [6, 40, 100, 20]) generateLevel(number);
  assert.deepEqual(generateLevel(99), first);
  assert.deepEqual(generateLevel(99, { seed: first.seed }), first);
  assert.deepEqual(generateLevel(6).board, [[0], [1, 0], [2, 0, 1], [], [2, 1, 2]]);
});

test('bounded hint search can solve every initial puzzle within its node budget', () => {
  for (let i = 5; i < LEVEL_COUNT; i++) {
    const level = getLevel(i);
    assert.equal(solve(level.board, level.capacity, { maxNodes: 24000 }).status, 'solved', `level ${i + 1}`);
  }
});

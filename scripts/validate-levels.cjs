'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { LEVEL_COUNT, getLevel } = require('../src/levels.js');
const { move, isSolved, solve } = require('../src/core.js');
const samples = [];
for (let index = 0; index < LEVEL_COUNT; index++) {
  const started = performance.now();
  const level = getLevel(index);
  const generationMs = performance.now() - started;
  let board = level.board;
  for (const action of level.solution) { board = move(board, level.capacity, action.from, action.to); assert.ok(board); }
  assert.ok(isSolved(board, level.capacity));
  const shortest = solve(level.board, level.capacity, { maxNodes: 24000 });
  assert.equal(shortest.status, 'solved');
  samples.push({ number: index + 1, id: level.id, generated: index >= 5, seed: level.seed || null,
    capacity: level.capacity, rows: level.board.length, generationMs: Number(generationMs.toFixed(3)),
    boardJsonBytes: Buffer.byteLength(JSON.stringify(level.board)), witnessMoves: level.solution.length,
    shortestMoves: shortest.path.length, hintSearchNodes: shortest.visited });
}
const report = { version: require('../package.json').version, levelCount: LEVEL_COUNT, generatedLevelCount: LEVEL_COUNT - 5,
  allSolvable: true, fullBoardJsonBytes: samples.reduce((total, item) => total + item.boardJsonBytes, 0),
  maxGenerationMsOnThisMachine: Math.max(...samples.map(item => item.generationMs)),
  notes: ['Timing is a local Node measurement, not a phone performance guarantee.',
    'Board JSON byte count excludes metadata, code and JavaScript object overhead.',
    'Only the current materialized level is cached at runtime; no 100-board startup generation.'], samples };
fs.mkdirSync(path.resolve(__dirname, '../artifacts'), { recursive: true });
fs.writeFileSync(path.resolve(__dirname, '../artifacts/level-report.json'), JSON.stringify(report, null, 2));
console.log(`Validated ${LEVEL_COUNT} solvable levels (${LEVEL_COUNT - 5} seeded).`);
console.log(`All board layouts combined: ${report.fullBoardJsonBytes} JSON bytes (excludes object overhead).`);
console.log(`Max generation time on this machine: ${report.maxGenerationMsOnThisMachine} ms.`);

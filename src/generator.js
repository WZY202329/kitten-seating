'use strict';

const { copyBoard, sameBoard, move, isSolved } = require('./core.js');

// Version 1 is immutable: level number + seed reproduces the same puzzle,
// including after reload. Never use Math.random() for player-facing levels.
function randomFor(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = state;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function complexity(board) {
  let changes = 0;
  let mixedRows = 0;
  for (const row of board) {
    let mixed = false;
    for (let i = 1; i < row.length; i++) {
      if (row[i] !== row[i - 1]) { changes++; mixed = true; }
    }
    if (mixed) mixedRows++;
  }
  return changes * 10 + mixedRows * 3;
}

function generateLevel(number, options = {}) {
  if (!Number.isInteger(number) || number < 6 || number > 100) throw new RangeError('Generated level must be between 6 and 100.');
  const colors = number <= 20 ? 3 : 4;
  const capacity = number <= 40 ? 3 : 4;
  // Tiny seed corrections remove structurally duplicate puzzles (including
  // duplicates hidden by swapping colors or entire rows), checked offline.
  const salts = { 10: 3, 19: 2, 26: 1, 36: 1, 71: 1 };
  const seed = options.seed === undefined ? ((Math.imul(number, 2654435761) ^ 0xCA75EED) + Math.imul(salts[number] || 0, 2246822519)) >>> 0 : options.seed;
  const random = randomFor(seed);
  let best = null;
  const chapterStep = (number - 1) % 10;
  const targetChanges = Math.min(colors * (capacity - 1), (capacity === 3 ? 3 : 5) + Math.floor(chapterStep / 2) + Math.floor(number / 25));
  const maxWalk = 70 + Math.floor(number / 10) * 8;
  for (let attempt = 0; attempt < 16; attempt++) {
    let board = Array.from({ length: colors + 2 }, (_, i) => i < colors ? Array(capacity).fill(i) : []);
    let reversePath = [];
    let seen = new Map([[JSON.stringify(board), 0]]);
    for (let step = 0; step < maxWalk; step++) {
      const candidates = [];
      for (let from = 0; from < board.length; from++) {
        const row = board[from];
        if (!row.length) continue;
        const cat = row[row.length - 1];
        // After taking x away, the remainder must accept x back legally.
        // The reverse scramble itself may put x on a different color.
        if (row.length > 1 && row[row.length - 2] !== cat) continue;
        for (let to = 0; to < board.length; to++) {
          if (from === to || board[to].length >= capacity) continue;
          const previous = reversePath[reversePath.length - 1];
          if (previous && previous.from === to && previous.to === from) continue;
          const mixed = board[to].length && board[to][board[to].length - 1] !== cat;
          candidates.push({ from, to, weight: mixed ? 3 : 1 });
        }
      }
      if (!candidates.length) break;
      let choice = random() * candidates.reduce((sum, item) => sum + item.weight, 0);
      let action = candidates[candidates.length - 1];
      for (const item of candidates) { choice -= item.weight; if (choice < 0) { action = item; break; } }
      const next = copyBoard(board);
      next[action.to].push(next[action.from].pop());
      board = next;
      const key = JSON.stringify(board);
      if (seen.has(key)) {
        reversePath = reversePath.slice(0, seen.get(key));
        seen = new Map([...seen].filter(([, position]) => position <= reversePath.length));
      } else {
        reversePath.push({ from: action.from, to: action.to });
        seen.set(key, reversePath.length);
      }
      const score = complexity(board);
      if (!isSolved(board, capacity) && reversePath.length >= 3 && (!best || score > best.score || score === best.score && reversePath.length < best.path.length)) {
        best = { board: copyBoard(board), path: reversePath.slice(), score };
      }
    }
    if (best && Math.floor(best.score / 10) >= targetChanges && attempt >= 2) break;
  }
  if (!best) throw new Error(`Unable to generate level ${number}`);
  const solution = best.path.slice().reverse().map(action => ({ from: action.to, to: action.from }));
  return { board: best.board, capacity, solution, seed, generatorVersion: 1 };
}

function hintFromSolution(board, level) {
  let candidate = level.board;
  for (const action of level.solution || []) {
    if (sameBoard(candidate, board)) return { from: action.from, to: action.to };
    candidate = move(candidate, level.capacity, action.from, action.to);
    if (!candidate) return null;
  }
  return null;
}

module.exports = { generateLevel, randomFor, complexity, hintFromSolution };

'use strict';

const copyBoard = board => board.map(row => row.slice());
const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fullRow = (row, capacity) => row.length === capacity && row.every(cat => cat === row[0]);
const isSolved = (board, capacity) => board.every(row => row.length === 0 || fullRow(row, capacity));

function canMove(board, capacity, from, to) {
  return Number.isInteger(from) && Number.isInteger(to) && from !== to &&
    from >= 0 && to >= 0 && from < board.length && to < board.length &&
    board[from].length > 0 && board[to].length < capacity &&
    (board[to].length === 0 || board[to][board[to].length - 1] === board[from][board[from].length - 1]);
}

function move(board, capacity, from, to) {
  if (!canMove(board, capacity, from, to)) return null;
  const next = copyBoard(board);
  next[to].push(next[from].pop());
  return next;
}

function validBoard(board, level) {
  if (!Array.isArray(board) || board.length !== level.board.length) return false;
  const expected = level.board.flat().slice().sort((a, b) => a - b);
  if (board.some(row => !Array.isArray(row) || row.length > level.capacity ||
    row.some(cat => !Number.isInteger(cat) || cat < 0 || cat > 3))) return false;
  return JSON.stringify(board.flat().slice().sort((a, b) => a - b)) === JSON.stringify(expected);
}

// Row permutation symmetry removes equivalent empty-buffer arrangements.
// Nodes retain their actual boards, so reconstructed moves use actual row indices.
function canonical(board) {
  return board.map(row => row.join(',')).sort().join('|');
}

function createSearch(board, capacity, options = {}) {
  const maxNodes = options.maxNodes || 60000;
  const start = canonical(board);
  const nodes = new Map([[start, { board: copyBoard(board), parent: null, action: null }]]);
  const queue = [start];
  let cursor = 0;
  let result = null;
  function finish(key) {
    const path = [];
    let node = nodes.get(key);
    while (node.parent !== null) {
      path.push(node.action);
      node = nodes.get(node.parent);
    }
    return { status: 'solved', path: path.reverse(), visited: nodes.size };
  }
  return {
    step(budget = 300) {
      if (result) return result;
      let processed = 0;
      while (cursor < queue.length && processed++ < budget) {
        const key = queue[cursor++];
        const current = nodes.get(key).board;
        if (isSolved(current, capacity)) return (result = finish(key));
        for (let from = 0; from < current.length; from++) {
          let triedEmpty = false;
          for (let to = 0; to < current.length; to++) {
            if (!canMove(current, capacity, from, to)) continue;
            if (current[to].length === 0) {
              if (triedEmpty) continue;
              triedEmpty = true;
            }
            const next = move(current, capacity, from, to);
            const nextKey = canonical(next);
            if (nodes.has(nextKey)) continue;
            if (nodes.size >= maxNodes) return (result = { status: 'limit', visited: nodes.size });
            nodes.set(nextKey, { board: next, parent: key, action: { from, to } });
            queue.push(nextKey);
          }
        }
      }
      if (cursor === queue.length) return (result = { status: 'unsolvable', visited: nodes.size });
      return { status: 'searching', visited: nodes.size };
    }
  };
}

function solve(board, capacity, options) {
  const search = createSearch(board, capacity, options);
  let result;
  do { result = search.step(500); } while (result.status === 'searching');
  return result;
}

module.exports = { copyBoard, sameBoard, fullRow, isSolved, canMove, move, validBoard, createSearch, solve };

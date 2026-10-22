'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { copyBoard, sameBoard, isSolved, move, validBoard, solve, createSearch } = require('../src/core.js');
const { LEVELS: ALL_LEVELS, PACK_VERSION, getLevel } = require('../src/levels.js');
const LEVELS = Array.from({ length: 5 }, (_, index) => getLevel(index));
const { Game } = require('../src/game.js');
const { MOVE_DURATION } = require('../src/motion.js');
const { freshSave, sanitizeSave, SaveRepository, SessionLog, SAVE_KEY, BACKUP_KEY, MAX_EVENTS } = require('../src/storage.js');

function fixture(initial) {
  const data = new Map(initial || []);
  const pending = [];
  let clock = 0;
  let failed = false;
  const platform = {
    storage: { get: key => structuredClone(data.get(key) || null), set(key, value) {
      if (failed) throw new Error('quota'); data.set(key, structuredClone(value));
    } },
    now: () => clock,
    defer: (callback, delay) => pending.push({ callback, at: clock + delay }),
    sound: () => {}, exportText: () => {}
  };
  return { data, platform, fail(value) { failed = value; }, advance(ms = MOVE_DURATION + 140) {
    clock += ms;
    let count = 0;
    while (pending.some(item => item.at <= clock)) {
      const index = pending.findIndex(item => item.at <= clock);
      pending.splice(index, 1)[0].callback();
      assert.ok(++count < 10000, 'bounded scheduled work');
    }
  } };
}

function playing(platform) { const game = new Game(platform); game.startGame(); return game; }

test('launch opens the menu; continue restores the exact board and undo history', () => {
  const f = fixture(); const game = new Game(f.platform);
  assert.equal(game.scene, 'home');
  assert.equal(game.save.hasStarted, false);
  assert.equal(game.tapRow(2), false);
  game.openOverlay('settings'); game.closeOverlay();
  assert.equal(game.scene, 'home');
  assert.equal(game.overlay, null);
  game.startGame(); game.setRun(1);
  game.tapRow(0); game.tapRow(2); f.advance();
  const run = structuredClone(game.run);
  game.goHome();
  assert.deepEqual(game.run, run);
  assert.equal(game.undo(), false);
  const restored = new Game(f.platform);
  assert.equal(restored.scene, 'home');
  assert.equal(restored.save.hasStarted, true);
  restored.startGame();
  assert.deepEqual(restored.run, run);
  assert.ok(restored.undo());
  assert.deepEqual(restored.run.board, LEVELS[1].board);
});

test('completion scheduled before going home stays off the menu and reappears on continue', () => {
  const f = fixture(); const game = playing(f.platform);
  game.tapRow(2); game.tapRow(1); game.goHome(); f.advance();
  assert.equal(game.overlay, null);
  game.openOverlay('settings'); game.closeOverlay();
  assert.equal(game.overlay, null);
  const restored = new Game(f.platform);
  assert.equal(restored.overlay, 'health');
  restored.startGame();
  assert.equal(restored.overlay, 'complete');
  assert.deepEqual(restored.save.clearedLevelIds, [LEVELS[0].id]);
});

test('both channel volumes and switches survive menu navigation and reload independently', () => {
  const f = fixture(); const game = new Game(f.platform);
  game.setVolume('sound', 0.23); game.setVolume('music', 0.81); game.toggleSound();
  const restored = new Game(f.platform);
  assert.deepEqual(restored.save.settings, { soundEnabled: false, soundVolume: 0.23, musicEnabled: true, musicVolume: 0.81 });
  restored.toggleMusic(); restored.setVolume('sound', 1.8); restored.setVolume('music', -1);
  restored.setVolume('music', NaN); restored.setVolume('unknown', 0.8);
  assert.deepEqual(new Game(f.platform).save.settings, { soundEnabled: false, soundVolume: 1, musicEnabled: false, musicVolume: 0 });
});

test('legacy muted saves stay silent, and invalid stored volumes fall back safely', () => {
  const legacy = freshSave(); legacy.settings = { soundEnabled: false };
  assert.deepEqual(sanitizeSave(legacy).save.settings, { soundEnabled: false, soundVolume: 0.65, musicEnabled: false, musicVolume: 0.3 });
  legacy.settings = { soundVolume: Infinity, musicVolume: 'loud' };
  assert.equal(sanitizeSave(legacy).save.settings.musicVolume, 0.3);
  assert.equal(sanitizeSave(legacy).save.settings.soundVolume, 0.65);
});

test('moves only the accessible cat, respects capacity, preserves its input', () => {
  const board = [[0, 1], [1], []];
  assert.deepEqual(move(board, 2, 0, 1), [[0], [1, 1], []]);
  assert.deepEqual(board, [[0, 1], [1], []]);
  assert.equal(move(board, 2, 1, 0), null); // Full destination.
  assert.equal(move([[0], [1], []], 2, 0, 1), null); // Different cat.
  assert.equal(move(board, 2, 2, 0), null);
  assert.equal(move(board, 2, -1, 0), null);
  assert.equal(move(board, 2, 0, 0), null);
});

test('partial homogeneous rows are not complete; full rows and empties are', () => {
  assert.equal(isSolved([[0], [0], []], 2), false);
  assert.equal(isSolved([[0, 0], [1, 1], []], 2), true);
});

test('every level has a replayable complete solution with increasing shortest paths', () => {
  const lengths = [];
  for (const level of LEVELS) {
    assert.ok(validBoard(level.board, level));
    assert.equal(isSolved(level.board, level.capacity), false);
    const result = solve(level.board, level.capacity);
    assert.equal(result.status, 'solved', level.id);
    let board = copyBoard(level.board);
    for (const action of result.path) {
      board = move(board, level.capacity, action.from, action.to);
      assert.ok(board && validBoard(board, level), `${level.id}: valid solution move`);
    }
    assert.ok(isSolved(board, level.capacity));
    lengths.push(result.path.length);
  }
  assert.deepEqual(lengths, [1, 3, 8, 12, 15]);
});

test('search budget is reported separately from a proved deadlock', () => {
  assert.equal(solve(LEVELS[4].board, 4, { maxNodes: 2 }).status, 'limit');
  assert.equal(solve([[0, 1], [1, 0]], 2).status, 'unsolvable');
  const search = createSearch(LEVELS[4].board, 4);
  assert.equal(search.step(1).status, 'searching');
});

test('first level completes once, ignores rapid taps, unlocks next level', () => {
  const f = fixture(); const game = playing(f.platform);
  assert.equal(game.selectLevel(4), false);
  game.tapRow(2); game.tapRow(1);
  assert.ok(isSolved(game.run.board, 3));
  assert.equal(game.run.moves, 1);
  assert.equal(game.tapRow(2), false);
  assert.deepEqual(game.save.clearedLevelIds, [LEVELS[0].id]);
  f.advance(); assert.equal(game.overlay, 'complete');
  assert.equal(game.log.events.filter(item => item.event === 'level_complete').length, 1);
  game.next(); assert.equal(game.levelIndex, 1);
});

test('invalid targets preserve the selection and state; same row cancels', () => {
  const f = fixture(); const game = playing(f.platform);
  game.setRun(1);
  const before = copyBoard(game.run.board);
  game.tapRow(0); game.tapRow(1);
  assert.equal(game.selected, 0);
  assert.deepEqual(game.run.board, before);
  assert.equal(game.run.moves, 0);
  game.tapRow(0); assert.equal(game.selected, null);
});

test('undo history, exact board and sound preference survive reload', () => {
  const f = fixture(); const game = playing(f.platform);
  game.setRun(2); game.tapRow(0); game.tapRow(3); f.advance();
  game.toggleSound();
  const restored = playing(f.platform);
  assert.deepEqual(restored.run, game.run);
  assert.equal(restored.save.settings.soundEnabled, false);
  assert.ok(restored.undo());
  assert.deepEqual(restored.run.board, LEVELS[2].board);
  assert.equal(restored.run.moves, 0);
});

test('restart retains cleared levels and resets the current run', () => {
  const f = fixture(); const game = playing(f.platform);
  game.tapRow(2); game.tapRow(1); f.advance(); game.next();
  game.tapRow(0); game.tapRow(2); f.advance();
  game.restart();
  assert.deepEqual(game.run.board, LEVELS[1].board);
  assert.deepEqual(game.run.history, []);
  assert.deepEqual(game.save.clearedLevelIds, [LEVELS[0].id]);
});

test('hint does not move cats and points to a solvable successor', () => {
  const f = fixture(); const game = playing(f.platform);
  game.setRun(4);
  const before = copyBoard(game.run.board);
  assert.ok(game.requestHint()); f.advance(20);
  assert.ok(game.hint);
  assert.deepEqual(game.run.board, before);
  const next = move(before, game.level.capacity, game.hint.from, game.hint.to);
  assert.equal(solve(next, game.level.capacity).status, 'solved');
});

test('cancelled or backgrounded hint cannot update the current selection', () => {
  const f = fixture(); const game = playing(f.platform);
  game.setRun(4); game.requestHint(); game.pause(); f.advance();
  assert.equal(game.searching, false);
  assert.equal(game.hint, null);
  assert.equal(game.selected, null);
});

test('write failure leaves game playable and can be retried', () => {
  const f = fixture(); const game = playing(f.platform);
  f.fail(true); game.tapRow(2); game.tapRow(1); f.advance();
  assert.ok(isSolved(game.run.board, 3));
  assert.match(game.repository.warning, /保存/);
  f.fail(false); assert.ok(game.persist());
  assert.equal(game.repository.warning, '');
  assert.deepEqual(f.data.get(SAVE_KEY).clearedLevelIds, [LEVELS[0].id]);
});

test('malformed board recovers the level, preserving compatible cleared progress', () => {
  const raw = freshSave(); raw.clearedLevelIds = [LEVELS[0].id, 'removed', LEVELS[0].id];
  raw.currentRun = { levelId: LEVELS[1].id, board: [[99]], history: [], moves: 3 };
  const result = sanitizeSave(raw);
  assert.ok(result.recovered);
  assert.deepEqual(result.save.clearedLevelIds, [LEVELS[0].id]);
  assert.deepEqual(result.save.currentRun.board, LEVELS[1].board);
});

test('old level pack restarts stale board but retains settings', () => {
  const raw = freshSave(); raw.levelPackVersion = PACK_VERSION - 1; raw.settings.soundEnabled = false;
  raw.currentRun = { levelId: LEVELS[0].id, board: [[0, 0, 0], [1, 1, 1], []], history: [], moves: 1 };
  const result = sanitizeSave(raw);
  assert.ok(result.recovered);
  assert.deepEqual(result.save.currentRun.board, LEVELS[0].board);
  assert.equal(result.save.settings.soundEnabled, false);
});

test('invalid undo transitions are rejected instead of restored', () => {
  const raw = freshSave();
  raw.currentRun = { levelId: LEVELS[1].id, board: copyBoard(LEVELS[1].board), history: [[[0, 0, 0], [1, 1, 1], []]], moves: 1 };
  assert.ok(sanitizeSave(raw).recovered);
});

test('parse failure can restore a local backup; fresh cache is also supported', () => {
  const storage = { get(key) { if (key === SAVE_KEY) throw new Error('parse'); return freshSave(); } };
  const repo = new SaveRepository(storage);
  assert.equal(repo.load().save.schemaVersion, 1);
  assert.match(repo.warning, /备份/);
  assert.equal(new SaveRepository({ get: () => null }).load().save.currentRun, null);
});

test('local session log is bounded and exports event data without identity fields', () => {
  const f = fixture(); const log = new SessionLog(f.platform.storage);
  for (let i = 0; i < MAX_EVENTS + 5; i++) log.record('move', { levelId: 'test', moves: i });
  assert.equal(log.events.length, MAX_EVENTS);
  const exported = JSON.parse(log.export());
  assert.equal(exported.events.length, MAX_EVENTS);
  assert.equal(exported.events[0].moves, 5);
  assert.equal(Object.hasOwn(exported.events[0], 'openid'), false);
});

test('all 100 levels can be completed through real game actions, and final next opens replay', () => {
  const f = fixture(); const game = playing(f.platform);
  for (let index = 0; index < ALL_LEVELS.length; index++) {
    const level = getLevel(index);
    assert.equal(game.level.id, level.id);
    const path = level.solution;
    for (const action of path) { game.tapRow(action.from); game.tapRow(action.to); f.advance(); }
    if ((index + 1) % 10 === 0) {
      assert.equal(game.overlay, 'story');
      assert.equal(game.storyChapter, Math.floor(index / 10));
      assert.equal(game.chapterComplete(Math.floor(index / 10)), true);
      assert.equal(game.next(), false, 'story has its own explicit continue action');
      game.finishStory(true);
    } else {
      assert.equal(game.overlay, 'complete');
      game.next();
    }
  }
  assert.equal(game.overlay, 'levels');
  assert.equal(game.save.clearedLevelIds.length, 100);
  assert.deepEqual(game.save.seenStoryChapters, Array.from({ length: 10 }, (_, index) => index));
  assert.ok(game.selectLevel(0));
  assert.ok(sameBoard(game.run.board, LEVELS[0].board));
});

test('progress selection is reachable from home and only unlocked small levels are playable', () => {
  const f = fixture(); const game = new Game(f.platform);
  game.openOverlay('chapters'); game.chooseChapter(9);
  assert.equal(game.overlay, 'levels');
  assert.equal(game.chapterPage, 9);
  assert.equal(game.selectLevel(99), false);
  assert.equal(game.scene, 'home');
  assert.equal(game.openStory(9), false);
  game.chooseChapter(0);
  assert.ok(game.selectLevel(0));
  assert.equal(game.scene, 'game');
  assert.equal(game.save.hasStarted, true);
  assert.equal(game.chooseChapter(10), false);
});

test('switching progress preserves partial puzzles and undo histories through reload', () => {
  const raw = freshSave(); raw.clearedLevelIds = ALL_LEVELS.slice(0, 3).map(level => level.id);
  const f = fixture([[SAVE_KEY, raw]]); const game = playing(f.platform);
  game.tapRow(game.level.solution[0].from); game.tapRow(game.level.solution[0].to); f.advance();
  const campaignRun = structuredClone(game.run);
  assert.ok(game.selectLevel(1));
  game.tapRow(0); game.tapRow(2); f.advance();
  const replayRun = structuredClone(game.run);
  game.goHome();
  const restored = new Game(f.platform);
  assert.ok(restored.selectLevel(3));
  assert.deepEqual(restored.run, campaignRun);
  assert.ok(restored.undo());
  assert.deepEqual(restored.run.board, getLevel(3).board);
  assert.ok(restored.selectLevel(1));
  assert.deepEqual(restored.run, replayRun);
  restored.restart();
  assert.deepEqual(restored.run.board, getLevel(1).board);
  assert.equal(restored.run.moves, 0);
});

test('chapter comics require all ten clears; skip does not gate the next chapter and views persist', () => {
  const raw = freshSave(); raw.clearedLevelIds = ALL_LEVELS.slice(0, 9).map(level => level.id);
  const f = fixture([[SAVE_KEY, raw]]); const game = playing(f.platform);
  assert.equal(game.levelIndex, 9);
  assert.equal(game.openStory(0), false);
  const path = game.level.solution;
  for (const action of path) { game.tapRow(action.from); game.tapRow(action.to); f.advance(); }
  assert.equal(game.overlay, 'story');
  assert.ok(game.available(10));
  game.closeOverlay();
  assert.equal(game.overlay, 'complete');
  assert.deepEqual(game.save.seenStoryChapters, [0]);
  const restored = playing(f.platform);
  assert.equal(restored.overlay, 'complete', 'dismissed comic does not auto-replay');
  restored.goHome(); restored.openOverlay('chapters'); restored.chooseChapter(0);
  assert.ok(restored.openStory(0));
  restored.finishStory(true);
  assert.equal(restored.scene, 'home');
  assert.equal(restored.overlay, 'levels', 're-reading returns to the progress picker');
  assert.equal(restored.levelIndex, 9, 're-reading does not change the active puzzle');
  assert.equal(restored.save.clearedLevelIds.length, 10);
});

test('closing during the first chapter ending restores its unread comic on continue', () => {
  const raw = freshSave(); raw.clearedLevelIds = ALL_LEVELS.slice(0, 9).map(level => level.id);
  const f = fixture([[SAVE_KEY, raw]]); const game = playing(f.platform);
  for (const action of game.level.solution) { game.tapRow(action.from); game.tapRow(action.to); f.advance(); }
  assert.equal(game.overlay, 'story'); game.pause();
  const restored = new Game(f.platform);
  assert.equal(restored.scene, 'home');
  restored.startGame(); assert.equal(restored.overlay, 'story');
  restored.finishStory(true);
  assert.equal(restored.levelIndex, 10);
  assert.equal(restored.overlay, null);
});

test('legacy cleared chapters unlock comics and malformed cached puzzles are isolated', () => {
  const raw = freshSave(); raw.clearedLevelIds = ALL_LEVELS.slice(0, 20).map(level => level.id);
  delete raw.seenStoryChapters; delete raw.savedRuns;
  const f = fixture([[SAVE_KEY, raw]]); const game = new Game(f.platform);
  assert.ok(game.chapterComplete(0)); assert.ok(game.chapterComplete(1));
  assert.ok(game.openStory(1, 'levels'));
  game.finishStory();
  const corrupt = freshSave();
  corrupt.savedRuns = { [LEVELS[1].id]: { levelId: LEVELS[1].id, board: [[99]], history: [], moves: 1 }, unknown: { board: [] } };
  corrupt.seenStoryChapters = [0, 0, 9, -1, '0'];
  const result = sanitizeSave(corrupt);
  assert.equal(result.recovered, true);
  assert.deepEqual(result.save.savedRuns, {});
  assert.deepEqual(result.save.seenStoryChapters, []);
});

test('existing five-level saves restore unchanged and continue into level six', () => {
  const legacy = freshSave();
  legacy.clearedLevelIds = LEVELS.map(level => level.id);
  let board = copyBoard(LEVELS[4].board);
  for (const action of LEVELS[4].solution) board = move(board, 4, action.from, action.to);
  legacy.currentRun = { levelId: LEVELS[4].id, board, history: [], moves: 15 };
  const f = fixture([[SAVE_KEY, legacy]]);
  const game = playing(f.platform);
  assert.equal(game.overlay, 'complete');
  assert.equal(game.repository.warning, '');
  game.next();
  assert.equal(game.levelIndex, 5);
  assert.equal(game.run.levelId, ALL_LEVELS[5].id);
  assert.equal(game.save.clearedLevelIds.length, 5);
});

test('generated level board and undo history survive reload and re-entry', () => {
  const f = fixture(); const game = playing(f.platform);
  game.setRun(98);
  const action = game.level.solution[0];
  game.tapRow(action.from); game.tapRow(action.to); f.advance();
  const board = copyBoard(game.run.board);
  const restored = playing(f.platform);
  assert.deepEqual(restored.run.board, board);
  assert.equal(restored.levelIndex, 98);
  restored.undo();
  assert.deepEqual(restored.run.board, getLevel(98).board);
});

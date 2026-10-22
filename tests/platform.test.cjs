'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { SAVE_KEY } = require('../src/storage.js');
const { GAME_NAME } = require('../src/brand.js');

test('Douyin bundle boots without DOM and handles native canvas touches and lifecycle', () => {
  const root = path.resolve(__dirname, '..');
  execFileSync(process.execPath, ['scripts/build.cjs'], { cwd: root });
  const storage = new Map(); const frames = []; const timers = []; const labels = []; const tracks = [];
  const ctx = new Proxy({}, { get(target, key) {
    if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (key === 'fillText') return value => labels.push(value);
    return target[key] || (() => {});
  }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { getContext: () => ctx };
  let touch, touchMove, touchEnd, hide, show;
  let clock = 0;
  class Clock extends Date { static now() { return clock; } }
  const sandbox = {
    Date: Clock, Math, JSON, Map, Set, console,
    requestAnimationFrame: callback => frames.push(callback),
    setTimeout: callback => timers.push(callback),
    tt: {
      createCanvas: () => canvas,
      getStorageSync: key => structuredClone(storage.get(key)),
      setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
      getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2, safeArea: { top: 24, bottom: 824 } }),
      onTouchStart: callback => { touch = callback; },
      onTouchMove: callback => { touchMove = callback; },
      onTouchEnd: callback => { touchEnd = callback; },
      onHide: callback => { hide = callback; },
      onShow: callback => { show = callback; },
      createInnerAudioContext: () => {
        const track = { paused: true, onError() {}, stop() { this.paused = true; }, pause() { this.paused = true; }, play() { this.paused = false; } };
        tracks.push(track); return track;
      }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/douyin/game.js'), 'utf8'), sandbox);
  assert.equal(canvas.width, 780); assert.equal(canvas.height, 1688);
  frames.shift()();
  assert.ok(labels.includes(GAME_NAME));
  assert.ok(labels.includes('开始游戏'));
  assert.equal(tracks.length, 0, 'opening the menu does not autoplay');
  const scale = 390 / 400;
  const height = 844 / scale;
  const top = 24 / scale;
  const bottom = 20 / scale;
  const healthY = Math.max(top + 30, (height - 448) / 2);
  touch({ touches: [{ clientX: 195, clientY: (healthY + 368) * scale }] }); touchEnd(); frames.shift()();
  assert.ok(labels.includes('健康游戏忠告'));
  const homeCardY = Math.max(top + 155, Math.min(top + 205, height * 0.235));
  touch({ touches: [{ clientX: 195, clientY: (homeCardY + 260) * scale }] }); touchEnd(); frames.shift()();
  const music = tracks.find(track => track.loop);
  assert.ok(music && !music.paused);
  const gap = Math.min(79, (height - bottom - 158 - top - 245) / 3);
  const start = top + 245 + Math.max(0, (height - bottom - 158 - top - 245 - gap * 3) / 2);
  for (const row of [2, 1]) touch({ touches: [{ clientX: 195, clientY: (start + gap * (row + 0.5)) * scale }] });
  assert.deepEqual(storage.get(SAVE_KEY).clearedLevelIds, ['first-paw']);
  hide(); assert.ok(music.paused);
  clock = 1000; timers.forEach(callback => callback()); show(); assert.equal(music.paused, false); frames.shift()();
  assert.ok(labels.includes('这一屋，整整齐齐。'));
  assert.equal(storage.get(SAVE_KEY).currentRun.moves, 1);
  // Visit settings from the menu and drag the native music volume slider.
  // A solved board resumes with its completion sheet; menu navigation is checked separately below.
  touch({ touches: [{ clientX: 100 * scale, clientY: ((height - 365) / 2 + 303) * scale }] }); touchEnd(); frames.shift()();
  const actionY = height - bottom - 113;
  touch({ touches: [{ clientX: 200 * scale, clientY: (actionY + 81) * scale }] }); touchEnd(); frames.shift()();
  assert.ok(labels.includes('继续游戏'));
  touch({ touches: [{ clientX: 280 * scale, clientY: (height - bottom - 83) * scale }] }); touchEnd(); frames.shift()();
  const sheetY = Math.max(top + 30, (height - 520) / 2);
  touch({ touches: [{ clientX: 100 * scale, clientY: (sheetY + 247) * scale }] });
  touchMove({ touches: [{ clientX: 270 * scale, clientY: (sheetY + 247) * scale }] }); touchEnd();
  assert.equal(storage.get(SAVE_KEY).settings.musicVolume, 0.75);
  assert.equal(music.volume, 0.75);
  assert.equal(storage.get(SAVE_KEY).settings.soundVolume, 0.65);
  for (const name of ['move', 'row', 'win', 'music']) {
    const audio = fs.readFileSync(path.join(root, 'dist/douyin/audio', `${name}.wav`));
    assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
  }
});

test('Douyin bundle renders each unlocked comic and continues to the next big chapter', () => {
  const { LEVELS, getLevel, PACK_VERSION } = require('../src/levels.js');
  const { STORIES } = require('../src/story.js');
  const { move, copyBoard } = require('../src/core.js');
  const root = path.resolve(__dirname, '..');
  const bundle = fs.readFileSync(path.join(root, 'dist/douyin/game.js'), 'utf8');
  for (let chapter = 0; chapter < 10; chapter++) {
    const level = getLevel(chapter * 10 + 9);
    let board = copyBoard(level.board);
    for (const action of level.solution) board = move(board, level.capacity, action.from, action.to);
    const storage = new Map([[SAVE_KEY, { schemaVersion: 1, levelPackVersion: PACK_VERSION,
      clearedLevelIds: LEVELS.slice(0, (chapter + 1) * 10).map(item => item.id),
      settings: { soundEnabled: false }, currentRun: { levelId: level.id, board, history: [], moves: level.solution.length } }]]);
    const frames = [], labels = [];
    const ctx = new Proxy({}, { get(target, key) {
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'fillText') return value => labels.push(value);
      return target[key] || (() => {});
    }, set(target, key, value) { target[key] = value; return true; } });
    let touch;
    vm.runInNewContext(bundle, {
      Date, Math, JSON, Map, Set, console,
      requestAnimationFrame: callback => frames.push(callback), setTimeout() {},
      tt: {
        createCanvas: () => ({ getContext: () => ctx }),
        getStorageSync: key => structuredClone(storage.get(key)),
        setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
        getSystemInfoSync: () => ({ windowWidth: 400, windowHeight: 800, pixelRatio: 1, safeArea: { top: 20, bottom: 780 } }),
        onTouchStart: callback => { touch = callback; }, onHide() {}, onShow() {}
      }
    });
    frames.shift()();
    const healthY = Math.max(20 + 30, (800 - 448) / 2);
    touch({ touches: [{ clientX: 200, clientY: healthY + 368 }] }); frames.shift()();
    const homeCardY = Math.max(20 + 155, Math.min(20 + 205, 800 * 0.235));
    touch({ touches: [{ clientX: 200, clientY: homeCardY + 260 }] }); frames.shift()();
    assert.ok(labels.includes(STORIES[chapter].title));
    STORIES[chapter].panels.forEach(panel => panel.forEach(value => assert.ok(labels.includes(value), value)));
    const storyY = Math.max(36, (800 - 20 - 610) / 2);
    touch({ touches: [{ clientX: 200, clientY: storyY + 520 }] }); frames.shift()();
    assert.deepEqual(storage.get(SAVE_KEY).seenStoryChapters, [chapter]);
    if (chapter < 9) assert.equal(storage.get(SAVE_KEY).currentRun.levelId, LEVELS[(chapter + 1) * 10].id);
    else assert.ok(labels.includes('小关与剧情'));
  }
});

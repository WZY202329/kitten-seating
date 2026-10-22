'use strict';
// Optional local Chromium smoke test using Node's built-in CDP/WebSocket support.
// No npm packages, external websites or user browser profile are used.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { LEVELS: ALL_LEVELS, getLevel } = require('../src/levels.js');
const LEVELS = Array.from({ length: 5 }, (_, index) => getLevel(index));
const { solve, sameBoard } = require('../src/core.js');
const { SAVE_KEY } = require('../src/storage.js');
const { MOVE_DURATION } = require('../src/motion.js');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'artifacts');
const executable = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1243/chrome-win64/chrome.exe');
if (!fs.existsSync(executable)) throw new Error('Set CHROME_PATH to an installed Chromium/Chrome executable.');
fs.mkdirSync(artifacts, { recursive: true });
const profile = fs.mkdtempSync(path.join(artifacts, 'browser-profile-'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, server, socket;
const exceptions = [];

(async () => {
  const serverPort = 4175;
  server = spawn(process.execPath, ['scripts/serve.cjs'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: String(serverPort) }, stdio: 'pipe' });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error(`Server exited: ${code}`)));
  });
  browser = spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 200; i++) {
    try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); if (port) break; } catch (_) { /* Startup in progress. */ }
    await wait(100);
  }
  if (!port) throw new Error('Chromium did not expose a debugging port.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id); pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression, userGesture = false) => {
    const result = await send('Runtime.evaluate', { expression, userGesture, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression, timeout = 5000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await wait(40); }
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async label => {
    await until(`Array.from(document.querySelectorAll('#game-controls button')).some(b => b.textContent === ${JSON.stringify(label)})`);
    assert.ok(await evaluate(`(() => {const b=Array.from(document.querySelectorAll('#game-controls button')).find(b=>b.textContent===${JSON.stringify(label)});if(!b)return false;b.click();return true;})()`, true));
    await wait(45);
  };
  const readSave = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`);
  const screenshot = async name => {
    await wait(100);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifacts, name), Buffer.from(shot.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Page.enable');
  if (process.argv.includes('--icon')) {
    await send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/app-icon.html` });
    await until(`document.getElementById('app-icon') && document.getElementById('app-icon').dataset.ready === 'true'`);
    const encoded = await evaluate(`document.getElementById('app-icon').toDataURL('image/png').split(',')[1]`);
    const png = Buffer.from(encoded, 'base64');
    assert.equal(png.readUInt32BE(16), 600); assert.equal(png.readUInt32BE(20), 600);
    assert.ok(png.length < 6 * 1024 * 1024);
    assert.ok(await evaluate(`(() => {const c=document.getElementById('app-icon'); const p=c.getContext('2d').getImageData(0,0,600,600).data; for(let i=3;i<p.length;i+=4)if(p[i]!==255)return false; return true;})()`));
    const destination = path.join(root, 'assets', 'branding');
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'icon-600.png'), png);
    assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
    console.log(`Exported 600x600 opaque PNG: assets/branding/icon-600.png (${png.length} bytes)`);
    await send('Browser.close').catch(() => {});
    return;
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/` });
  await until(`document.querySelectorAll('#game-controls button').length > 0`);
  assert.equal(await evaluate(`document.querySelectorAll('audio').length`), 0, 'menu waits for interaction before creating audio');
  await screenshot('mobile-health-notice.png');
  await click('知道了');
  await screenshot('mobile-main-menu.png');
  await click('选择进度');
  await screenshot('mobile-progress-chapters.png');
  await click('大关2：午后窗台');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('#game-controls button')).filter(b=>b.textContent.startsWith('小关2-')).length`), 0, 'locked chapters cannot be played');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('#game-controls button')).some(b=>b.textContent==='阅读本章漫画')`), false);
  await screenshot('mobile-locked-chapter.png');
  await click('大关目录'); await click('大关1：初来小屋'); await click('小关1-1：初次见面');
  await until(`document.querySelector('audio[data-audio-kind="music"]') && !document.querySelector('audio[data-audio-kind="music"]').paused`);
  await click('返回主菜单');
  await click('声音与设置');
  const menuRect = await evaluate(`(() => {const r=document.getElementById('game').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  const sheetY = Math.max(30, (menuRect.h / menuRect.w * 400 - 520) / 2);
  const dragVolume = async (offset, from, to) => {
    const y = menuRect.y + (sheetY + offset) * menuRect.w / 400;
    const x = value => menuRect.x + (60 + 280 * value) * menuRect.w / 400;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x(from), y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x(to), y, button: 'left', buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x(to), y, button: 'left', clickCount: 1 });
    await wait(80);
  };
  await dragVolume(146, 0.65, 0.37);
  await dragVolume(247, 0.3, 0.12);
  assert.equal((await readSave()).settings.soundVolume, 0.37);
  assert.equal((await readSave()).settings.musicVolume, 0.12);
  assert.equal(await evaluate(`document.querySelector('audio[data-audio-kind="music"]').volume`), 0.12);
  assert.equal(await evaluate(`document.querySelector('audio[data-audio-kind="move"]').volume`), 0.37);
  await screenshot('mobile-sound-settings.png');
  await click('音效：开'); await click('音乐：开');
  assert.ok(await evaluate(`document.querySelector('audio[data-audio-kind="music"]').paused`));
  await click('关闭');
  await send('Page.reload');
  await click('知道了');
  await until(`Array.from(document.querySelectorAll('#game-controls button')).some(b=>b.textContent==='继续游戏')`);
  assert.equal(await evaluate(`document.querySelectorAll('audio').length`), 0);
  assert.deepEqual((await readSave()).settings, { soundEnabled: false, soundVolume: 0.37, musicEnabled: false, musicVolume: 0.12 });
  await click('声音与设置');
  assert.equal(await evaluate(`document.querySelectorAll('audio').length`), 0, 'muted saved preferences stay silent on interaction');
  await click('音效：关'); await click('音乐：关');
  await until(`document.querySelector('audio[data-audio-kind="music"]') && !document.querySelector('audio[data-audio-kind="music"]').paused`);
  await click('关闭'); await click('继续游戏');
  await screenshot('mobile-level-1.png');
  const recording = await evaluate(`(() => {
    const canvas = document.getElementById('game');
    if (!canvas.captureStream || !window.MediaRecorder) return false;
    const stream = canvas.captureStream(30);
    const chunks = [];
    const recorder = new MediaRecorder(stream, {mimeType:'video/webm'});
    const stopped = new Promise(resolve => recorder.addEventListener('stop', () => {
      const reader = new FileReader();
      reader.onload = () => { stream.getTracks().forEach(t=>t.stop()); resolve(reader.result.split(',')[1]); };
      reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));
    }, {once:true}));
    recorder.addEventListener('dataavailable', e => {if(e.data.size)chunks.push(e.data);});
    window.__artRecording = {recorder,stopped}; recorder.start(); return true;
  })()`);
  await wait(650);
  // First move uses real canvas pointer coordinates, not a test-only game hook.
  const geometry = await evaluate(`(() => {const r=document.getElementById('game').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  const logicalHeight = geometry.h / geometry.w * 400;
  const gap = Math.min(79, (logicalHeight - 158 - 245) / 3);
  const start = 245 + Math.max(0, (logicalHeight - 158 - 245 - gap * 3) / 2);
  const canvasClick = async row => {
    const x = geometry.x + geometry.w / 2;
    const y = geometry.y + (start + gap * (row + 0.5)) * geometry.w / 400;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await wait(60);
  };
  await canvasClick(2); await canvasClick(1);
  await screenshot('cat-jump-in-flight.png');
  await until(`document.getElementById('game-status').textContent.includes('已通关')`);
  if (recording) {
    await wait(650);
    const clip = await evaluate(`(() => {const recording=window.__artRecording;recording.recorder.stop();return recording.stopped;})()`);
    fs.writeFileSync(path.join(artifacts, 'cat-motion.webm'), Buffer.from(clip, 'base64'));
  }
  await click('去下一关');
  for (let index = 1; index < LEVELS.length; index++) {
    let save = await readSave();
    assert.equal(save.currentRun.levelId, LEVELS[index].id);
    if (index === 1) {
      await click('第1排'); await click('第3排'); await wait(MOVE_DURATION + 30);
      const before = await readSave();
      await send('Page.reload');
      await click('知道了');
      await until(`document.querySelectorAll('#game-controls button').length > 0`);
      save = await readSave();
      assert.ok(sameBoard(save.currentRun.board, before.currentRun.board), 'reload restores exact board');
      await click('继续游戏');
      await click('撤回');
      save = await readSave();
      assert.ok(sameBoard(save.currentRun.board, LEVELS[index].board), 'undo history survives page reload');
    }
    if (index === 4) {
      await screenshot('mobile-level-5.png');
      await click('小提示');
      await until(`!Array.from(document.querySelectorAll('#game-controls button')).some(b=>b.textContent==='取消')`);
      await screenshot('mobile-hint.png');
      // Cancel the hint's selected source so the test follows its own solution.
      // Reading the text only determines the highlighted row; moves remain normal UI actions.
      const solution = solve(save.currentRun.board, LEVELS[index].capacity);
      await click(`第${solution.path[0].from + 1}排`);
    }
    const solution = solve(save.currentRun.board, LEVELS[index].capacity);
    for (const action of solution.path) {
      await click(`第${action.from + 1}排`); await click(`第${action.to + 1}排`); await wait(MOVE_DURATION + 30);
    }
    await until(`document.getElementById('game-status').textContent.includes('已通关')`);
    if (index < 4) await click('去下一关');
  }
  assert.equal((await readSave()).clearedLevelIds.length, 5);
  // Level 5 is no longer an ending. A v0.1 player must be able to continue.
  await click('去下一关');
  assert.equal((await readSave()).currentRun.levelId, ALL_LEVELS[5].id);
  await screenshot('mobile-level-6.png');
  await click('选择关卡');
  await screenshot('mobile-levels.png');
  await click('›');
  await screenshot('mobile-chapter-2.png');
  await click('回到当前关卡');
  // An isolated chapter-end fixture verifies the first automatic comic and skip.
  const chapterEnd = getLevel(9);
  const chapterFixture = { schemaVersion: 1, levelPackVersion: 1, clearedLevelIds: ALL_LEVELS.slice(0, 9).map(level => level.id),
    settings: { soundEnabled: false }, currentRun: { levelId: chapterEnd.id, board: chapterEnd.board, history: [], moves: 0 } };
  const chapterFixtureScript = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(${JSON.stringify(chapterFixture)}))`
  });
  await send('Page.reload');
  await click('知道了');
  await until(`document.getElementById('game-status').textContent.includes('第10关')`);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: chapterFixtureScript.identifier });
  await click('继续游戏');
  for (const action of chapterEnd.solution) {
    await click(`第${action.from + 1}排`); await click(`第${action.to + 1}排`); await wait(MOVE_DURATION + 30);
  }
  await until(`document.getElementById('game-status').textContent.includes('漫画：门口的第一声喵')`);
  await screenshot('mobile-first-chapter-comic.png');
  await click('跳过剧情 · 返回通关');
  assert.deepEqual((await readSave()).seenStoryChapters, [0]);
  await click('去下一关');
  assert.equal((await readSave()).currentRun.levelId, ALL_LEVELS[10].id, 'skipping comic still unlocks chapter 2');
  // Isolated test-profile fixture: exercise late-game layout and final unlocks
  // without making the smoke test wait through 100 animation sequences.
  const last = getLevel(99);
  const fixture = { schemaVersion: 1, levelPackVersion: 1, clearedLevelIds: ALL_LEVELS.slice(0, 99).map(level => level.id),
    settings: { soundEnabled: false }, currentRun: { levelId: last.id, board: last.board, history: [], moves: 0 } };
  // Seed after pagehide saves the departing run, before the next app boots.
  const fixtureScript = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(${JSON.stringify(fixture)}))`
  });
  await send('Page.reload');
  await click('知道了');
  await until(`document.getElementById('game-status').textContent.includes('第100关')`);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixtureScript.identifier });
  await click('继续游戏');
  await screenshot('mobile-level-100.png');
  await click('小提示');
  await until(`!Array.from(document.querySelectorAll('#game-controls button')).some(b=>b.textContent==='取消')`);
  await screenshot('mobile-hint-100.png');
  await click(`第${last.solution[0].from + 1}排`);
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await wait(150); await screenshot('small-phone-100.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(100);
  for (const action of last.solution) {
    await click(`第${action.from + 1}排`); await click(`第${action.to + 1}排`); await wait(MOVE_DURATION + 30);
  }
  await until(`document.getElementById('game-status').textContent.includes('已通关')`);
  assert.equal((await readSave()).clearedLevelIds.length, 100);
  await screenshot('comic-chapter-10.png');
  await click('回到进度选择');
  await screenshot('mobile-chapter-10.png');
  const { CHAPTERS } = require('../src/levels.js');
  await click('大关目录');
  for (let chapter = 0; chapter < 10; chapter++) {
    await click(`大关${chapter + 1}：${CHAPTERS[chapter]}`);
    await click('阅读本章漫画');
    await screenshot(`comic-chapter-${chapter + 1}.png`);
    if (chapter === 0) {
      await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
      await screenshot('small-phone-comic.png');
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    }
    await click('返回进度');
    assert.equal((await readSave()).currentRun.levelId, ALL_LEVELS[99].id, 'comic replays do not change level progress');
    await click('大关目录');
  }
  await click('大关1：初来小屋'); await click('小关1-1：初次见面');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await wait(150); await screenshot('small-phone.png');
  await click('返回主菜单');
  await screenshot('small-phone-menu.png');
  await click('选择进度'); await screenshot('small-phone-progress.png');
  await click('大关10：一起回家'); await screenshot('small-phone-small-levels.png'); await click('返回主菜单');
  await click('声音与设置'); await screenshot('small-phone-settings.png'); await click('关闭');
  await click('继续游戏');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(150); await screenshot('desktop.png');
  await click('设置');
  await screenshot('settings.png');
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log('Browser verification passed: big/small progress selection and locks, automatic chapter comic/skip, all 10 comic replays, menu/continue, independent audio, canvas touch, tutorial/100-level progression, 360×640 and desktop layouts.');
  console.log(`Screenshots: ${artifacts}`);
  await send('Browser.close').catch(() => {});
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  if (socket) socket.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server && server.exitCode === null) server.kill();
});

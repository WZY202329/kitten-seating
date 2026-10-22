'use strict';

const { Game } = require('./game.js');
const { View } = require('./view.js');
const { AudioMixer } = require('./audio.js');
const { STORIES, levelLabel } = require('./story.js');
const { AGE_RATING, HEALTH_ADVICE } = require('./health.js');
const canvas = document.getElementById('game');
const accessibility = document.getElementById('game-controls');
const audio = new AudioMixer((name, onError) => {
  const element = document.createElement('audio');
  element.src = `./audio/${name}.wav`;
  element.dataset.audioKind = name;
  element.loop = name === 'music';
  element.hidden = true;
  element.addEventListener('error', onError);
  document.body.appendChild(element);
  return {
    set volume(value) { element.volume = value; },
    play: () => element.play(),
    pause: () => element.pause(),
    stop() { element.pause(); element.currentTime = 0; }
  };
});
let lastAccessible = '';
const platform = {
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  storage: {
    get(key) { const raw = localStorage.getItem(key); return raw === null ? null : JSON.parse(raw); },
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  },
  now: () => performance.now(),
  frame: callback => requestAnimationFrame(callback),
  defer: (callback, ms) => setTimeout(callback, ms),
  sound: kind => audio.sound(kind),
  configureAudio: settings => audio.configure(settings),
  setAudioActive: active => audio.setActive(active),
  exportText(value, name) {
    const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  updateAccessibility(targets, game) {
    const key = JSON.stringify(targets.map(t => t.label)) + game.scene + game.levelIndex + game.run.moves + game.overlay + game.selected + game.chapterPage + game.storyChapter;
    if (key === lastAccessible) {
      targets.filter(t => t.range).forEach(target => {
        const input = [...accessibility.querySelectorAll('input')].find(input => input.getAttribute('aria-label') === target.label);
        if (input) input.value = String(target.range.value);
      });
      return;
    }
    lastAccessible = key;
    const focus = accessibility.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') || document.activeElement.textContent : null;
    accessibility.replaceChildren();
    targets.forEach(target => {
      const control = document.createElement(target.range ? 'input' : 'button');
      if (target.range) {
        control.type = 'range'; control.min = '0'; control.max = '100'; control.step = '1';
        control.value = String(target.range.value); control.setAttribute('aria-label', target.label);
        control.addEventListener('input', () => { audio.unlock(); target.range.change(Number(control.value) / 100); });
        control.addEventListener('change', () => { if (target.release) target.release(); });
      } else {
        control.textContent = target.label;
        control.addEventListener('click', () => { audio.unlock(); target.action(); });
      }
      accessibility.appendChild(control);
      if (focus === target.label) control.focus({ preventScroll: true });
    });
    const status = document.getElementById('game-status');
    if (game.overlay === 'health') {
      status.textContent = `适龄提示：适合${AGE_RATING}周岁及以上用户，未成年人请在监护人指导下使用。健康游戏忠告：${HEALTH_ADVICE.join('')}`;
    } else if (game.overlay === 'story') {
      const story = STORIES[game.storyChapter];
      status.textContent = `第${game.storyChapter + 1}大关已通关。漫画：${story.title}。${story.panels.map(panel => panel.join(' ')).join(' ')} ${story.next}`;
    } else if (game.overlay === 'chapters') status.textContent = `选择进度：10 个大关，每个 10 个小关。已完成 ${game.save.clearedLevelIds.length}/100。`;
    else if (game.overlay === 'levels') status.textContent = `第${game.chapterPage + 1}大关，已完成${game.chapterProgress(game.chapterPage)}/10个小关。`;
    else status.textContent = game.scene === 'home' ? `主菜单，${game.save.hasStarted ? '继续' : '开始'}第${game.levelIndex + 1}关。` : `第${game.levelIndex + 1}关：${game.level.name}，小关${levelLabel(game.levelIndex)}，${game.run.moves}步。${game.overlay === 'complete' ? '已通关。' : ''}`;
  }
};
const game = new Game(platform);
const view = new View(canvas, game, platform);
function resize() {
  const rect = canvas.getBoundingClientRect();
  view.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 3));
}
canvas.addEventListener('pointerdown', event => {
  event.preventDefault();
  audio.unlock();
  canvas.setPointerCapture(event.pointerId);
  const rect = canvas.getBoundingClientRect();
  view.tap(event.clientX - rect.left, event.clientY - rect.top);
});
canvas.addEventListener('pointermove', event => {
  const rect = canvas.getBoundingClientRect();
  view.pointerMove(event.clientX - rect.left, event.clientY - rect.top);
});
canvas.addEventListener('pointerup', () => view.pointerEnd());
canvas.addEventListener('pointercancel', () => view.pointerEnd(false));
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden) { view.pointerEnd(false); game.pause(); } else game.resume(); });
window.addEventListener('pagehide', () => game.pause());
window.addEventListener('pageshow', () => { if (!document.hidden) game.resume(); });
resize(); view.start();

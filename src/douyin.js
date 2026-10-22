'use strict';

const { Game } = require('./game.js');
const { View } = require('./view.js');
const { AudioMixer } = require('./audio.js');
const canvas = tt.createCanvas();
const audio = new AudioMixer((name, onError) => {
  const track = tt.createInnerAudioContext();
  track.src = `audio/${name}.wav`;
  track.loop = name === 'music';
  track.onError(onError);
  return track;
});
const platform = {
  reducedMotion: false,
  storage: { get: key => tt.getStorageSync(key), set: (key, value) => tt.setStorageSync(key, value) },
  now: () => Date.now(),
  frame: callback => requestAnimationFrame(callback),
  defer: (callback, ms) => setTimeout(callback, ms),
  sound: kind => audio.sound(kind),
  configureAudio: settings => audio.configure(settings),
  setAudioActive: active => audio.setActive(active),
  exportText(value) {
    tt.setClipboardData({ data: value, success() { tt.showToast({ title: '试玩记录已复制', icon: 'none' }); },
      fail() { tt.showToast({ title: '复制未成功，请稍后重试', icon: 'none' }); } });
  }
};
const game = new Game(platform);
const view = new View(canvas, game, platform);
function resize() {
  const info = tt.getSystemInfoSync();
  const safe = info.safeArea;
  const safeTop = safe ? safe.top : 0;
  const safeBottom = safe ? Math.max(0, info.windowHeight - safe.bottom) : 0;
  view.resize(info.windowWidth, info.windowHeight, info.pixelRatio || 1, safeTop, safeBottom);
}
tt.onTouchStart(event => {
  const touch = event.touches && event.touches[0];
  if (touch) { audio.unlock(); view.tap(touch.clientX, touch.clientY); }
});
if (tt.onTouchMove) tt.onTouchMove(event => {
  const touch = event.touches && event.touches[0];
  if (touch) view.pointerMove(touch.clientX, touch.clientY);
});
if (tt.onTouchEnd) tt.onTouchEnd(() => view.pointerEnd());
if (tt.onTouchCancel) tt.onTouchCancel(() => view.pointerEnd(false));
tt.onHide(() => { view.pointerEnd(false); game.pause(); });
tt.onShow(() => { game.resume(); resize(); view.dirty = true; });
if (tt.onWindowResize) tt.onWindowResize(resize);
resize(); view.start();

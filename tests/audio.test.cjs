'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AudioMixer } = require('../src/audio.js');

function mixerFixture() {
  const tracks = new Map();
  const mixer = new AudioMixer(name => {
    const track = { plays: 0, paused: true, volume: 1,
      play() { this.plays++; this.paused = false; },
      pause() { this.paused = true; }, stop() { this.paused = true; } };
    tracks.set(name, track); return track;
  });
  return { tracks, mixer };
}

test('music waits for interaction, loops without restarting on settings changes, and pauses in background', () => {
  const { mixer, tracks } = mixerFixture();
  mixer.configure({ musicVolume: 0.2 }); mixer.setActive(true);
  assert.equal(tracks.size, 0);
  mixer.unlock();
  const music = tracks.get('music');
  assert.equal(music.volume, 0.2); assert.equal(music.plays, 1);
  mixer.configure({ musicVolume: 0.48, soundVolume: 0.9 }); mixer.unlock();
  assert.equal(music.volume, 0.48); assert.equal(music.plays, 1);
  mixer.setActive(false); assert.ok(music.paused);
  mixer.sound('win'); assert.equal(tracks.has('win'), false);
  mixer.setActive(true); assert.equal(music.plays, 2);
  mixer.configure({ musicEnabled: false }); assert.ok(music.paused);
  mixer.setActive(false); mixer.setActive(true); assert.ok(music.paused);
});

test('effects and music have independent gains and mutes; zero volume is silent', () => {
  const { mixer, tracks } = mixerFixture();
  mixer.configure({ soundVolume: 0.7, musicVolume: 0.15 }); mixer.unlock(); mixer.sound('move');
  const music = tracks.get('music'), effect = tracks.get('move');
  assert.equal(effect.volume, 0.7); assert.equal(music.volume, 0.15);
  mixer.configure({ soundEnabled: false, musicEnabled: true, musicVolume: 0.15 });
  assert.ok(effect.paused); assert.equal(effect.volume, 0); assert.equal(music.paused, false);
  mixer.sound('win'); assert.equal(tracks.has('win'), false);
  mixer.configure({ musicVolume: 0, soundVolume: 0.21 });
  mixer.sound('row'); assert.equal(tracks.get('row').volume, 0.21); assert.ok(music.paused);
  mixer.configure({ musicVolume: 0.3, soundVolume: 0 });
  assert.equal(music.paused, false); assert.ok(tracks.get('row').paused);
  mixer.sound('win'); assert.equal(tracks.has('win'), false);
});

test('an autoplay rejection can retry on a later gesture without breaking gameplay', async () => {
  let calls = 0;
  const mixer = new AudioMixer(() => ({ pause() {}, play() { calls++; return calls === 1 ? Promise.reject(new Error('autoplay')) : Promise.resolve(); } }));
  mixer.unlock(); await Promise.resolve();
  assert.equal(mixer.musicPlaying, false);
  mixer.unlock(); await Promise.resolve();
  assert.equal(mixer.musicPlaying, true);
  assert.equal(calls, 2);
});

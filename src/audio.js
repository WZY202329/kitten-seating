'use strict';

const DEFAULT_AUDIO = { soundEnabled: true, soundVolume: 0.65, musicEnabled: true, musicVolume: 0.3 };

function audioSettings(raw = {}) {
  const result = { ...DEFAULT_AUDIO };
  for (const key of ['soundEnabled', 'musicEnabled']) if (typeof raw[key] === 'boolean') result[key] = raw[key];
  for (const key of ['soundVolume', 'musicVolume']) {
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) result[key] = Math.max(0, Math.min(1, raw[key]));
  }
  // Honor the mute choice in saves made before separate music controls existed.
  if (!Object.hasOwn(raw, 'musicEnabled') && raw.soundEnabled === false) result.musicEnabled = false;
  return result;
}

// A single mixer owns both channels. Drivers only implement local media playback.
class AudioMixer {
  constructor(createTrack) {
    this.createTrack = createTrack;
    this.settings = audioSettings();
    this.tracks = new Map();
    this.unlocked = false;
    this.active = true;
    this.musicPlaying = false;
    this.musicAttempt = 0;
  }
  track(name) {
    if (!this.tracks.has(name)) {
      const track = this.createTrack(name, () => { if (name === 'music') this.musicPlaying = false; });
      this.tracks.set(name, track);
    }
    return this.tracks.get(name);
  }
  configure(settings) {
    this.settings = audioSettings(settings);
    const volume = this.settings.soundEnabled ? this.settings.soundVolume : 0;
    for (const [name, track] of this.tracks) {
      if (name === 'music') continue;
      track.volume = volume;
      if (!volume) track.pause();
    }
    this.syncMusic();
  }
  unlock() { this.unlocked = true; this.syncMusic(); }
  setActive(active) {
    this.active = active;
    if (!active) for (const [name, track] of this.tracks) if (name !== 'music') track.pause();
    this.syncMusic();
  }
  syncMusic() {
    const enabled = this.unlocked && this.active && this.settings.musicEnabled && this.settings.musicVolume > 0;
    if (!enabled) {
      this.musicAttempt++;
      this.musicPlaying = false;
      const track = this.tracks.get('music');
      if (track) track.pause();
      return;
    }
    try {
      const track = this.track('music');
      track.volume = this.settings.musicVolume;
      if (this.musicPlaying) return;
      this.musicPlaying = true;
      const attempt = ++this.musicAttempt;
      const playing = track.play();
      if (playing && playing.catch) playing.catch(() => { if (this.musicAttempt === attempt) this.musicPlaying = false; });
    } catch (_) { this.musicPlaying = false; }
  }
  sound(kind) {
    if (!['move', 'row', 'win'].includes(kind) || !this.active || !this.unlocked || !this.settings.soundEnabled || !this.settings.soundVolume) return;
    try {
      const track = this.track(kind);
      track.volume = this.settings.soundVolume;
      track.stop();
      const playing = track.play();
      if (playing && playing.catch) playing.catch(() => {});
    } catch (_) { /* Unavailable audio never interrupts a puzzle. */ }
  }
}

module.exports = { DEFAULT_AUDIO, audioSettings, AudioMixer };

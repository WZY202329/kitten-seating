'use strict';
// Original synthesized piano-like loop and feedback tones; no external assets.
const RATE = 16000;
function wav(samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF'); data.writeUInt32LE(36 + samples.length * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(RATE, 24); data.writeUInt32LE(RATE * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  return data;
}
function audioAssets() {
  const assets = {};
  for (const [name, notes] of Object.entries({ move: [523], row: [659, 784], win: [523, 659, 784] })) {
    const samples = new Float32Array(Math.floor(RATE * (notes.length * 0.11 + 0.15)));
    for (let i = 0; i < samples.length; i++) {
      const time = i / RATE;
      notes.forEach((note, j) => {
        const t = time - j * 0.11;
        if (t >= 0 && t < 0.22) samples[i] += Math.sin(t * note * Math.PI * 2) * Math.min(1, t / 0.015) * Math.pow(1 - t / 0.22, 2) * 0.2;
      });
    }
    assets[name] = wav(samples);
  }
  const beat = 60 / 82;
  const music = new Float32Array(Math.round(RATE * beat * 32));
  const frequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const note = (midi, start, duration, amplitude) => {
    for (let i = 0; i < duration * RATE; i++) {
      const t = i / RATE;
      const f = frequency(midi);
      const envelope = Math.min(1, t / 0.012) * Math.exp(-t * 3.5 / duration) * Math.pow(1 - t / duration, 2);
      const tone = Math.sin(2 * Math.PI * f * t) + 0.19 * Math.sin(4 * Math.PI * f * t) * Math.exp(-3 * t);
      // Fold release tails across the loop boundary to keep the seam continuous.
      music[(Math.round(start * RATE) + i) % music.length] += tone * envelope * amplitude;
    }
  };
  const chords = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]];
  const melody = [[72, 76, 79, 76, 74, 72], [72, 69, 76, 74, 72, 69], [69, 72, 77, 76, 72, 69], [71, 74, 79, 77, 74, 71]];
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar % 4];
    note(chord[0], bar * 4 * beat, beat * 3.7, 0.075);
    for (let tick = 0; tick < 8; tick++) note(chord[1 + tick % 3] + 12, (bar * 4 + tick / 2) * beat, beat * 1.9, 0.042);
    [0, 0.75, 1.5, 2, 2.75, 3.5].forEach((offset, i) => note(melody[bar % 4][i] + (bar > 3 && i === 2 ? -12 : 0), (bar * 4 + offset) * beat, beat * 1.6, 0.075));
  }
  assets.music = wav(music);
  return assets;
}
module.exports = { audioAssets };

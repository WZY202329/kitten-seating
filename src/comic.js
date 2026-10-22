'use strict';

const { roundRect, ellipse, text, cat } = require('./drawing.js');
const { STORIES } = require('./story.js');
const { GAME_NAME } = require('./brand.js');

function line(ctx, points, color = '#8FA6B7', width = 1.5) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function windowFrame(ctx, night = false) {
  roundRect(ctx, 223, 6, 57, 43, 6, '#A6BBC9', '#7D97AB');
  roundRect(ctx, 227, 10, 49, 34, 3, night ? '#3E586F' : '#DDF0F6');
  if (night) { ellipse(ctx, 262, 21, 8, 8, '#F5EAC2'); ellipse(ctx, 266, 18, 7, 7, '#3E586F'); }
  else ellipse(ctx, 261, 20, 8, 8, '#F6E8B3');
  line(ctx, [[250, 9], [250, 46]]); line(ctx, [[225, 28], [278, 28]]);
  roundRect(ctx, 216, 46, 71, 6, 3, '#7898AE');
}
function door(ctx, lit) {
  roundRect(ctx, 238, 9, 47, 66, 6, '#BACBD4', '#8CA1AE');
  roundRect(ctx, 244, 14, 35, 60, 4, lit ? '#F8EAC8' : '#DDE6EC');
  ellipse(ctx, 271, 48, 2, 2, '#A78657');
  if (lit) { ellipse(ctx, 263, 6, 13, 4, '#F1DBA3'); ellipse(ctx, 263, 6, 4, 3, '#FFF3C9'); }
}
function box(ctx, x, y, open = false) {
  roundRect(ctx, x, y, 56, 30, 2, '#C5A383', '#9E7D5C');
  line(ctx, [[x + 28, y], [x + 28, y + 29]], '#AF8B65');
  if (open) { line(ctx, [[x, y + 4], [x - 10, y - 7], [x + 15, y - 11], [x + 28, y]], '#9E7D5C', 2); line(ctx, [[x + 28, y], [x + 46, y - 10], [x + 66, y - 5], [x + 56, y + 4]], '#9E7D5C', 2); }
  else line(ctx, [[x - 2, y + 1], [x + 58, y + 1]], '#947556', 3);
}
function picture(ctx, x, y, tilted = false) {
  ctx.save(); ctx.translate(x, y); if (tilted) ctx.rotate(-0.18);
  roundRect(ctx, -20, -14, 40, 28, 2, '#FFFCF2', '#ADBBC5');
  [0, 1, 2, 3].forEach(type => {
    ellipse(ctx, -12 + type * 8, 2, 3.4, 4, ['#D9954E', '#8FA3B8', '#B39170', '#486471'][type]);
    line(ctx, [[-15 + type * 8, 0], [-14 + type * 8, -3], [-12 + type * 8, -1]], '#75899A', 0.7);
  });
  ctx.restore();
}
function pot(ctx, flower) {
  line(ctx, [[66, 60], [66, 29]], '#7B9E7E', 3);
  ellipse(ctx, 60, 41, 9, 4, '#90B390'); ellipse(ctx, 73, 34, 9, 4, '#90B390');
  roundRect(ctx, 52, 56, 29, 21, 5, '#C9A18A', '#A78271');
  roundRect(ctx, 49, 53, 35, 6, 2, '#D6B59D');
  if (flower) { for (let i = 0; i < 5; i++) ellipse(ctx, 66 + Math.cos(i * Math.PI * 0.4) * 6, 23 + Math.sin(i * Math.PI * 0.4) * 6, 5, 5, '#E1B0B1'); ellipse(ctx, 66, 23, 4, 4, '#E8CD8E'); }
}
function group(ctx, types, options = {}) {
  const gap = options.gap || 62;
  const start = options.x || (304 - (types.length - 1) * gap) / 2;
  types.forEach((type, i) => cat(ctx, start + i * gap, options.y || 55, options.size || 52, type, {
    variant: type * 2 + i, time: 0.7 + i * 0.8, sleeping: Boolean(options.sleeping), shadow: true
  }));
}

function drawComicPanel(ctx, x, y, width, height, chapter, stage) {
  const story = STORIES[chapter];
  ctx.save();
  roundRect(ctx, x, y, width, height, 11, '#EAF1F5', '#A8BCCC', 1.3); ctx.clip();
  ctx.translate(x, y); ctx.scale(width / 304, height / 88);
  const night = story.scene === 'moon';
  ctx.fillStyle = night ? '#657C90' : '#E6EFF4'; ctx.fillRect(0, 0, 304, 88);
  ctx.fillStyle = night ? '#526C7D' : '#D3E1E7'; ctx.fillRect(0, 61, 304, 27);
  line(ctx, [[0, 62], [304, 62]], night ? '#8598A4' : '#B4C8D4');
  const scene = story.scene;
  if (scene === 'home') {
    door(ctx, stage === 2);
    ellipse(ctx, 154, 75, 83, 7, '#C0D4CF');
    group(ctx, stage === 0 ? [0] : stage === 1 ? [0, 1] : [0, 1, 2], { x: stage === 0 ? 124 : stage === 1 ? 133 : 91, gap: 62 });
    ellipse(ctx, 99, 76, 7, 3, '#88A27F');
  } else if (scene === 'window') {
    windowFrame(ctx);
    ctx.beginPath(); ctx.moveTo(235, 47); ctx.lineTo(119, 84); ctx.lineTo(274, 84); ctx.lineTo(277, 47); ctx.closePath(); ctx.fillStyle = '#F4EACB'; ctx.fill();
    roundRect(ctx, 70, 72, stage === 0 ? 80 : 185, 8, 4, '#B5C9C1');
    group(ctx, stage === 0 ? [0] : stage === 1 ? [0, 1] : [0, 1, 2], { x: stage === 0 ? 164 : stage === 1 ? 137 : 99, gap: 60 });
  } else if (scene === 'boxes') {
    box(ctx, 34, 52, stage > 0);
    if (stage === 0) { group(ctx, [0, 1], { x: 121, gap: 60 }); box(ctx, 224, 46); line(ctx, [[236, 35], [232, 29]], '#7896A8'); line(ctx, [[268, 36], [272, 30]], '#7896A8'); }
    else { group(ctx, [0, 1], { x: 117, gap: 59 }); cat(ctx, 252, 47, 47, 2, { variant: 3, time: 0.6 }); box(ctx, 225, 56, true); }
    if (stage === 2) text(ctx, '小猫城堡', 62, 67, 7, '#80664E', '500', 'center');
  } else if (scene === 'garden') {
    ellipse(ctx, 211, 80, 108, 12, '#C2D7C7'); pot(ctx, stage === 2);
    group(ctx, stage === 0 ? [2] : stage === 1 ? [2, 3] : [0, 2, 3], { x: stage === 0 ? 164 : stage === 1 ? 152 : 124, gap: 56, size: 49 });
    if (stage > 0) { roundRect(ctx, 91, 58, 22, 16, 5, '#99B5BC', '#78969F'); line(ctx, [[93, 60], [84, 51], [78, 51]], '#78969F', 3); line(ctx, [[110, 58], [119, 53], [121, 62], [112, 66]], '#78969F', 2); }
  } else if (scene === 'sofa') {
    windowFrame(ctx);
    roundRect(ctx, 73, 29, 161, 42, 14, '#9CB2C3', '#7894A8');
    roundRect(ctx, 65, 54, 180, 25, 9, '#ACC0CD', '#7894A8');
    group(ctx, stage === 0 ? [0] : stage === 1 ? [0, 2] : [0, 1, 2, 3], { x: stage === 0 ? 151 : stage === 1 ? 118 : 81, gap: 49, y: 48, size: 45, sleeping: stage === 2 });
    roundRect(ctx, 58, 47, 19, 31, 7, '#B8CCD7', '#8AA3B4'); roundRect(ctx, 233, 47, 19, 31, 7, '#B8CCD7', '#8AA3B4');
  } else if (scene === 'tea') {
    windowFrame(ctx);
    group(ctx, stage === 0 ? [0, 1] : stage === 1 ? [0, 2] : [0, 1, 2], { x: stage === 2 ? 74 : 105, gap: stage === 2 ? 77 : 112, y: 52, size: 47 });
    roundRect(ctx, 81, 69, 158, 10, 4, '#C2A98E', '#A18C76');
    [113, 160, 209].forEach((cx, i) => { ellipse(ctx, cx, 68, 15, 4, '#F8FBFC'); if (stage === 2 || i !== 1) { ellipse(ctx, cx, 67, stage === 1 ? 4 : 7, 2, '#D5B07E'); } });
    roundRect(ctx, 250, 62, 11, 11, 3, '#F5F6ED', '#9DB2BB');
  } else if (scene === 'balcony') {
    ctx.fillStyle = '#DCEEF5'; ctx.fillRect(0, 0, 304, 62);
    ellipse(ctx, 263, 19, 11, 11, '#F6E5AF');
    for (let i = 0; i < 8; i++) line(ctx, [[12 + i * 40, 42], [12 + i * 40, 87]], '#A3BBCB', 3);
    line(ctx, [[0, 42], [304, 42]], '#8EAABA', 5);
    group(ctx, stage === 0 ? [1] : stage === 1 ? [0, 1] : [0, 1, 2], { x: stage === 0 ? 123 : stage === 1 ? 104 : 89, gap: 60, y: 56 });
    picture(ctx, stage === 0 ? 191 : stage === 1 ? 223 : 278, stage === 0 ? 70 : stage === 1 ? 33 : 16, stage > 0);
    if (stage > 0) line(ctx, [[192, 37], [198, 31], [206, 33]], '#8DAABF');
  } else if (scene === 'rooftop') {
    ctx.fillStyle = '#D5E2EF'; ctx.fillRect(0, 0, 304, 55);
    for (let i = 0; i < 5; i++) line(ctx, [[0, 55 + i * 9], [304, 55 + i * 9]], '#91A9B9');
    for (let i = 0; i < 8; i++) line(ctx, [[i * 48, 55], [i * 48 - 24, 88]], '#A4B9C6');
    group(ctx, stage === 0 ? [1, 0] : stage === 1 ? [1, 3] : [0, 1, 2, 3], { x: stage === 2 ? 76 : 128, gap: stage === 2 ? 49 : 61, y: 54, size: stage === 2 ? 45 : 48 });
    picture(ctx, stage === 0 ? 263 : stage === 1 ? 233 : 268, stage === 2 ? 70 : 47, stage < 2);
  } else if (scene === 'moon') {
    windowFrame(ctx, true);
    roundRect(ctx, 65, 73, 183, 7, 3, '#9BACA4');
    group(ctx, stage < 2 ? [0, 1, 3] : [0, 1, 3, 2], { x: stage < 2 ? 94 : 74, gap: stage < 2 ? 61 : 50, y: 55, size: stage < 2 ? 49 : 45, sleeping: stage === 2 });
    if (stage > 0) { ellipse(ctx, 20, 34, 14, 25, 'rgba(250,233,175,0.22)'); roundRect(ctx, 16, 19, 9, 12, 3, '#F5D897'); }
  } else {
    door(ctx, true);
    roundRect(ctx, 130, 8, 93, 24, 4, '#DEC6A4', '#B49A79');
    if (stage === 2) text(ctx, GAME_NAME, 176, 20, 10, '#735F4D', '600', 'center');
    else if (stage === 1) { ellipse(ctx, 174, 22, 6, 4, '#A98B6D'); [169, 174, 179].forEach(px => ellipse(ctx, px, 16, 2, 2, '#A98B6D')); }
    group(ctx, stage === 0 ? [1, 2] : [0, 1, 2, 3], { x: stage === 0 ? 138 : 77, gap: 48, y: 57, size: 45 });
  }
  // A small speech balloon complements the caption below each panel.
  const speech = story.panels[stage][1];
  const bubbleW = Math.min(170, speech.length * 9 + 20);
  const bubbleX = scene === 'garden' ? 105 : 8;
  roundRect(ctx, bubbleX, 5, bubbleW, 22, 9, '#FFFDF5', '#B5C4CC', 0.8);
  ctx.beginPath(); ctx.moveTo(bubbleX + 17, 26); ctx.lineTo(bubbleX + 23, 32); ctx.lineTo(bubbleX + 25, 26); ctx.fillStyle = '#FFFDF5'; ctx.fill();
  text(ctx, speech, bubbleX + bubbleW / 2, 16, 9, '#4E697C', '500', 'center');
  ctx.restore();
}

module.exports = { drawComicPanel };

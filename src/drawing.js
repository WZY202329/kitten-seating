'use strict';

const { catRig } = require('./motion.js');
const COLORS = [
  { coat: '#D9954E', dark: '#9C5B30', light: '#FFF0D6', outline: '#805536', shade: '#BE783B', name: '橘色虎斑' },
  { coat: '#8FA3B8', dark: '#536F88', light: '#FBFCF7', outline: '#4D667E', shade: '#6D879F', name: '灰白猫' },
  { coat: '#B39170', dark: '#715943', light: '#F4E4C9', outline: '#6C5643', shade: '#987452', name: '奶茶斑点' },
  { coat: '#486471', dark: '#2E4858', light: '#FCF4DF', outline: '#2E4655', shade: '#344E60', name: '黑白猫' }
];

function roundRect(ctx, x, y, width, height, radius, fill, stroke, lineWidth = 1) {
  radius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}

function text(ctx, value, x, y, size = 14, color = '#534B60', weight = '400', align = 'left') {
  ctx.font = `${weight} ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, x, y);
}

function coatFill(ctx, c, x = 0, y = 0) {
  const gradient = ctx.createLinearGradient(x - 18, y - 20, x + 24, y + 29);
  gradient.addColorStop(0, c.coat);
  gradient.addColorStop(0.58, c.coat);
  gradient.addColorStop(1, c.shade);
  return gradient;
}

function drawHead(ctx, c, type, options, rig) {
  const sleepy = options.sleeping;
  const blinking = rig.blink;
  const pose = (options.variant || 0) % 3;
  // Rounded ears and cheeks replace the previous mirrored geometric silhouette.
  ctx.beginPath(); ctx.moveTo(-20, -10);
  ctx.bezierCurveTo(-22, -18, -23, -29, -19, -29);
  ctx.quadraticCurveTo(-15, -28, -9, -21);
  ctx.bezierCurveTo(-2, -24, 5, -24, 11, -20);
  ctx.quadraticCurveTo(19, -29, 22, -28);
  ctx.bezierCurveTo(25, -26, 23, -16, 22, -8);
  ctx.bezierCurveTo(28, 6, 15, 13, 1, 12);
  ctx.bezierCurveTo(-14, 13, -27, 6, -20, -10); ctx.closePath();
  ctx.fillStyle = coatFill(ctx, c, 0, -10); ctx.fill();
  ctx.strokeStyle = c.outline; ctx.lineWidth = 1.15; ctx.stroke();
  ctx.fillStyle = '#DBAE9E';
  ctx.beginPath(); ctx.moveTo(-18.5, -25); ctx.quadraticCurveTo(-20, -20, -17, -15); ctx.lineTo(-12, -20); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(19.5, -24); ctx.quadraticCurveTo(22, -20, 19, -14); ctx.lineTo(14, -19); ctx.closePath(); ctx.fill();
  // Stable coat markings preserve recognition without relying only on color.
  if (type === 0) {
    ctx.strokeStyle = c.dark; ctx.lineWidth = 2.3;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5.5, -20); ctx.quadraticCurveTo(i * 5, -16, i * 4.5, -12); ctx.stroke(); }
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-20, -2); ctx.lineTo(-14, 0); ctx.moveTo(20, -1); ctx.lineTo(15, 1); ctx.stroke();
  } else if (type === 1) {
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.bezierCurveTo(-1, -12, -7, -5, -7, 2); ctx.quadraticCurveTo(0, 9, 8, 2); ctx.bezierCurveTo(8, -4, 3, -12, 0, -20); ctx.fillStyle = c.light; ctx.fill();
  } else if (type === 2) {
    ellipse(ctx, -7, -17, 2.4, 3.2, c.dark); ellipse(ctx, 2, -16, 2.1, 2.5, c.dark); ellipse(ctx, 9, -18, 2, 3, c.dark);
    ellipse(ctx, -17, 0, 2.2, 2.5, c.dark);
  } else {
    ctx.beginPath(); ctx.moveTo(1, -14); ctx.bezierCurveTo(-3, -5, -12, 0, -8, 7); ctx.quadraticCurveTo(1, 14, 11, 7); ctx.bezierCurveTo(14, 0, 5, -5, 1, -14); ctx.fillStyle = c.light; ctx.fill();
  }
  // Muzzle and relaxed, asymmetrical eyes. Idle blinks are deliberately staggered.
  ellipse(ctx, -3.2, 3, 5.6, 3.7, c.light); ellipse(ctx, 4.2, 3.4, 5, 3.5, c.light);
  ctx.strokeStyle = '#514B45'; ctx.lineWidth = 1.4;
  for (const [eyeX, eyeY] of [[-10, -4.4], [10.5, -3.7]]) {
    if (sleepy || blinking) {
      ctx.beginPath(); ctx.moveTo(eyeX - 3.3, eyeY); ctx.quadraticCurveTo(eyeX, eyeY + (sleepy ? 2 : 0.5), eyeX + 3.2, eyeY - 0.4); ctx.stroke();
    } else {
      ellipse(ctx, eyeX, eyeY, options.selected ? 2.4 : 1.9, options.selected ? 3.5 : pose === 1 ? 2.2 : 2.9, '#514B45');
      ellipse(ctx, eyeX + 0.6, eyeY - 0.9, 0.6, 0.8, '#FFFBEC');
    }
  }
  ctx.beginPath(); ctx.moveTo(-1.8, 0.1); ctx.quadraticCurveTo(0.8, -1, 3, 0.7); ctx.lineTo(0.8, 2.5); ctx.closePath(); ctx.fillStyle = '#B58078'; ctx.fill();
  ctx.lineWidth = 0.85; ctx.beginPath(); ctx.moveTo(0.8, 2.5); ctx.lineTo(0.7, 4.7); ctx.quadraticCurveTo(-1.2, 6.1, -3.2, 4.5); ctx.moveTo(0.7, 4.7); ctx.quadraticCurveTo(2.8, 6.2, 5, 4.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(87,71,61,0.50)'; ctx.lineWidth = 0.65;
  ctx.beginPath(); ctx.moveTo(-15, 3); ctx.quadraticCurveTo(-21, 1, -26, 2); ctx.moveTo(-15, 6); ctx.lineTo(-25, 7.4);
  ctx.moveTo(16, 4); ctx.quadraticCurveTo(21, 2.8, 26, 4); ctx.moveTo(16, 6.8); ctx.lineTo(25, 9); ctx.stroke();
}

function drawPaw(ctx, c, x, y, joint, front, white) {
  ctx.save(); ctx.translate(x, y - joint.lift); ctx.rotate(joint.angle);
  // The shoulder, lower leg and soft pad are drawn in their own local frame.
  ctx.beginPath(); ctx.moveTo(-3.5, -6); ctx.bezierCurveTo(-5, 0, -6, 8, -3, 11);
  ctx.quadraticCurveTo(0, 15, 5, 11); ctx.bezierCurveTo(7, 8, 3, 2, 3, -5); ctx.closePath();
  ctx.fillStyle = front ? coatFill(ctx, c, 0, -4) : c.shade; ctx.fill();
  ctx.lineWidth = 0.9; ctx.strokeStyle = c.outline; ctx.stroke();
  ellipse(ctx, 0.5, 10.5, 5.5, 3.8, white ? c.light : c.coat);
  ctx.strokeStyle = c.outline; ctx.lineWidth = 0.65;
  ctx.beginPath(); ctx.moveTo(-1.5, 10); ctx.lineTo(-1.2, 12.4); ctx.moveTo(1.2, 10); ctx.lineTo(1.5, 12.6); ctx.stroke();
  if (joint.lift > 4) {
    ellipse(ctx, 0.6, 11, 2.2, 1.3, '#C79391');
    ellipse(ctx, -2.5, 8.8, 0.8, 0.7, '#C79391'); ellipse(ctx, 3.3, 8.6, 0.8, 0.7, '#C79391');
  }
  ctx.restore();
}

function cat(ctx, cx, cy, size, type, options = {}) {
  const c = COLORS[type];
  const rig = catRig(options);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(size / 64, size / 64);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (options.shadow !== false) {
    ellipse(ctx, 1, 32, rig.crouching ? 24 : 20, 4.1, 'rgba(41,65,83,0.18)');
    ellipse(ctx, 0, 30.6, 13, 2, 'rgba(38,57,74,0.13)');
  }
  // Rear limbs and tail are behind the torso; front limbs overlap the chest.
  ctx.save(); ctx.translate(14, 15 + rig.body.y); ctx.rotate(rig.tail.angle);
  ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(22, 17, 22, -9 + rig.tail.curl, 13, -9 + rig.tail.curl);
  ctx.strokeStyle = c.outline; ctx.lineWidth = 8; ctx.stroke();
  ctx.strokeStyle = c.coat; ctx.lineWidth = 5.7; ctx.stroke();
  ctx.restore();
  drawPaw(ctx, c, -13, 17, rig.backLeft, false, type === 1);
  drawPaw(ctx, c, 13, 17, rig.backRight, false, type === 3);
  ctx.save(); ctx.translate(0, rig.body.y + (rig.crouching ? 3 : 0));
  // Scale about the hips so breathing and crouching do not lift planted feet.
  ctx.translate(0, 25); ctx.rotate(rig.body.angle); ctx.scale(rig.body.scaleX, rig.body.scaleY); ctx.translate(0, -25);
  ctx.beginPath(); ctx.moveTo(-11, -1); ctx.bezierCurveTo(-19, 4, -24, 22, -16, 27);
  ctx.bezierCurveTo(-9, 32, 13, 31, 19, 25); ctx.bezierCurveTo(24, 19, 15, 1, 9, -1); ctx.closePath();
  ctx.fillStyle = coatFill(ctx, c); ctx.fill(); ctx.strokeStyle = c.outline; ctx.lineWidth = 1.1; ctx.stroke();
  ellipse(ctx, -7.2, 13, 6.3, 11, 'rgba(255,255,255,0.13)');
  ellipse(ctx, 1, 16, type === 3 ? 10 : 8, rig.crouching ? 9 : 12, c.light);
  ctx.beginPath(); ctx.moveTo(9, 4); ctx.quadraticCurveTo(19, 13, 17, 23); ctx.strokeStyle = 'rgba(38,49,51,0.12)'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.restore();
  drawPaw(ctx, c, -7.7, 17 + rig.body.y * 0.12, rig.frontLeft, true, type === 0 || type === 1);
  drawPaw(ctx, c, 7, 18 + rig.body.y * 0.12, rig.frontRight, true, type !== 2);
  // A small neck shadow separates the head from the torso.
  ellipse(ctx, 1, 6 + rig.body.y, 14, 4.2, 'rgba(36,47,56,0.15)');
  ctx.save(); ctx.translate(rig.head.x, rig.head.y + rig.body.y * 0.45);
  ctx.rotate(rig.head.angle); drawHead(ctx, c, type, options, rig); ctx.restore();
  ctx.restore();
}

function icon(ctx, name, x, y, color = '#75618D', size = 22) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (name === 'back') { ctx.moveTo(15, 5); ctx.lineTo(8, 12); ctx.lineTo(15, 19); }
  if (name === 'undo') { ctx.moveTo(8, 6); ctx.lineTo(3, 11); ctx.lineTo(8, 15); ctx.moveTo(3, 11); ctx.lineTo(15, 11); ctx.bezierCurveTo(23, 11, 22, 21, 13, 20); }
  if (name === 'restart') { ctx.arc(12, 13, 8, -2.5, 2.7); ctx.moveTo(3, 4); ctx.lineTo(4, 10); ctx.lineTo(10, 8); }
  if (name === 'hint') { ctx.arc(12, 9, 6, Math.PI * 0.2, Math.PI * 2.8); ctx.moveTo(8, 14); ctx.lineTo(9, 18); ctx.lineTo(15, 18); ctx.lineTo(16, 14); ctx.moveTo(10, 21); ctx.lineTo(14, 21); }
  if (name === 'settings') { ctx.arc(12, 12, 4, 0, Math.PI * 2); ctx.moveTo(21, 12); ctx.arc(12, 12, 9, 0, Math.PI * 2); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(12 + Math.cos(a) * 8, 12 + Math.sin(a) * 8); ctx.lineTo(12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11); } }
  if (name === 'check') { ctx.moveTo(5, 12); ctx.lineTo(10, 17); ctx.lineTo(19, 7); }
  if (name === 'close') { ctx.moveTo(6, 6); ctx.lineTo(18, 18); ctx.moveTo(18, 6); ctx.lineTo(6, 18); }
  if (name === 'help') { ctx.arc(12, 12, 10, 0, Math.PI * 2); ctx.moveTo(9, 8); ctx.bezierCurveTo(9, 2, 20, 7, 13, 12); ctx.lineTo(12, 14); ctx.moveTo(12, 18); ctx.lineTo(12, 18.5); }
  if (name === 'arrow') { ctx.moveTo(4, 12); ctx.lineTo(20, 12); ctx.moveTo(15, 7); ctx.lineTo(20, 12); ctx.lineTo(15, 17); }
  ctx.stroke(); ctx.restore();
}

module.exports = { COLORS, roundRect, ellipse, text, cat, icon };

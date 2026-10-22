'use strict';

const { roundRect, ellipse, cat } = require('./drawing.js');

// Square, opaque artwork. Platform applies its own display mask.
function drawAppIcon(ctx, size = 600) {
  ctx.save(); ctx.scale(size / 600, size / 600);
  const background = ctx.createLinearGradient(0, 0, 600, 600);
  background.addColorStop(0, '#EEF5F8'); background.addColorStop(1, '#CADDE7');
  ctx.fillStyle = background; ctx.fillRect(0, 0, 600, 600);
  ellipse(ctx, 510, 61, 127, 127, '#E2EDE6');
  ellipse(ctx, 31, 557, 147, 166, '#BDD4CD');
  ellipse(ctx, 300, 551, 230, 22, 'rgba(48,78,98,0.13)');

  roundRect(ctx, 88, 192, 424, 353, 19, '#FCFAF0', '#7896A9', 8);
  ctx.beginPath(); ctx.moveTo(56, 213); ctx.lineTo(291, 57);
  ctx.quadraticCurveTo(300, 51, 309, 57); ctx.lineTo(544, 213);
  ctx.lineTo(520, 247); ctx.lineTo(300, 104); ctx.lineTo(80, 247); ctx.closePath();
  ctx.fillStyle = '#6C92AC'; ctx.fill();
  ctx.strokeStyle = '#41647D'; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.stroke();

  // Four coat patterns stay consistent with the game and comic protagonists.
  roundRect(ctx, 124, 330, 352, 16, 7, '#B1C7D5');
  cat(ctx, 205, 247, 171, 0, { variant: 1, time: 0.8 });
  cat(ctx, 392, 247, 171, 1, { variant: 4, time: 1.3 });
  roundRect(ctx, 117, 512, 366, 17, 7, '#9BB7CA');
  cat(ctx, 205, 424, 178, 2, { variant: 7, time: 0.4 });
  cat(ctx, 392, 424, 178, 3, { variant: 9, time: 1.7 });

  // A tiny leaf recalls the gift brought by Orange in the first comic.
  ctx.save(); ctx.translate(77, 468); ctx.rotate(-0.5);
  ellipse(ctx, 0, 0, 16, 8, '#90AF86');
  ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(17, 0);
  ctx.strokeStyle = '#63865D'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  ctx.restore();
}

module.exports = { drawAppIcon };

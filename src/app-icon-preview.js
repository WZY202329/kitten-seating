'use strict';
const { drawAppIcon } = require('./app-icon.js');
const canvas = document.getElementById('app-icon');
drawAppIcon(canvas.getContext('2d'), 600);
canvas.dataset.ready = 'true';

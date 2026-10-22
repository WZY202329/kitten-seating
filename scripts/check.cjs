'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
for (const folder of ['src', 'scripts', 'tests']) {
  for (const item of fs.readdirSync(path.resolve(__dirname, '..', folder), { recursive: true })) {
    if (/\.(js|cjs)$/.test(item)) execFileSync(process.execPath, ['--check', path.resolve(__dirname, '..', folder, item)], { stdio: 'inherit' });
  }
}
console.log('All JavaScript syntax checks passed.');

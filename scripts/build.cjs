'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { projectConfig } = require('./project-config.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });

// Small dependency-free CommonJS packer. No eval or runtime code generation.
const modules = new Map();
function collect(file) {
  file = path.resolve(file);
  const id = path.relative(root, file).split(path.sep).join('/');
  if (modules.has(id)) return id;
  let source = fs.readFileSync(file, 'utf8');
  modules.set(id, '');
  source = source.replace(/require\(['"](\.[^'"]+)['"]\)/g, (_, request) => {
    const dependency = collect(path.resolve(path.dirname(file), request));
    return `require(${JSON.stringify(dependency)})`;
  });
  modules.set(id, source);
  return id;
}
function bundle(entry) {
  modules.clear();
  const id = collect(path.join(root, entry));
  return `(function(){'use strict';\nconst modules={\n${[...modules].map(([key, code]) => `${JSON.stringify(key)}:function(require,module,exports){\n${code}\n}`).join(',\n')}\n};\nconst cache={};\nfunction require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}\nrequire(${JSON.stringify(id)});\n})();\n`;
}
fs.writeFileSync(path.join(out, 'browser.js'), bundle('src/browser.js'));
fs.copyFileSync(path.join(root, 'web/index.html'), path.join(out, 'index.html'));
// Asset preview is browser-only and is excluded from the Douyin code package.
fs.writeFileSync(path.join(out, 'app-icon.js'), bundle('src/app-icon-preview.js'));
fs.copyFileSync(path.join(root, 'web/app-icon.html'), path.join(out, 'app-icon.html'));
const mini = path.join(out, 'douyin');
fs.mkdirSync(mini, { recursive: true });
fs.writeFileSync(path.join(mini, 'game.js'), bundle('src/douyin.js'));
fs.writeFileSync(path.join(mini, 'game.json'), JSON.stringify({ deviceOrientation: 'portrait', showStatusBar: false }, null, 2));
const configFile = path.join(mini, 'project.config.json');
const localConfigFile = path.join(root, 'douyin.config.json');
const readConfig = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : {};
// Keep the AppID entered in the IDE across rebuilds; local config can override it.
fs.writeFileSync(configFile, JSON.stringify(projectConfig(readConfig(configFile), readConfig(localConfigFile)), null, 2));
const { audioAssets } = require('./audio-assets.cjs');
const assets = audioAssets();
for (const directory of [path.join(out, 'audio'), path.join(mini, 'audio')]) {
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, data] of Object.entries(assets)) fs.writeFileSync(path.join(directory, `${name}.wav`), data);
}
console.log('Built browser preview: dist/index.html');
console.log('Built Douyin project: dist/douyin (set your appid in the developer tool)');

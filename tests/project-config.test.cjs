'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { projectConfig } = require('../scripts/project-config.cjs');

test('rebuilding preserves the AppID and IDE settings already entered by the developer', () => {
  const config = projectConfig({ appid: 'existing-app-id', setting: { urlCheck: true }, customField: 42 });
  assert.equal(config.appid, 'existing-app-id');
  assert.equal(config.setting.urlCheck, true);
  assert.equal(config.customField, 42);
});

test('local AppID configuration overrides the IDE value; an empty template never erases it', () => {
  assert.equal(projectConfig({ appid: 'existing' }, { appid: ' new-app-id ' }).appid, 'new-app-id');
  assert.equal(projectConfig({ appid: 'existing' }, { appid: '' }).appid, 'existing');
  assert.equal(projectConfig().appid, '');
  assert.throws(() => projectConfig({}, { appid: 123 }), /字符串/);
});

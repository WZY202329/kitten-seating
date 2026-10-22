'use strict';
const { GAME_NAME } = require('../src/brand.js');

function projectConfig(previous = {}, local = {}) {
  if (local.appid !== undefined && typeof local.appid !== 'string') throw new Error('douyin.config.json 中的 appid 必须是字符串。');
  const priorId = typeof previous.appid === 'string' ? previous.appid.trim() : '';
  return { ...previous, description: `${GAME_NAME} · 100关漫画排序`,
    projectname: previous.projectname || 'cat-sort', appid: (local.appid || '').trim() || priorId,
    setting: { ...previous.setting, es6: true, minified: false }, compileType: 'game' };
}
module.exports = { projectConfig };

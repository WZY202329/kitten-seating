'use strict';

const { copyBoard, sameBoard, validBoard } = require('./core.js');
const { LEVELS, PACK_VERSION, getLevelById } = require('./levels.js');
const { audioSettings } = require('./audio.js');
const { STORIES, chapterComplete } = require('./story.js');
const SAVE_KEY = 'cat-sort.save.v1';
const BACKUP_KEY = 'cat-sort.save.backup.v1';
const EVENTS_KEY = 'cat-sort.sessions.v1';
const MAX_EVENTS = 600;

function freshSave() {
  return { schemaVersion: 1, levelPackVersion: PACK_VERSION, clearedLevelIds: [],
    currentRun: null, savedRuns: {}, seenStoryChapters: [], hasStarted: false, settings: audioSettings() };
}

function restoreRun(run) {
  if (!run || typeof run !== 'object') return null;
  const level = getLevelById(run.levelId);
  if (!level || !validBoard(run.board, level) || !Array.isArray(run.history)) return null;
  // Every undo entry must connect by one legal move to the next board.
  const chain = [...run.history, run.board];
  const { move } = require('./core.js');
  for (let i = 0; i < chain.length - 1; i++) {
    if (!validBoard(chain[i], level)) return null;
    let connected = false;
    for (let from = 0; from < chain[i].length && !connected; from++) {
      for (let to = 0; to < chain[i].length && !connected; to++) {
        const next = move(chain[i], level.capacity, from, to);
        if (next && sameBoard(next, chain[i + 1])) connected = true;
      }
    }
    if (!connected) return null;
  }
  return { levelId: level.id, board: copyBoard(run.board), history: run.history.map(copyBoard),
    moves: Math.max(run.history.length, Number.isSafeInteger(run.moves) && run.moves >= 0 ? run.moves : 0) };
}

function sanitizeSave(raw) {
  const save = freshSave();
  if (!raw || typeof raw !== 'object' || raw.schemaVersion !== 1) return { save, recovered: Boolean(raw) };
  const ids = new Set(LEVELS.map(level => level.id));
  if (Array.isArray(raw.clearedLevelIds)) save.clearedLevelIds = [...new Set(raw.clearedLevelIds.filter(id => ids.has(id)))];
  save.settings = audioSettings(raw.settings && typeof raw.settings === 'object' ? raw.settings : {});
  save.hasStarted = typeof raw.hasStarted === 'boolean' ? raw.hasStarted : Boolean(raw.currentRun || save.clearedLevelIds.length);
  if (Array.isArray(raw.seenStoryChapters)) save.seenStoryChapters = [...new Set(raw.seenStoryChapters.filter(chapter =>
    Number.isInteger(chapter) && chapter >= 0 && chapter < STORIES.length && chapterComplete(save.clearedLevelIds, chapter)))];
  let recovered = raw.levelPackVersion !== PACK_VERSION;
  const run = raw.currentRun;
  if (run) {
    const level = getLevelById(run.levelId);
    if (level && !recovered) save.currentRun = restoreRun(run);
    if (!save.currentRun) recovered = true;
    if (!save.currentRun && level) save.currentRun = { levelId: level.id, board: copyBoard(level.board), history: [], moves: 0 };
  }
  if (raw.levelPackVersion === PACK_VERSION && raw.savedRuns && typeof raw.savedRuns === 'object') {
    // Only stable level IDs are accepted, so the cache has at most 100 entries.
    for (const level of LEVELS) {
      if (level.id === (save.currentRun && save.currentRun.levelId) || !raw.savedRuns[level.id]) continue;
      const restored = restoreRun(raw.savedRuns[level.id]);
      if (restored && restored.levelId === level.id) save.savedRuns[level.id] = restored;
      else recovered = true;
    }
  }
  return { save, recovered };
}

class SaveRepository {
  constructor(storage) { this.storage = storage; this.warning = ''; }
  load() {
    let raw = null;
    let readFailed = false;
    try { raw = this.storage.get(SAVE_KEY); } catch (_) { readFailed = true; }
    if (raw) {
      const result = sanitizeSave(raw);
      if (!result.recovered) return result;
      // Prefer retaining compatible cleared levels rather than rolling them back.
      this.warning = '已修复旧存档，部分局面已重新开始。';
      return result;
    }
    if (readFailed) {
      try {
        const backup = this.storage.get(BACKUP_KEY);
        if (backup) { this.warning = '已从本机备份恢复进度。'; return sanitizeSave(backup); }
      } catch (_) { /* Continue with a playable fresh save. */ }
      this.warning = '暂时无法读取存档，本次进度可能无法保存。';
    }
    return { save: freshSave(), recovered: readFailed };
  }
  save(save) {
    try { this.storage.set(SAVE_KEY, save); }
    catch (_) { this.warning = '保存未成功，进度可能丢失。可在设置中重试。'; return false; }
    // A backup failure does not invalidate a successful primary write.
    try { this.storage.set(BACKUP_KEY, save); } catch (_) { /* Best effort local backup. */ }
    this.warning = '';
    return true;
  }
}

class SessionLog {
  constructor(storage) {
    this.storage = storage;
    this.session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    this.events = [];
    try {
      const previous = storage.get(EVENTS_KEY);
      if (Array.isArray(previous)) this.events = previous.slice(-MAX_EVENTS);
    } catch (_) { /* Analytics failure must not block play. */ }
  }
  record(event, data = {}) {
    this.events.push({ event, session: this.session, time: new Date().toISOString(), version: '0.4.0', ...data });
    this.events = this.events.slice(-MAX_EVENTS);
    try { this.storage.set(EVENTS_KEY, this.events); } catch (_) { /* Still export this session from memory. */ }
  }
  export() { return JSON.stringify({ format: 1, exportedAt: new Date().toISOString(), events: this.events }, null, 2); }
}

module.exports = { SAVE_KEY, BACKUP_KEY, EVENTS_KEY, MAX_EVENTS, freshSave, sanitizeSave, SaveRepository, SessionLog };

'use strict';

const { copyBoard, fullRow, isSolved, canMove, move, createSearch } = require('./core.js');
const { LEVELS, getLevel } = require('./levels.js');
const { hintFromSolution } = require('./generator.js');
const { MOVE_DURATION } = require('./motion.js');
const { SaveRepository, SessionLog } = require('./storage.js');
const { chapterProgress, chapterComplete } = require('./story.js');

class Game {
  constructor(platform) {
    this.platform = platform;
    this.repository = new SaveRepository(platform.storage);
    this.log = new SessionLog(platform.storage);
    const loaded = this.repository.load();
    this.save = loaded.save;
    this.selected = null;
    this.hint = null;
    this.searching = false;
    this.searchToken = 0;
    this.animation = null;
    this.shake = null;
    this.toast = null;
    this.overlay = null;
    this.scene = 'home';
    this.storyChapter = null;
    this.storyReturn = null;
    this.onChange = () => {};
    if (!this.save.currentRun) {
      const index = LEVELS.findIndex(level => !this.save.clearedLevelIds.includes(level.id));
      this.setRun(index < 0 ? LEVELS.length - 1 : index, false);
    } else {
      this.levelIndex = LEVELS.findIndex(level => level.id === this.save.currentRun.levelId);
      this.log.record('run_restore', { levelId: this.level.id, moves: this.run.moves });
    }
    if (platform.configureAudio) platform.configureAudio(this.save.settings);
    this.chapterPage = Math.floor(this.levelIndex / 10);
    this.log.record('session_start', { levelId: this.level.id, recovered: loaded.recovered });
    // Show the full notice before the menu actions on every new app session.
    this.overlay = 'health';
  }
  get level() { return getLevel(this.levelIndex); }
  get run() { return this.save.currentRun; }
  now() { return this.platform.now(); }
  changed() { this.onChange(); }
  notify(message) { this.toast = { message, until: this.now() + 2600 }; this.changed(); }
  persist() {
    if (this.platform.configureAudio) this.platform.configureAudio(this.save.settings);
    const ok = this.repository.save(this.save); this.changed(); return ok;
  }
  startGame() {
    this.scene = 'game';
    this.save.hasStarted = true;
    this.overlay = null;
    if (isSolved(this.run.board, this.level.capacity)) this.showCompletion();
    this.log.record('menu_play', { levelId: this.level.id });
    this.persist();
  }
  goHome() {
    this.cancelSearch();
    this.scene = 'home';
    this.overlay = null;
    this.storyChapter = null;
    this.storyReturn = null;
    this.selected = null;
    this.hint = null;
    this.animation = null;
    this.shake = null;
    this.toast = null;
    this.log.record('menu_home', { levelId: this.level.id });
    this.persist();
  }
  available(index) { return index === 0 || LEVELS.slice(0, index).every(level => this.save.clearedLevelIds.includes(level.id)); }
  chapterProgress(chapter) { return chapterProgress(this.save.clearedLevelIds, chapter); }
  chapterComplete(chapter) { return chapterComplete(this.save.clearedLevelIds, chapter); }
  setRun(index, persist = true, resume = true) {
    this.cancelSearch();
    if (this.run && this.run.levelId !== LEVELS[index].id && this.run.moves > 0 && !isSolved(this.run.board, this.level.capacity)) {
      this.save.savedRuns[this.run.levelId] = this.run;
    }
    this.levelIndex = index;
    this.save.currentRun = resume && this.save.savedRuns[this.level.id] || { levelId: this.level.id, board: copyBoard(this.level.board), history: [], moves: 0 };
    delete this.save.savedRuns[this.level.id];
    this.selected = null;
    this.hint = null;
    this.animation = null;
    this.toast = null;
    this.overlay = null;
    this.log.record('level_start', { levelId: this.level.id });
    if (persist) this.persist();
  }
  selectLevel(index) {
    if (this.inputLocked()) return false;
    if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length || !this.available(index)) return false;
    this.scene = 'game';
    this.save.hasStarted = true;
    // Selecting the active card resumes, rather than silently discarding the run.
    if (index === this.levelIndex) { this.overlay = null; if (isSolved(this.run.board, this.level.capacity)) this.showCompletion(); this.persist(); return true; }
    this.setRun(index);
    return true;
  }
  cancelSearch() { this.searchToken++; this.searching = false; }
  inputLocked() { return this.searching || Boolean(this.animation && this.now() < this.animation.until); }
  tapRow(index) {
    if (this.scene !== 'game' || this.overlay || this.inputLocked() || isSolved(this.run.board, this.level.capacity)) return false;
    if (!Number.isInteger(index) || index < 0 || index >= this.run.board.length) return false;
    if (this.selected === null) {
      if (!this.run.board[index].length) { this.notify('先选一只小猫，再选择空排。'); return false; }
      this.selected = index;
      this.hint = null;
      this.changed();
      return true;
    }
    if (this.selected === index) { this.selected = null; this.changed(); return true; }
    const from = this.selected;
    const next = move(this.run.board, this.level.capacity, from, index);
    if (!next) {
      this.shake = { row: index, until: this.now() + 300 };
      this.log.record('move_invalid', { levelId: this.level.id, from, to: index });
      this.notify(this.run.board[index].length >= this.level.capacity ? '这一排坐满啦，试试其他座位。' : '只能去空排，或同类猫咪的旁边。');
      return false;
    }
    const cat = this.run.board[from][this.run.board[from].length - 1];
    const fromSlot = this.run.board[from].length - 1;
    const toSlot = this.run.board[index].length;
    const wasFull = fullRow(this.run.board[index], this.level.capacity);
    this.run.history.push(copyBoard(this.run.board));
    this.run.board = next;
    this.run.moves++;
    this.selected = null;
    this.hint = null;
    this.animation = { from, to: index, fromSlot, toSlot, cat, variant: (from * 17 + fromSlot * 7 + cat * 3) % 11,
      start: this.now(), until: this.now() + MOVE_DURATION };
    const rowComplete = !wasFull && fullRow(next[index], this.level.capacity);
    if (rowComplete) this.notify('这一排坐好啦。');
    this.platform.sound(this.save.settings.soundEnabled ? (rowComplete ? 'row' : 'move') : 'silent');
    this.log.record('move', { levelId: this.level.id, from, to: index, moves: this.run.moves });
    if (isSolved(next, this.level.capacity)) {
      if (!this.save.clearedLevelIds.includes(this.level.id)) this.save.clearedLevelIds.push(this.level.id);
      this.log.record('level_complete', { levelId: this.level.id, moves: this.run.moves });
      const currentLevel = this.level.id;
      this.platform.defer(() => {
        if (this.scene === 'game' && this.level.id === currentLevel && isSolved(this.run.board, this.level.capacity)) {
          this.animation = null;
          this.toast = null;
          this.showCompletion();
          this.platform.sound(this.save.settings.soundEnabled ? 'win' : 'silent');
          this.changed();
        }
      }, MOVE_DURATION + 110);
    }
    this.persist();
    return true;
  }
  undo() {
    if (this.scene !== 'game' || this.inputLocked() || !this.run.history.length) return false;
    this.cancelSearch();
    this.run.board = this.run.history.pop();
    this.run.moves = Math.max(0, this.run.moves - 1);
    this.selected = null;
    this.hint = null;
    this.animation = null;
    this.overlay = null;
    this.log.record('undo', { levelId: this.level.id, moves: this.run.moves });
    this.persist();
    return true;
  }
  restart() {
    if (this.scene !== 'game' || this.inputLocked()) return false;
    this.log.record('restart', { levelId: this.level.id, moves: this.run.moves });
    this.setRun(this.levelIndex, true, false);
    return true;
  }
  next() {
    if (this.overlay === 'story' || this.scene !== 'game' || !isSolved(this.run.board, this.level.capacity)) return false;
    if (this.levelIndex + 1 < LEVELS.length) this.setRun(this.levelIndex + 1);
    else { this.chapterPage = Math.floor(this.levelIndex / 10); this.overlay = 'levels'; this.changed(); }
    return true;
  }
  showCompletion() {
    const chapter = Math.floor(this.levelIndex / 10);
    this.overlay = 'complete';
    if (this.chapterComplete(chapter) && !this.save.seenStoryChapters.includes(chapter)) this.openStory(chapter, 'complete');
  }
  openStory(chapter, returnTo = this.overlay) {
    if (!this.chapterComplete(chapter)) return false;
    this.cancelSearch();
    this.storyChapter = chapter;
    this.storyReturn = returnTo === 'story' ? 'levels' : returnTo;
    this.overlay = 'story';
    this.log.record('story_open', { chapter: chapter + 1 });
    this.changed();
    return true;
  }
  finishStory(continueJourney = false) {
    if (this.overlay !== 'story') return false;
    const chapter = this.storyChapter;
    const returnTo = this.storyReturn;
    if (!this.save.seenStoryChapters.includes(chapter)) this.save.seenStoryChapters.push(chapter);
    this.log.record('story_close', { chapter: chapter + 1, continueJourney });
    this.storyChapter = null;
    this.storyReturn = null;
    this.overlay = returnTo;
    if (continueJourney && returnTo === 'complete') {
      if (chapter === 9) { this.chapterPage = chapter; this.overlay = 'levels'; }
      else this.selectLevel((chapter + 1) * 10);
    }
    this.persist();
    return true;
  }
  requestHint() {
    if (this.scene !== 'game' || this.overlay || this.inputLocked() || isSolved(this.run.board, this.level.capacity)) return false;
    const known = hintFromSolution(this.run.board, this.level);
    const search = known ? null : createSearch(this.run.board, this.level.capacity, { maxNodes: 24000 });
    this.searching = true;
    this.selected = null;
    this.hint = null;
    const token = ++this.searchToken;
    const deadline = this.now() + 2200;
    this.log.record('hint_request', { levelId: this.level.id, moves: this.run.moves });
    this.changed();
    const work = () => {
      if (this.searchToken !== token) return;
      // Small slices leave time for touches, rendering and cancellation on phones.
      if (known) {
        this.searching = false;
        this.hint = known;
        this.selected = known.from;
        this.log.record('hint_ready', { levelId: this.level.id, method: 'verified-path' });
        this.notify(`从第 ${known.from + 1} 排，移到第 ${known.to + 1} 排。`);
        return;
      }
      const frameEnd = this.now() + 7;
      let result;
      do { result = search.step(30); } while (result.status === 'searching' && this.now() < frameEnd);
      if (result.status === 'searching' && this.now() < deadline) { this.platform.defer(work, 16); return; }
      this.searching = false;
      if (result.status === 'solved' && result.path.length) {
        this.hint = result.path[0];
        this.selected = this.hint.from;
        this.log.record('hint_ready', { levelId: this.level.id });
        this.notify(`从第 ${this.hint.from + 1} 排，移到第 ${this.hint.to + 1} 排。`);
      } else if (result.status === 'unsolvable') {
        this.log.record('hint_unavailable', { levelId: this.level.id, reason: 'unsolvable' });
        this.notify('这个局面已走不通，可以撤回或重开。');
      } else {
        this.log.record('hint_unavailable', { levelId: this.level.id, reason: 'budget' });
        this.notify('暂时没找到提示，可以先撤回试试。');
      }
      this.changed();
    };
    this.platform.defer(work, 20);
    return true;
  }
  openOverlay(name) { this.cancelSearch(); if (name === 'levels') this.chapterPage = Math.floor(this.levelIndex / 10); this.overlay = name; this.changed(); }
  chooseChapter(chapter) {
    if (!Number.isInteger(chapter) || chapter < 0 || chapter > 9) return false;
    this.chapterPage = chapter; this.overlay = 'levels'; this.changed(); return true;
  }
  changeChapter(delta) {
    this.chapterPage = Math.max(0, Math.min(Math.ceil(LEVELS.length / 10) - 1, this.chapterPage + delta));
    this.changed();
  }
  closeOverlay() {
    if (this.overlay === 'story') return this.finishStory();
    this.overlay = this.scene === 'game' && isSolved(this.run.board, this.level.capacity) ? 'complete' : null;
    this.changed();
  }
  toggleSound() {
    this.save.settings.soundEnabled = !this.save.settings.soundEnabled;
    this.persist();
    if (this.save.settings.soundEnabled) this.platform.sound('move');
  }
  toggleMusic() { this.save.settings.musicEnabled = !this.save.settings.musicEnabled; this.persist(); }
  setVolume(channel, value) {
    if (!['sound', 'music'].includes(channel) || typeof value !== 'number' || !Number.isFinite(value)) return;
    const normalized = Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
    if (this.save.settings[`${channel}Volume`] === normalized) return;
    this.save.settings[`${channel}Volume`] = normalized;
    this.persist();
  }
  previewSound() { this.platform.sound('move'); }
  exportLog() {
    this.log.record('export', { levelId: this.level.id });
    this.platform.exportText(this.log.export(), 'cat-sort-playtest.json');
  }
  pause() {
    if (this.platform.setAudioActive) this.platform.setAudioActive(false);
    this.cancelSearch();
    this.log.record('session_pause', { levelId: this.level.id, moves: this.run.moves });
    this.persist();
  }
  resume() { if (this.platform.setAudioActive) this.platform.setAudioActive(true); this.changed(); }
}

module.exports = { Game };

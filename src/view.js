'use strict';

const { LEVELS, LEVEL_COUNT, CHAPTERS } = require('./levels.js');
const { fullRow, isSolved, canMove } = require('./core.js');
const { roundRect, ellipse, text, cat, icon } = require('./drawing.js');
const { hopPosition } = require('./motion.js');
const { STORIES, levelLabel } = require('./story.js');
const { drawComicPanel } = require('./comic.js');
const { GAME_NAME } = require('./brand.js');
const { AGE_RATING, HEALTH_ADVICE } = require('./health.js');
const INK = '#344C60';
const MUTED = '#7F95A5';
const ACCENT = '#537D9F';

class View {
  constructor(canvas, game, platform) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.platform = platform;
    this.targets = [];
    this.width = 400;
    this.height = 800;
    this.scale = 1;
    this.running = false;
    this.dirty = true;
    this.lastIdle = 0;
    game.onChange = () => { this.dirty = true; };
  }
  resize(width, height, pixelRatio, safeTop = 0, safeBottom = 0) {
    this.scale = width / 400;
    this.width = 400;
    this.height = height / this.scale;
    this.safeTop = safeTop / this.scale;
    this.safeBottom = safeBottom / this.scale;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.pixelRatio = pixelRatio;
    this.dirty = true;
  }
  target(x, y, w, h, action, label) { this.targets.push({ x, y, w, h, action, label }); }
  tap(x, y) {
    this.pointerEnd(false);
    x /= this.scale; y /= this.scale;
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
        if (t.drag) { this.activeDrag = t; t.drag(x); }
        else t.action();
        return;
      }
    }
  }
  pointerMove(x) { if (this.activeDrag) this.activeDrag.drag(x / this.scale); }
  pointerEnd(preview = true) {
    const target = this.activeDrag;
    this.activeDrag = null;
    if (preview && target && target.release) target.release();
  }
  start() {
    if (this.running) return;
    this.running = true;
    const frame = () => {
      if (!this.running) return;
      const g = this.game;
      const moving = Boolean(g.animation || g.shake) || g.searching;
      const idle = !g.overlay && !this.platform.reducedMotion && g.now() - this.lastIdle > 66;
      if (this.dirty || moving || idle || (g.toast && g.now() > g.toast.until)) { this.render(); this.lastIdle = g.now(); }
      this.platform.frame(frame);
    };
    this.platform.frame(frame);
  }
  button(x, y, w, h, label, action, options = {}) {
    const ctx = this.ctx;
    roundRect(ctx, x, y + 3, w, h, 16, options.primary ? '#385F7D' : '#CDDBE5');
    roundRect(ctx, x, y, w, h, 16, options.disabled ? '#E6EDF2' : options.primary ? ACCENT : '#FFFFFF', options.primary ? null : '#CDDBE5');
    const color = options.disabled ? '#A4B4C0' : options.primary ? '#FFFFFF' : INK;
    if (options.icon) icon(ctx, options.icon, x + 19, y + (h - 22) / 2, color);
    text(ctx, label, x + w / 2 + (options.icon ? 10 : 0), y + h / 2, options.size || 14, color, '600', 'center');
    if (!options.disabled) this.target(x, y, w, h + 3, action, label);
  }
  slider(x, y, w, channel, label) {
    const ctx = this.ctx;
    const g = this.game;
    const value = g.save.settings[`${channel}Volume`];
    const enabled = g.save.settings[`${channel}Enabled`];
    roundRect(ctx, x, y - 3, w, 6, 3, '#D7E3EC');
    if (value > 0) roundRect(ctx, x, y - 3, Math.max(6, w * value), 6, 3, enabled ? '#7098B5' : '#A7B9C7');
    ellipse(ctx, x + w * value, y + 2, 11, 11, '#CEDCE7');
    ellipse(ctx, x + w * value, y, 11, 11, enabled ? '#537D9F' : '#99ADBC');
    ellipse(ctx, x + w * value, y, 4, 4, '#FFFFFF');
    const change = value => g.setVolume(channel, value);
    this.targets.push({ x: x - 15, y: y - 22, w: w + 30, h: 44, label,
      range: { value: Math.round(value * 100), change },
      drag: point => change((point - x) / w),
      release: channel === 'sound' ? () => g.previewSound() : null });
  }
  render() {
    this.dirty = false;
    this.targets = [];
    const ctx = this.ctx;
    const g = this.game;
    if (g.animation && g.now() >= g.animation.until) g.animation = null;
    if (g.shake && g.now() >= g.shake.until) g.shake = null;
    const h = this.height;
    const top = Math.max(0, this.safeTop || 0);
    ctx.setTransform(this.pixelRatio * this.scale, 0, 0, this.pixelRatio * this.scale, 0, 0);
    ctx.clearRect(0, 0, 400, h);
    ctx.fillStyle = '#F0F5F9'; ctx.fillRect(0, 0, 400, h);
    // Soft corner washes and small paper-like accents.
    const wash = ctx.createRadialGradient(360, 90, 10, 360, 90, 220);
    wash.addColorStop(0, '#DCEAF5'); wash.addColorStop(1, '#F0F5F9');
    ctx.fillStyle = wash; ctx.fillRect(120, 0, 280, 300);
    ellipse(ctx, 20, h - 70, 105, 130, '#E0ECE8');
    if (g.scene === 'home') {
      this.drawHome(top, h);
      this.finishRender(h - (this.safeBottom || 0) - 46);
      return;
    }
    text(ctx, '小 猫 慢 生 活', 25, top + 26, 10, '#7890A5', '500');
    roundRect(ctx, 281, top + 12, 94, 25, 12, '#DEEBF3');
    text(ctx, `${AGE_RATING}+ · 适龄提示`, 328, top + 25, 10, '#577A99', '500', 'center');
    this.target(281, top + 8, 94, 36, () => g.openOverlay('health'), '适龄与健康');
    text(ctx, GAME_NAME, 24, top + 68, 29, INK, '700');
    text(ctx, '把小小的凌乱，整理成刚刚好。', 25, top + 101, 12, '#7D94A6');
    const idleTime = this.platform.reducedMotion ? 0 : g.now() / 1000;
    cat(ctx, 334, top + 84, 61, 1, { sleeping: true, variant: 4, time: idleTime });
    roundRect(ctx, 27, top + 127, 345, 4, 2, '#D6E2EB');
    const progress = g.save.clearedLevelIds.length / LEVEL_COUNT;
    if (progress > 0) roundRect(ctx, 27, top + 127, Math.max(4, 345 * progress), 4, 2, '#7FA496');
    text(ctx, `第 ${Math.floor(g.levelIndex / 10) + 1} 大关 · ${CHAPTERS[Math.floor(g.levelIndex / 10)]} · 本章 ${g.chapterProgress(Math.floor(g.levelIndex / 10))}/10`, 27, top + 141, 9, '#7D95A6');
    roundRect(ctx, 24, top + 154, 352, 65, 18, '#FFFFFF', '#D4E1EB');
    roundRect(ctx, 37, top + 166, 40, 40, 13, '#E4EEF5');
    text(ctx, String(g.levelIndex + 1).padStart(2, '0'), 57, top + 187, g.levelIndex === 99 ? 17 : 20, ACCENT, '700', 'center');
    text(ctx, g.level.name, 89, top + 178, 16, INK, '600');
    text(ctx, `小关 ${levelLabel(g.levelIndex)} · 总第 ${g.levelIndex + 1} 关`, 89, top + 199, 10, MUTED);
    text(ctx, String(g.run.moves).padStart(2, '0'), 340, top + 177, 20, ACCENT, '600', 'center');
    text(ctx, '已走步数', 340, top + 199, 9, MUTED, '400', 'center');
    this.target(24, top + 154, 260, 65, () => g.openOverlay('levels'), '选择关卡');

    const actionY = h - (this.safeBottom || 0) - 113;
    const boardTop = top + 245;
    const boardBottom = actionY - 45;
    const rowGap = Math.min(79, (boardBottom - boardTop) / g.run.board.length);
    const boardStart = boardTop + Math.max(0, (boardBottom - boardTop - rowGap * g.run.board.length) / 2);
    const catSize = Math.min(59, rowGap * 0.84);
    this.layout = { boardStart, rowGap, catSize, actionY };
    text(ctx, g.selected === null ? '同类坐一排 · 从右侧进出' : g.hint ? `提示：第 ${g.hint.from + 1} 排 → 第 ${g.hint.to + 1} 排` : '再点空排，或同类小猫所在的一排', 200, top + 235, 11, '#7691A6', '400', 'center');

    const positions = [];
    for (let rowIndex = 0; rowIndex < g.run.board.length; rowIndex++) {
      const row = g.run.board[rowIndex];
      let cy = boardStart + rowGap * rowIndex + rowGap / 2;
      const complete = fullRow(row, g.level.capacity);
      const selected = g.selected === rowIndex;
      const destination = g.selected !== null && canMove(g.run.board, g.level.capacity, g.selected, rowIndex);
      const hinted = g.hint && g.hint.to === rowIndex;
      let offset = 0;
      if (g.shake && g.shake.row === rowIndex && g.now() < g.shake.until) offset = Math.sin((g.shake.until - g.now()) / 17) * 3;
      ctx.save(); ctx.translate(offset, 0);
      const rowH = Math.min(66, rowGap - 7);
      roundRect(ctx, 39, cy - rowH / 2, 322, rowH, 15,
        selected ? '#D9EAF6' : complete ? '#DEECE7' : '#DFE8EF',
        hinted ? '#6F9D8D' : selected ? '#6D9ABB' : destination ? '#97B8AE' : '#B7CAD9', selected || hinted ? 2 : 1);
      text(ctx, String(rowIndex + 1), 24, cy + 6, 10, '#839CAC', '500', 'center');
      roundRect(ctx, 49, cy + rowH / 2 - 9, 300, 6, 3, complete ? '#A7C4B8' : '#B4C8D8');
      const availableW = 260;
      const seatW = availableW / g.level.capacity;
      const slots = [];
      for (let slot = 0; slot < g.level.capacity; slot++) {
        const cx = 63 + seatW * slot + seatW / 2;
        slots.push({ x: cx, y: cy });
        ellipse(ctx, cx, cy + rowH / 2 - 13, Math.min(20, seatW * 0.3), 3, '#C6D6E1');
        const animatingDestination = g.animation && g.now() < g.animation.until && g.animation.to === rowIndex && g.animation.toSlot === slot;
        if (slot < row.length && !animatingDestination) cat(ctx, cx, cy - 3, catSize, row[slot], {
          selected: selected && slot === row.length - 1, sleeping: complete,
          variant: (rowIndex * 17 + slot * 7 + row[slot] * 3) % 11, time: idleTime
        });
      }
      positions.push(slots);
      if (row.length === 0) text(ctx, '空排 · 可以暂住', 200, cy - 5, 11, '#829CAE', '400', 'center');
      if (complete) icon(ctx, 'check', 337, cy + 1, '#91A67E', 13);
      else icon(ctx, 'arrow', 336, cy + 1, hinted ? '#668D76' : '#87A1B5', 13);
      ctx.restore();
      if (!g.overlay) this.target(39, cy - rowH / 2 - 3, 322, rowH + 6, () => g.tapRow(rowIndex), `第${rowIndex + 1}排`);
    }
    if (g.animation && g.now() < g.animation.until) {
      const a = g.animation;
      const p = Math.max(0, Math.min(1, (g.now() - a.start) / (a.until - a.start)));
      const origin = positions[a.from][a.fromSlot];
      const dest = positions[a.to][a.toSlot];
      const travel = hopPosition(origin, dest, p, a.variant);
      const scale = catSize / 64;
      ellipse(ctx, travel.groundX, travel.groundY + 30 * scale, (20 - travel.height * 0.12) * scale, 3 * scale, 'rgba(41,65,83,0.16)');
      cat(ctx, travel.x, travel.y - 3, catSize, a.cat, { variant: a.variant, time: idleTime,
        moveProgress: p, facing: travel.facing, shadow: false });
    }

    const instructional = g.levelIndex === 0 && g.run.moves === 0 ? g.level.instruction : g.level.subtitle;
    text(ctx, instructional, 200, actionY - 23, 11, '#7891A5', '400', 'center');
    this.button(24, actionY, 105, 52, '撤回', () => g.undo(), { icon: 'undo', disabled: !g.run.history.length || g.inputLocked() });
    this.button(141, actionY, 105, 52, '重来', () => g.openOverlay('restart'), { icon: 'restart', disabled: g.inputLocked() });
    this.button(258, actionY, 118, 52, g.searching ? '取消' : '小提示', () => {
      if (g.searching) { g.cancelSearch(); g.notify('已取消提示，可以继续整理。'); }
      else g.requestHint();
    }, { icon: 'hint', primary: true, disabled: Boolean(g.animation && g.now() < g.animation.until) });
    this.button(132, actionY + 64, 136, 35, '返回主菜单', () => g.goHome(), { size: 11 });
    icon(ctx, 'help', 26, actionY + 71, '#7695AC', 20);
    this.target(16, actionY + 62, 42, 37, () => g.openOverlay('help'), '玩法说明');
    icon(ctx, 'settings', 352, actionY + 71, '#7695AC', 20);
    this.target(340, actionY + 62, 44, 37, () => g.openOverlay('settings'), '设置');

    if (g.repository.warning && !g.overlay) {
      roundRect(ctx, 40, top + 136, 320, 23, 8, '#FCE8DA');
      text(ctx, '本机存档有异常 · 点此查看或重试', 200, top + 148, 10, '#A36D4A', '500', 'center');
      this.target(40, top + 136, 320, 23, () => g.openOverlay('settings'), '存档状态');
    }
    this.finishRender(g.overlay ? h - (this.safeBottom || 0) - 46 : actionY - 61);
  }
  drawHome(top, h) {
    const ctx = this.ctx;
    const g = this.game;
    const time = this.platform.reducedMotion ? 0 : g.now() / 1000;
    text(ctx, '小 猫 慢 生 活', 200, top + 38, 11, '#7890A5', '500', 'center');
    roundRect(ctx, 301, top + 14, 75, 25, 12, '#DEEBF3');
    text(ctx, `${AGE_RATING}+ 适龄提示`, 338, top + 27, 9, '#577A99', '500', 'center');
    this.target(301, top + 8, 75, 36, () => g.openOverlay('health'), '适龄与健康');
    text(ctx, GAME_NAME, 200, top + 89, 34, INK, '700', 'center');
    text(ctx, '留一点时间，给小小的整齐。', 200, top + 125, 12, MUTED, '400', 'center');
    const y = Math.max(top + 155, Math.min(top + 205, h * 0.235));
    roundRect(ctx, 24, y + 6, 352, 310, 26, '#D6E3EC');
    roundRect(ctx, 24, y, 352, 310, 26, '#FFFFFF', '#D7E3EC');
    roundRect(ctx, 47, y + 21, 78, 24, 12, '#E4EFEB');
    text(ctx, '慢慢整理', 86, y + 33, 10, '#6C8D80', '500', 'center');
    ellipse(ctx, 200, y + 112, 120, 24, '#EBF2F7');
    roundRect(ctx, 73, y + 125, 254, 9, 4, '#BED0DF');
    cat(ctx, 125, y + 91, 71, 0, { variant: 1, time });
    cat(ctx, 200, y + 87, 77, 1, { variant: 4, time });
    cat(ctx, 277, y + 94, 66, 2, { variant: 7, time, sleeping: true });
    text(ctx, '经典排序', 200, y + 169, 23, INK, '700', 'center');
    text(ctx, '同类坐一排，让每只小猫都有伴。', 200, y + 201, 12, MUTED, '400', 'center');
    this.button(49, y + 236, 302, 48, g.save.hasStarted ? '继续游戏' : '开始游戏', () => g.startGame(), { primary: true, size: 16 });
    this.button(49, y + 335, 302, 43, '选择进度', () => g.openOverlay('chapters'), { size: 13 });
    roundRect(ctx, 92, y + 396, 216, 4, 2, '#D6E2EB');
    const progress = g.save.clearedLevelIds.length / LEVEL_COUNT;
    if (progress) roundRect(ctx, 92, y + 396, Math.max(4, 216 * progress), 4, 2, '#7FA496');
    text(ctx, `进度 ${levelLabel(g.levelIndex)} · 已整理 ${g.save.clearedLevelIds.length}/${LEVEL_COUNT} · 10 个大关`, 200, y + 416, 10, MUTED, '400', 'center');
    const footer = h - (this.safeBottom || 0);
    this.button(49, footer - 105, 143, 44, '玩法说明', () => g.openOverlay('help'), { size: 12 });
    this.button(208, footer - 105, 143, 44, '声音与设置', () => g.openOverlay('settings'), { size: 12 });
    text(ctx, '不赶时间，慢慢坐好。', 200, footer - 26, 10, '#88A0B1', '400', 'center');
    if (g.repository.warning) {
      text(ctx, '本机存档异常 · 请到设置中查看', 200, footer - 130, 10, '#A36D4A', '500', 'center');
    }
  }
  finishRender(toastY) {
    const ctx = this.ctx;
    const g = this.game;
    if (g.overlay) this.drawOverlay();
    if (g.toast) {
      if (g.now() >= g.toast.until) g.toast = null;
      else {
        const tw = Math.min(366, g.toast.message.length * 11 + 28);
        roundRect(ctx, (400 - tw) / 2, toastY, tw, 34, 13, 'rgba(76,62,84,0.93)');
        text(ctx, g.toast.message, 200, toastY + 17, 11, '#FFFFFF', '500', 'center');
      }
    }
    if (this.platform.updateAccessibility) this.platform.updateAccessibility(this.targets, g);
  }
  drawStory() {
    const ctx = this.ctx;
    const g = this.game;
    const chapter = g.storyChapter;
    const story = STORIES[chapter];
    const y = Math.max((this.safeTop || 0) + 16, (this.height - (this.safeBottom || 0) - 610) / 2);
    ctx.fillStyle = 'rgba(41,62,81,0.44)'; ctx.fillRect(0, 0, 400, this.height);
    roundRect(ctx, 24, y + 5, 352, 610, 22, 'rgba(32,53,70,0.17)');
    roundRect(ctx, 24, y, 352, 610, 22, '#FBFCF9');
    text(ctx, story.title, 46, y + 33, 20, INK, '700');
    text(ctx, `第 ${chapter + 1} 大关 · ${CHAPTERS[chapter]} · 通关漫画`, 46, y + 61, 10, '#78928E');
    icon(ctx, 'close', 341, y + 20, '#92A6B5', 17);
    this.target(329, y + 8, 40, 40, () => g.finishStory(), '关闭漫画');
    story.panels.forEach((panel, i) => {
      const py = y + 85 + i * 123;
      drawComicPanel(ctx, 46, py, 308, 88, chapter, i);
      text(ctx, panel[0], 200, py + 106, 10.5, INK, '400', 'center');
    });
    text(ctx, story.next, 200, y + 473, 10, '#78928E', '500', 'center');
    const atCompletion = g.storyReturn === 'complete';
    const label = atCompletion ? chapter === 9 ? '回到进度选择' : `前往第 ${chapter + 2} 大关` : '返回进度';
    this.button(49, y + 499, 302, 44, label, () => g.finishStory(atCompletion), { primary: true, size: 13 });
    this.button(106, y + 558, 188, 31, atCompletion ? '跳过剧情 · 返回通关' : '关闭漫画', () => g.finishStory(), { size: 10 });
  }
  drawOverlay() {
    const ctx = this.ctx;
    const g = this.game;
    const h = this.height;
    this.targets = [];
    if (g.overlay === 'story') { this.drawStory(); return; }
    ctx.fillStyle = 'rgba(41,62,81,0.30)'; ctx.fillRect(0, 0, 400, h);
    const kind = g.overlay;
    const boxH = kind === 'health' ? 448 : kind === 'chapters' ? 600 : kind === 'levels' ? 540 : kind === 'help' ? 426 : kind === 'settings' ? 520 : kind === 'complete' ? 365 : 230;
    const y = Math.max(this.safeTop + 30, (h - boxH) / 2);
    roundRect(ctx, 24, y + 7, 352, boxH, 25, 'rgba(39,66,86,0.12)');
    roundRect(ctx, 24, y, 352, boxH, 25, '#F8FBFD');
    if (kind !== 'complete') {
      icon(ctx, 'close', 338, y + 21, '#B1A1B3', 20);
      this.target(328, y + 11, 40, 40, () => g.closeOverlay(), '关闭');
    }
    if (kind === 'health') {
      text(ctx, '适龄提示与健康游戏', 49, y + 48, 21, INK, '700');
      roundRect(ctx, 49, y + 83, 58, 61, 12, '#E0EDE7');
      text(ctx, `${AGE_RATING}+`, 78, y + 114, 25, '#668C7A', '700', 'center');
      text(ctx, `适合 ${AGE_RATING} 周岁及以上用户`, 123, y + 102, 14, INK, '600');
      text(ctx, '未成年人请在监护人指导下使用。', 123, y + 129, 11, MUTED);
      text(ctx, '健康游戏忠告', 200, y + 182, 18, INK, '600', 'center');
      HEALTH_ADVICE.forEach((line, index) => text(ctx, line, 200, y + 222 + index * 27, 14, INK, '400', 'center'));
      this.button(49, y + 345, 302, 46, '知道了', () => g.closeOverlay(), { primary: true });
      text(ctx, '请合理安排游戏时间。', 200, y + 419, 11, MUTED, '400', 'center');
    } else if (kind === 'chapters') {
      text(ctx, '选择进度', 49, y + 43, 22, INK, '700');
      text(ctx, `10 个大关 · 每个 10 个小关 · 已完成 ${g.save.clearedLevelIds.length}/100`, 49, y + 76, 11, MUTED);
      CHAPTERS.forEach((name, chapter) => {
        const cx = 45 + chapter % 2 * 162;
        const cy = y + 105 + Math.floor(chapter / 2) * 84;
        const count = g.chapterProgress(chapter);
        const unlocked = g.available(chapter * 10);
        const current = Math.floor(g.levelIndex / 10) === chapter;
        roundRect(ctx, cx, cy + 3, 148, 74, 13, '#DCE6EC');
        roundRect(ctx, cx, cy, 148, 74, 13, current ? '#E0EDF5' : count === 10 ? '#E4EEE8' : '#FFFFFF', current ? '#7FA4BE' : '#D6E1E9');
        text(ctx, String(chapter + 1).padStart(2, '0'), cx + 12, cy + 23, 16, unlocked ? ACCENT : '#A1B3C0', '700');
        text(ctx, name, cx + 43, cy + 23, 12, unlocked ? INK : MUTED, '600');
        text(ctx, count === 10 ? '已完成 · 漫画已解锁' : unlocked ? `小关 ${count}/10 · ${current ? '当前大关' : '可游玩'}` : '待解锁 · 可查看目标', cx + 12, cy + 46, 9, MUTED);
        roundRect(ctx, cx + 12, cy + 62, 124, 3, 2, '#DCE6EB');
        if (count) roundRect(ctx, cx + 12, cy + 62, Math.max(3, 124 * count / 10), 3, 2, '#83A799');
        this.target(cx, cy, 148, 77, () => g.chooseChapter(chapter), `大关${chapter + 1}：${name}`);
      });
      this.button(49, y + 541, 302, 39, g.scene === 'home' ? '返回主菜单' : '回到当前关卡', () => g.closeOverlay(), { size: 12 });
    } else if (kind === 'levels') {
      text(ctx, '小关与剧情', 49, y + 40, 21, INK, '700');
      this.button(49, y + 67, 107, 31, '大关目录', () => g.openOverlay('chapters'), { size: 11 });
      text(ctx, `已完成 ${g.chapterProgress(g.chapterPage)}/10 小关`, 351, y + 83, 10, MUTED, '400', 'right');
      const page = g.chapterPage;
      this.button(46, y + 102, 43, 37, '‹', () => g.changeChapter(-1), { disabled: page === 0, size: 22 });
      this.button(311, y + 102, 43, 37, '›', () => g.changeChapter(1), { disabled: page === CHAPTERS.length - 1, size: 22 });
      text(ctx, `第 ${page + 1} 大关 · ${CHAPTERS[page]}`, 200, y + 120, 13, INK, '600', 'center');
      LEVELS.slice(page * 10, page * 10 + 10).forEach((level, cell) => {
        const index = page * 10 + cell;
        const unlocked = g.available(index);
        const cleared = g.save.clearedLevelIds.includes(level.id);
        const lx = 45 + (cell % 5) * 63;
        const ly = y + 162 + Math.floor(cell / 5) * 88;
        roundRect(ctx, lx, ly, 57, 73, 14, index === g.levelIndex ? '#DDEBF5' : cleared ? '#E0EBE5' : unlocked ? '#E9EFF3' : '#EAF0F4', index === g.levelIndex ? '#8FB0C9' : null);
        text(ctx, levelLabel(index), lx + 28.5, ly + 28, 16, cleared ? '#6F907B' : unlocked ? ACCENT : '#AABBC7', '600', 'center');
        const resume = index === g.levelIndex && g.run.moves > 0 || Boolean(g.save.savedRuns[level.id]);
        text(ctx, !unlocked ? '待解锁' : resume ? '继续' : index === g.levelIndex ? '当前小关' : cleared ? '可重玩' : '去整理', lx + 28.5, ly + 56, 9, unlocked ? MUTED : '#AABBC7', '400', 'center');
        if (unlocked) this.target(lx, ly, 57, 73, () => g.selectLevel(index), `小关${levelLabel(index)}：${level.name}`);
      });
      roundRect(ctx, 45, y + 337, 310, 105, 14, '#E6EFF4');
      text(ctx, `本章漫画 · ${STORIES[page].title}`, 59, y + 356, 12, INK, '600');
      text(ctx, STORIES[page].teaser, 59, y + 381, 10, MUTED);
      const storyReady = g.chapterComplete(page);
      this.button(59, y + 402, 282, 29, storyReady ? '阅读本章漫画' : `完成本大关解锁漫画 · ${g.chapterProgress(page)}/10`, () => g.openStory(page), { size: 10, disabled: !storyReady });
      this.button(49, y + 463, 302, 39, g.scene === 'home' ? '返回主菜单' : '回到当前关卡', () => g.closeOverlay(), { size: 12 });
      text(ctx, '已开始的小关可继续，完成一关解锁下一关。', 200, y + 522, 10, '#8C9FAE', '400', 'center');
    } else if (kind === 'complete') {
      cat(ctx, 156, y + 80, 67, 0, { sleeping: true, variant: 2 }); cat(ctx, 222, y + 80, 67, 1, { sleeping: true, variant: 4 });
      const last = g.levelIndex === LEVELS.length - 1;
      const chapterEnd = g.levelIndex % 10 === 9;
      text(ctx, last ? '100 关，都坐好啦！' : '这一屋，整整齐齐。', 200, y + 147, 23, INK, '700', 'center');
      text(ctx, last ? '本轮试玩完成，谢谢你陪小猫坐了一会儿。' : `你用 ${g.run.moves} 步，帮小猫找到了同伴。`, 200, y + 183, 12, MUTED, '400', 'center');
      this.button(53, y + 220, 294, 48, last ? '回到关卡 · 自由重玩' : '去下一关', () => g.next(), { primary: true });
      this.button(53, y + 283, 140, 43, '重玩本关', () => g.restart(), { size: 12 });
      const replayStory = chapterEnd && g.chapterComplete(Math.floor(g.levelIndex / 10));
      this.button(207, y + 283, 140, 43, replayStory ? '回看本章漫画' : '导出试玩记录', () => replayStory ? g.openStory(Math.floor(g.levelIndex / 10), 'complete') : g.exportLog(), { size: 12 });
    } else if (kind === 'restart') {
      text(ctx, '让小猫重新入座？', 200, y + 56, 22, INK, '700', 'center');
      text(ctx, '本关会从头开始，已通关记录会保留。', 200, y + 100, 12, MUTED, '400', 'center');
      this.button(48, y + 151, 145, 47, '继续整理', () => g.closeOverlay());
      this.button(207, y + 151, 145, 47, '重新开始', () => g.restart(), { primary: true });
    } else if (kind === 'help') {
      text(ctx, '小猫的入座指南', 49, y + 47, 22, INK, '700');
      const rules = [
        ['01', '先选，再落座', '点一排最右侧小猫，再点目标排。'],
        ['02', '只和同类挨着坐', '可以去空排，或去最右侧同类的旁边。'],
        ['03', '每排都整理好', '非空排需要坐满同类小猫，才算完成。'],
        ['04', '没有时间压力', '撤回、重来和小提示都可以免费使用。']
      ];
      rules.forEach((rule, i) => {
        const ry = y + 106 + i * 64;
        text(ctx, rule[0], 50, ry, 17, '#AD96BF', '600');
        text(ctx, rule[1], 88, ry - 3, 14, INK, '600');
        text(ctx, rule[2], 88, ry + 19, 11, MUTED);
      });
      this.button(49, y + 349, 302, 47, '知道啦，让小猫坐好', () => g.closeOverlay(), { primary: true });
    } else if (kind === 'settings') {
      text(ctx, '声音与设置', 49, y + 47, 22, INK, '700');
      const settings = g.save.settings;
      text(ctx, '游戏音效', 50, y + 99, 15, INK, '500');
      text(ctx, `${Math.round(settings.soundVolume * 100)}%`, 220, y + 99, 12, MUTED, '500', 'right');
      this.button(247, y + 79, 104, 38, settings.soundEnabled ? '音效：开' : '音效：关', () => g.toggleSound(), { size: 12 });
      this.slider(60, y + 146, 280, 'sound', '游戏音效音量');
      text(ctx, '背景音乐', 50, y + 200, 15, INK, '500');
      text(ctx, `${Math.round(settings.musicVolume * 100)}%`, 220, y + 200, 12, MUTED, '500', 'right');
      this.button(247, y + 180, 104, 38, settings.musicEnabled ? '音乐：开' : '音乐：关', () => g.toggleMusic(), { size: 12 });
      this.slider(60, y + 247, 280, 'music', '背景音乐音量');
      text(ctx, '进度保存在这台设备上', 50, y + 301, 14, INK, '500');
      text(ctx, '清理缓存或换设备后，进度可能无法恢复。', 50, y + 327, 11, MUTED);
      if (g.repository.warning) {
        text(ctx, '存档异常：请点击下方按钮重试保存。', 50, y + 356, 11, '#AF7854');
      } else text(ctx, '本机存档正常 · 无需注册账号', 50, y + 356, 11, '#8A9F7E');
      this.button(49, y + 383, 302, 43, '重新保存进度', () => g.notify(g.persist() ? '已保存到这台设备。' : '保存仍未成功，请检查设备空间。'), { size: 12 });
      this.button(49, y + 439, 302, 43, '导出试玩记录', () => g.exportLog(), { size: 12 });
      text(ctx, '设置自动保存 · 两种声音可分别关闭', 200, y + 502, 10, '#8C9FAE', '400', 'center');
    }
  }
}

module.exports = { View };

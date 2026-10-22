'use strict';

// Left to right, the rightmost cat is the accessible exit of each row.
// Keep tutorial boards/ids and pack version unchanged to preserve v0.1 saves.
const { generateLevel } = require('./generator.js');
const PACK_VERSION = 1;
const TUTORIAL_LEVELS = [
  {
    id: 'first-paw', name: '初次见面', subtitle: '让最后一只小猫，找到同伴。',
    capacity: 3, board: [[0, 0, 0], [1, 1], [1]],
    instruction: '先点第三排的小猫，再点第二排。'
  },
  {
    id: 'swap-seats', name: '交换座位', subtitle: '换个位置，就能坐在一起。',
    capacity: 3, board: [[0, 0, 1], [1, 1, 0], []],
    instruction: '点一排最右边的小猫，再点空排或同类小猫。'
  },
  {
    id: 'a-little-room', name: '留一点空位', subtitle: '空着的座位，也有它的用处。',
    capacity: 3, board: [[0, 1, 2], [2, 0, 1], [1, 2, 0], [], []],
    instruction: '试着用空排暂存，让里面的小猫走出来。'
  },
  {
    id: 'think-again', name: '再想一步', subtitle: '没关系，可以回头试试看。',
    capacity: 4, board: [[0, 1, 0, 2], [1, 2, 1, 0], [2, 0, 2, 1], [], []],
    instruction: '只移动每排最右边的一只。走错了可以免费撤回。'
  },
  {
    id: 'all-together', name: '都坐好了吗', subtitle: '给每只小猫安排好座位。',
    capacity: 4, board: [[0, 1, 2, 3], [3, 2, 1, 0], [1, 0, 3, 2], [2, 3, 0, 1], [], []],
    instruction: '慢慢来。用好空位，把每一类都安排在同一排。'
  }
];

const TUTORIAL_SOLUTIONS = [
  [[2, 1]],
  [[0, 2], [1, 0], [2, 1]],
  [[0, 3], [0, 4], [1, 4], [1, 0], [1, 3], [2, 0], [2, 3], [2, 4]],
  [[0, 3], [0, 4], [1, 4], [1, 0], [1, 3], [0, 1], [0, 1], [0, 4], [2, 1], [2, 3], [2, 4], [2, 3]],
  [[0, 4], [1, 5], [2, 0], [2, 4], [2, 5], [1, 2], [3, 2], [3, 5], [3, 4], [0, 3], [0, 3], [0, 2], [0, 5], [1, 3], [1, 4]]
];
const CHAPTERS = ['初来小屋', '午后窗台', '纸箱派对', '花园来客', '柔软沙发', '茶点时间', '晴天阳台', '屋顶晚风', '月光客厅', '一起回家'];
const LEVEL_COUNT = 100;
// Metadata only. Opening a chapter never creates its puzzle boards.
const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, index) => ({
  id: index < 5 ? TUTORIAL_LEVELS[index].id : `generated-v1-${String(index + 1).padStart(3, '0')}`,
  name: index < 5 ? TUTORIAL_LEVELS[index].name : `${CHAPTERS[Math.floor(index / 10)]} · ${(index % 10) + 1}`,
  chapter: Math.floor(index / 10),
  number: index + 1
}));
let cachedIndex = -1;
let cachedLevel = null;
function getLevel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT) throw new RangeError('Invalid level index');
  if (index !== cachedIndex) {
    const content = index < 5 ? { ...TUTORIAL_LEVELS[index], solution: TUTORIAL_SOLUTIONS[index].map(([from, to]) => ({ from, to })) } : {
      ...generateLevel(index + 1),
      subtitle: ['窗边的光刚刚好，慢慢整理吧。', '有空位的时候，先想想留给谁。', '小猫各有脾气，也各有自己的座位。'][(index + 1) % 3],
      instruction: '利用空排周转，让同类小猫坐在一起。'
    };
    cachedLevel = { ...content, ...LEVELS[index] };
    cachedIndex = index;
  }
  return cachedLevel;
}
function getLevelById(id) {
  const index = LEVELS.findIndex(level => level.id === id);
  return index < 0 ? null : getLevel(index);
}

module.exports = { LEVELS, LEVEL_COUNT, CHAPTERS, PACK_VERSION, getLevel, getLevelById };

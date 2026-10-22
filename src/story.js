'use strict';
const { GAME_NAME } = require('./brand.js');

// Three short panels per chapter. Story unlocks follow completed puzzles, not views.
const STORIES = [
  { title: '门口的第一声喵', teaser: '小屋里，谁会第一个留下来？', next: '窗台上，似乎还少一个位置。', scene: 'home',
    panels: [['橘子叼着一片叶子，来到空空的小屋。', '这里，也能算家吗？'], ['灰灰挪了挪，给新朋友留出一个位置。', '过来，一起坐。'], ['奶茶也来了。三只小猫挤在一起，灯亮了。', '今晚，就住这里吧。']] },
  { title: '把阳光分成三份', teaser: '窗台上的阳光，只够一只猫吗？', next: '门外送来了一个大纸箱。', scene: 'window',
    panels: [['午后的窗台，只有中间晒得到太阳。', '我也想暖暖爪子。'], ['橘子往旁边靠，灰灰把垫子铺平。', '再挪一点点。'], ['大家排排坐，尾巴都晒得暖洋洋的。', '阳光，刚刚好够分。']] },
  { title: '纸箱里装着谁', teaser: '一个会动的纸箱，停在了门口。', next: '纸箱旁，留下了一串通向花园的脚印。', scene: 'boxes',
    panels: [['新纸箱摇摇晃晃，里面传来小小的声音。', '咚，咚。'], ['灰灰掀开箱盖，奶茶探出了脑袋。', '原来是你呀！'], ['纸箱变成小城堡，午后有了新的游戏。', '这里，就是秘密基地。']] },
  { title: '花园里的脚印', teaser: '是谁每天悄悄给花园浇水？', next: '玩累了，大家想要一张软软的沙发。', scene: 'garden',
    panels: [['奶茶顺着小脚印，走到还没开花的花盆前。', '你在等什么呢？'], ['墨墨推来水壶，大家一起照顾小苗。', '我们一起等。'], ['第一朵花开了，花园也多了一位朋友。', '明天，还来这里坐。']] },
  { title: '沙发上的空位', teaser: '最后一个舒服的位置，要留给谁？', next: '厨房里，飘出了茶点的香味。', scene: 'sofa',
    panels: [['一张软沙发进了门，橘子先占住了中间。', '这里最舒服。'], ['看到门边的朋友，橘子悄悄挪开了。', '这边，还有位置。'], ['小猫挤成一团，靠在哪里都很柔软。', '原来，是靠着你舒服。']] },
  { title: '少了一块小饼干', teaser: '盘子里的最后一块茶点，该给谁？', next: '明天晴天，一起去阳台吧。', scene: 'tea',
    panels: [['下午茶摆好了，饼干却比小猫少一块。', '咦，怎么不够？'], ['奶茶把自己的饼干，轻轻分成了两半。', '一半，也是甜的。'], ['每个盘子都有了茶点，每只猫都有了笑脸。', '下次，还要一起吃。']] },
  { title: '风把约定带走了', teaser: '阳台上的一张小画，忽然飞走了。', next: '小画停在屋顶上，谁愿意去看看？', scene: 'balcony',
    panels: [['灰灰画好了全家福，放在阳台上晾干。', '一只都没有少。'], ['风轻轻一吹，小画飘过了栏杆。', '呀，我们的画！'], ['大家望向屋顶，约好一起把画找回来。', '谁也不许单独去。']] },
  { title: '屋顶上的小队', teaser: '找回全家福，需要每只猫帮一点忙。', next: '月亮升起来，家里的灯还亮着。', scene: 'rooftop',
    panels: [['橘子找到一条稳稳的小路，带大家来到屋顶。', '跟着我，慢一点。'], ['墨墨按住画角，灰灰终于接住了画。', '抓到啦！'], ['晚风吹过，画里画外的小猫都挨在一起。', '这次，真的一个不少。']] },
  { title: '等最后一只猫回家', teaser: '灯都亮了，门口为什么还留着一个垫子？', next: '明天，小屋要挂上一块新招牌。', scene: 'moon',
    panels: [['月亮照着客厅，奶茶还没从花园回来。', '她会不会找不到门？'], ['大家点亮门灯，在窗边留出一个空位。', '我们等你。'], ['熟悉的脚步声响起，最后一个位置也坐满了。', '回来就好。']] },
  { title: '这里就是我们的家', teaser: '小屋终于有名字了，你想到了吗？', next: '故事暂时落在这里，小屋一直为你留着位置。', scene: 'together',
    panels: [['灰灰拿来木牌，大家围着它认真想了好久。', '小屋叫什么好呢？'], ['橘子画了一排座位，奶茶添上一只小爪印。', `就叫，${GAME_NAME}。`], ['招牌挂好了。从此每次回来，都有同伴等你。', '下一次，也一起坐吧。']] }
];

function chapterProgress(clearedIds, chapter) {
  const { LEVELS } = require('./levels.js');
  if (!Number.isInteger(chapter) || chapter < 0 || chapter >= STORIES.length) return 0;
  return LEVELS.slice(chapter * 10, chapter * 10 + 10).filter(level => clearedIds.includes(level.id)).length;
}
function chapterComplete(clearedIds, chapter) { return chapterProgress(clearedIds, chapter) === 10; }
function levelLabel(index) { return `${Math.floor(index / 10) + 1}-${index % 10 + 1}`; }

module.exports = { STORIES, chapterProgress, chapterComplete, levelLabel };

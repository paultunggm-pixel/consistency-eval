// 千问小讲堂封面渲染参数常量
// 从 Python render_covers.py 提取，设计坐标体系 (dp)

const SCALE = 4;
const DESIGN_W = 144, DESIGN_H = 192;
const W = DESIGN_W * SCALE, H = DESIGN_H * SCALE; // 576 x 768

function sp(dp) { return dp * SCALE; }

const STYLES = {
  // ---- style1: 小低数学 ----
  style1: {
    name: '小低数学',
    id: 1,
    badgeType: 'drape',  // 垂帘形
    hook: {
      font: 'ZaoziGongfangYuanhei',
      size: 20.0, min: 12.0, color: '#FFFFFF',
      x: 8.64, yFirst: 28.8, maxW: 128.0,
      tracking: 1.44, lineH: 24.1,
    },
    tag: {
      font: 'AlibabaPuHuiTi',
      weight: 'Medium',
      size: 9.12, color: '#FFFFFF',
      gap: 7.0, padX: 6.75, h: 16.0,
      radius: 10.56, stroke: 0.96,
    },
    badge: {
      font: 'AlibabaPuHuiTi',
      weight: 'Bold',
      size: 11.52, text: '千问小讲堂',
      x: 12.0, cy: 10.26,
      w: 63.36, h: 23.04,
      darken: 0.70,
    },
    scrim: null,  // style1 无底部压暗
  },

  // ---- style2: 小高数学 ----
  style2: {
    name: '小高数学',
    id: 2,
    badgeType: 'roundRect',
    hook: {
      font: 'AlibabaPuHuiTi',
      weight: 'Bold',
      size: 20.0, min: 12.0, color: '#FFFFFF',
      x: 8.64, yFirst: 28.8, maxW: 128.0,
      tracking: 0.0, lineH: 23.3,
    },
    tag: {
      font: 'AlibabaPuHuiTi',
      weight: 'Medium',
      size: 9.12, color: '#FFFFFF',
      gap: 7.0, padX: 6.75, h: 16.0,
      radius: 1.92, stroke: 0.96,
    },
    badge: {
      font: 'AlibabaPuHuiTi',
      weight: 'Bold',
      size: 11.52, text: '千问小讲堂',
      x: 12.0, cy: 10.26,
      w: 63.36, h: 21.6,
      darken: 0.70,
    },
    scrim: null,
  },

  // ---- style3: 语文/科普单名 ----
  style3: {
    name: '语文/科普',
    id: 3,
    badgeType: 'frosted',
    title: {
      font: 'HYXinRenWenSong',
      weight: '65W',
      size: 22.99, min: 16.0, minOneLine: 18.0,
      color: '#FFFFFF',
      maxW: 128.0, tracking: 1.44,
      lineH: 24.1, cy: 150.0,
    },
    badge: {
      font: 'AlibabaPuHuiTi',
      weight: 'Bold',
      size: 11.52, text: '千问小讲堂',
      x: 12.0, cy: 10.26,
      w: 63.36, h: 21.6,
      alpha: 0.60, blur: 3,
    },
    scrim: {
      color: [12, 12, 16],
      yStart: 0.50,  // 50% 高度起
      yFull: 0.74,    // 74% 满强度
      maxAlpha: 0.78,
      lumLow: 90, lumHigh: 230,
    },
  },

  // ---- 成语双行 ----
  chengyu: {
    name: '成语故事',
    id: 4,
    badgeType: 'frosted',
    main: {
      font: 'HYXinRenWenSong',
      weight: '65W',
      size: 22.99, min: 12.0, color: '#FFFFFF',
      maxW: 120.0, tracking: 1.44,
      lineH: 24.1, cy: 140.5,
    },
    sub: {
      font: 'HYXinRenWenSong',
      weight: 'W',
      size: 11.52, min: 10.0, color: '#FFFFFF',
      alpha: 0.70,
      maxW: 100.0, tracking: 1.09,
      lineH: 13.4, cy: 169.98,
    },
    badge: {
      font: 'AlibabaPuHuiTi',
      weight: 'Bold',
      size: 11.52, text: '千问小讲堂',
      x: 12.0, cy: 10.26,
      w: 63.36, h: 21.6,
      alpha: 0.60, blur: 3,
    },
    scrim: {
      color: [12, 12, 16],
      yStart: 0.50, yFull: 0.74,
      maxAlpha: 0.78,
      lumLow: 90, lumHigh: 230,
    },
  }
};

// 行首禁则字符：不可出现在行首
const NO_LINE_START = '）)】》」』〕〉、，。．！？：；·…—\'\"%》';
// 行尾禁则字符：不可出现在行尾
const NO_LINE_END = '（(【《「『〔〈\'\"';

// 标点归一化
function normalizePunct(s) {
  return s.replace(/・/g, '·');
}

// 从学名中提取书名号内文字
function displayNameFromXueming(name) {
  const m = name.match(/《(.+?)》/);
  return m ? m[1] : name;
}

// 防孤字：2行时末行只有1字，从上一行拉一字
function avoidOrphan(lines) {
  if (lines.length === 2 && lines[1].length === 1 && lines[0].length > 1) {
    const last = lines[0][lines[0].length - 1];
    lines[0] = lines[0].slice(0, -1);
    lines[1] = last + lines[1];
  }
  return lines;
}

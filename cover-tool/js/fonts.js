// 字体加载管理

const FONT_SPECS = {
  'ZaoziGongfangYuanhei': { file: 'fonts/ZaoziGongfangYuanhei-Regular.ttf', weight: 'Regular' },
  'AlibabaPuHuiTi': {
    Regular: { file: 'fonts/Alibaba-PuHuiTi-Regular.ttf' },
    Medium: { file: 'fonts/Alibaba-PuHuiTi-Medium.ttf' },
    Bold: { file: 'fonts/Alibaba-PuHuiTi-Bold.ttf' },
  },
  'HYXinRenWenSong': {
    '65W': { file: 'fonts/HYXinRenWenSong65W.ttf' },
    'W': { file: 'fonts/HYXinRenWenSongW.ttf' },
  }
};

const loadedFonts = {};

// 获取字体 family 名称（用于 CSS/Canvas）
function fontFamily(fontName, weight) {
  if (weight) return `${fontName}-${weight}`;
  return `${fontName}-Regular`;
}

// 加载单个字体
async function loadFont(fontName, weight, file) {
  const family = fontFamily(fontName, weight);
  const key = family;
  if (loadedFonts[key]) return loadedFonts[key];

  try {
    const font = new FontFace(family, `url(${file})`);
    const loaded = await font.load();
    document.fonts.add(loaded);
    loadedFonts[key] = true;
    console.log(`[Fonts] Loaded: ${family}`);
    return true;
  } catch (e) {
    console.warn(`[Fonts] Failed to load ${family}:`, e.message);
    return false;
  }
}

// 加载所有字体
async function loadAllFonts(onProgress) {
  const tasks = [];
  const total = 6;
  let done = 0;

  for (const [name, spec] of Object.entries(FONT_SPECS)) {
    if (typeof spec.file === 'string') {
      tasks.push(
        loadFont(name, null, spec.file).then(r => { done++; onProgress && onProgress(done, total); return r; })
      );
    } else {
      for (const [weight, wSpec] of Object.entries(spec)) {
        tasks.push(
          loadFont(name, weight, wSpec.file).then(r => { done++; onProgress && onProgress(done, total); return r; })
        );
      }
    }
  }

  const results = await Promise.all(tasks);
  const ok = results.filter(Boolean).length;
  console.log(`[Fonts] ${ok}/${total} fonts loaded`);
  return ok;
}

// 获取 Canvas font 字符串
function canvasFont(spec) {
  // spec: { font, weight, size }
  const family = fontFamily(spec.font, spec.weight);
  const weight = spec.weight === 'Bold' || spec.weight === '65W' ? 'bold' : 'normal';
  return `${weight} ${sp(spec.size)}px "${family}"`;
}

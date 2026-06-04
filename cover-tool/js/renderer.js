// Canvas 封面渲染引擎
// 从 Python render_covers.py 逐函数翻译

// ====== 底图加载与裁剪 ======

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

// cover_resize: 缩放使短边填满，中心裁剪
function coverResize(img, tw, th) {
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(tw / img.width, th / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  const sx = (sw - tw) / 2;
  const sy = (sh - th) / 2;
  ctx.drawImage(img, -sx, -sy, sw, sh);
  return canvas;
}

// ====== 颜色工具 ======

function getPixel(canvas, x, y) {
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
}

function rgbToLuma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// 采样顶部区域取主色
function sampleTopColor(canvas, sampleH) {
  const ctx = canvas.getContext('2d');
  const h = Math.min(sampleH, canvas.height);
  // 缩小到 1xN 取平均
  const small = document.createElement('canvas');
  small.width = 1;
  small.height = h;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, canvas.width, h, 0, 0, 1, h);
  const data = sctx.getImageData(0, 0, 1, h).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  const n = data.length / 4;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

// 采样区域亮度
function regionLuma(canvas, x, y, w, h) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(x, y, w, h).data;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += rgbToLuma(data[i], data[i + 1], data[i + 2]);
  }
  return total / (data.length / 4);
}

// 区域亮度（scaled坐标）
function regionLumaScaled(canvas, dx, dy, dw, dh) {
  return regionLuma(canvas, sp(dx), sp(dy), sp(dw), sp(dh));
}

// ====== 钩子/标题排版 ======

// 贪心换行
function wrapGreedy(ctx, text, maxW) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    const test = cur + ch;
    if (ctx.measureText(test).width > maxW && cur.length > 0) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length === 0 ? [''] : lines;
}

// layout_hook: style1/2 钩子排版
function layoutHook(ctx, text, spec, scale) {
  // 逐字测量时需要加 tracking
  let px = spec.size * scale;
  while (px >= spec.min * scale) {
    ctx.font = `${spec.weight || 'normal'} ${px}px "${fontFamily(spec.font, spec.weight)}"`;
    const trackingPx = spec.tracking * scale;
    const totalMaxW = spec.maxW * scale;

    // 用逐字宽度模拟 tracking
    const lines = wrapGreedyWithTracking(ctx, text, totalMaxW, trackingPx);
    if (lines.length <= 2) {
      const fixed = avoidOrphan(lines);
      return { lines: fixed, px, trackingPx };
    }
    px -= 0.5 * scale;
  }
  // fallback
  ctx.font = `${spec.min * scale}px "${fontFamily(spec.font, spec.weight)}"`;
  const trackingPx = spec.tracking * scale;
  const lines = wrapGreedyWithTracking(ctx, text, spec.maxW * scale, trackingPx);
  return { lines: avoidOrphan(lines), px: spec.min * scale, trackingPx };
}

function wrapGreedyWithTracking(ctx, text, maxW, trackingPx) {
  const lines = [];
  let cur = '';
  let curW = 0;
  for (const ch of text) {
    const chW = ctx.measureText(ch).width + trackingPx;
    if (curW + chW > maxW && cur.length > 0) {
      lines.push(cur);
      cur = ch;
      curW = chW;
    } else {
      cur += ch;
      curW += chW;
    }
  }
  if (cur) lines.push(cur);
  return lines.length === 0 ? [''] : lines;
}

// style3 style 标点感知换行
function layoutTitleCJK(ctx, text, spec, scale) {
  const maxW = spec.maxW * scale;
  let px = spec.size * scale;
  let bestLines = null;
  let bestPx = px;

  while (px >= spec.min * scale) {
    ctx.font = `normal ${px}px "${fontFamily(spec.font, spec.weight)}"`;
    // 先试一行
    if (ctx.measureText(text).width <= maxW && px >= spec.minOneLine * scale) {
      return { lines: [text], px, isOneLine: true };
    }
    // 搜断行点
    const lines = breakCJK(ctx, text, maxW);
    if (lines && (!bestLines || lines.length < bestLines.length)) {
      bestLines = lines;
      bestPx = px;
    }
    if (bestLines && bestLines.length <= 2) break;
    px -= 0.5 * scale;
  }

  if (bestLines) {
    return { lines: avoidOrphan(bestLines), px: bestPx, isOneLine: false };
  }
  // fallback: 对半切
  const mid = Math.ceil(text.length / 2);
  return { lines: [text.slice(0, mid), text.slice(mid)], px: spec.min * scale, isOneLine: false };
}

function breakCJK(ctx, text, maxW) {
  const positions = []; // { idx, priority }
  for (let i = 1; i < text.length - 1; i++) {
    const ch = text[i];
    if (NO_LINE_START.includes(ch)) {
      // 闭合标点后断开，优先级最高
      positions.push({ idx: i + 1, priority: 0 });
    } else if (NO_LINE_END.includes(ch)) {
      // 开启标点前断开——不在行首断
      // 标点前面的位置也可断开
      positions.push({ idx: i, priority: 1 });
    } else if ('，,、；;。．！!？?…—'.includes(ch)) {
      positions.push({ idx: i + 1, priority: 1 });
    }
  }

  // 找让两行字数最均衡的断点
  let best = null;
  let bestBalance = Infinity;
  for (const { idx, priority } of positions) {
    if (idx <= 1 || idx >= text.length - 1) continue;
    const l1 = text.slice(0, idx);
    const l2 = text.slice(idx);
    if (ctx.measureText(l1).width > maxW) continue;
    if (ctx.measureText(l2).width > maxW) continue;
    const balance = Math.abs(l1.length - l2.length) + priority * 10;
    if (balance < bestBalance) {
      bestBalance = balance;
      best = [l1, l2];
    }
  }

  if (!best && text.length > 2) {
    // 无标点：找使两行均衡的中点
    for (let i = Math.floor(text.length / 3); i < Math.ceil(text.length * 2 / 3); i++) {
      const l1 = text.slice(0, i);
      const l2 = text.slice(i);
      if (ctx.measureText(l1).width <= maxW && ctx.measureText(l2).width <= maxW) {
        return [l1, l2];
      }
    }
  }

  return best;
}

// 成语钩子断行：优先在逗号/顿号/分号处断为两行
function wrapHookLines(ctx, text, maxW) {
  const breakChars = ['，', ',', '、', '；', ';'];
  for (const ch of breakChars) {
    const idx = text.indexOf(ch);
    if (idx > 0 && idx < text.length - 1) {
      const l1 = text.slice(0, idx);  // 去掉标点
      const l2 = text.slice(idx + 1);
      if (ctx.measureText(l1).width <= maxW && ctx.measureText(l2).width <= maxW) {
        return [l1, l2];
      }
    }
  }
  // 无标点：对半切
  const mid = Math.ceil(text.length / 2);
  return [text.slice(0, mid), text.slice(mid)];
}

// ====== 逐字渲染（tracking） ======

function drawTracked(ctx, text, x, y, trackingPx) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + trackingPx;
  }
}

// ====== 毛玻璃徽标 (style3/成语) ======

function drawFrostedBadge(ctx, imgCanvas, cfg) {
  const { x: dx, y: dy, w: dw, h: dh, alpha, blur } = cfg;
  const bx = sp(dx), by = sp(dy), bw = sp(dw), bh = sp(dh);

  // 取徽标区域底图
  const patch = document.createElement('canvas');
  patch.width = bw;
  patch.height = bh;
  const pctx = patch.getContext('2d');
  pctx.drawImage(imgCanvas, bx, by, bw, bh, 0, 0, bw, bh);

  // 高斯模糊近似：多次缩放
  const blurred = simpleBlur(patch, blur * SCALE);

  // 取主色做自适应着色
  const color = sampleTopColor(patch, bh);
  const luma = rgbToLuma(color[0], color[1], color[2]);
  let [r, g, b] = color;
  if (luma >= 128) {
    // 浅底加深
    const ratio = Math.max(0.06, Math.min(0.50, (255 - luma) / 255));
    r = Math.round(r * (1 - ratio));
    g = Math.round(g * (1 - ratio));
    b = Math.round(b * (1 - ratio));
  } else {
    // 深底提亮
    const ratio = Math.min(0.52, luma / 255);
    r = Math.round(r + (255 - r) * ratio);
    g = Math.round(g + (255 - g) * ratio);
    b = Math.round(b + (255 - b) * ratio);
  }

  // 绘制毛玻璃背景
  ctx.drawImage(blurred, bx, by);

  // 半透明色块
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  roundedRect(ctx, bx, by, bw, bh, sp(4.8));
  ctx.fill();

  // 消除顶部圆角（平顶）
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillRect(bx, by, bw, bh / 2);
}

function simpleBlur(canvas, radius) {
  // 缩小再放大作为模糊近似
  const scale = Math.max(1, Math.round(radius / 4));
  const sw = Math.max(1, Math.round(canvas.width / scale));
  const sh = Math.max(1, Math.round(canvas.height / scale));

  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, sw, sh);

  const result = document.createElement('canvas');
  result.width = canvas.width;
  result.height = canvas.height;
  const rctx = result.getContext('2d');
  rctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  return result;
}

// ====== 形状绘制 ======

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// 垂帘形 (style1)：平顶 + 下弧
function drawDrapePath(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const bottomY = y + h;
  const arcH = h * 0.3;  // 下弧高度
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, bottomY - arcH);
  // 下弧：贝塞尔
  ctx.quadraticCurveTo(x + w, bottomY, cx, bottomY);
  ctx.quadraticCurveTo(x, bottomY, x, bottomY - arcH);
  ctx.closePath();
}

// ====== 底部自适应压暗带 (style3/成语) ======

function addScrim(ctx, titleCanvas, cfg) {
  // titleCanvas: 仅文字层的 canvas，用来采样文字区域亮度
  const [sr, sg, sb] = cfg.color;
  const yStart = cfg.yStart * H;
  const yFull = cfg.yFull * H;

  // 采样文字区域亮度
  const lum = regionLuma(titleCanvas, 0, sp(130), W, sp(40));

  if (lum < cfg.lumLow) return; // 已经很暗，不触发

  const alpha = Math.min(cfg.maxAlpha, (lum - cfg.lumLow) / (cfg.lumHigh - cfg.lumLow) * cfg.maxAlpha);

  const grad = ctx.createLinearGradient(0, yStart, 0, yFull);
  grad.addColorStop(0, `rgba(${sr},${sg},${sb},0)`);
  grad.addColorStop(1, `rgba(${sr},${sg},${sb},${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, yStart, W, H - yStart);
}

// ====== 主渲染函数 ======

// style1: 小低数学
async function renderStyle1(bgSrc, hookText, tagText) {
  const img = await loadImage(bgSrc);
  const bgCanvas = coverResize(img, W, H);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bgCanvas, 0, 0);

  const cfg = STYLES.style1;

  // 钩子
  if (hookText) {
    const spec = { ...cfg.hook, weight: 'Regular' };
    ctx.font = `normal ${sp(spec.size)}px "${fontFamily(spec.font, spec.weight)}"`;
    const { lines, px, trackingPx } = layoutHook(ctx, hookText, cfg.hook, SCALE);
    ctx.font = `normal ${px}px "${fontFamily(spec.font, spec.weight)}"`;
    ctx.fillStyle = spec.color;
    ctx.textBaseline = 'top';
    let y = sp(cfg.hook.yFirst);
    for (const line of lines) {
      drawTracked(ctx, line, sp(cfg.hook.x), y, trackingPx);
      y += cfg.hook.lineH * SCALE;
    }

    // 标签
    if (tagText) {
      const tagY = y + sp(cfg.tag.gap);
      drawTag(ctx, tagText, cfg.tag, tagY);
    }
  }

  // 垂帘徽标
  drawStyle1Badge(ctx, bgCanvas, cfg);

  return canvas;
}

function drawTag(ctx, text, cfg, tagY) {
  // 去除【】
  const clean = text.replace(/[【】]/g, '');
  ctx.font = `normal ${sp(cfg.size)}px "${fontFamily(cfg.font, cfg.weight)}"`;
  const textW = ctx.measureText(clean).width;
  const capsuleW = textW + sp(cfg.padX * 2);
  const capsuleH = sp(cfg.h);
  const tagX = sp(8.64);

  // 描边圆角矩形
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = sp(cfg.stroke);
  roundedRect(ctx, tagX, tagY, capsuleW, capsuleH, sp(cfg.radius));
  ctx.stroke();

  // 文字
  ctx.fillStyle = cfg.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(clean, tagX + capsuleW / 2, tagY + capsuleH / 2);
  ctx.textAlign = 'left';
}

function drawStyle1Badge(ctx, bgCanvas, cfg) {
  const bx = sp(cfg.badge.x), bw = sp(cfg.badge.w), bh = sp(cfg.badge.h);
  const by = 0;

  // 取底图顶部主色
  const [r, g, b] = sampleTopColor(bgCanvas, sp(26));
  const darken = cfg.badge.darken;
  ctx.fillStyle = `rgb(${Math.round(r*darken)},${Math.round(g*darken)},${Math.round(b*darken)})`;
  drawDrapePath(ctx, bx, by, bw, bh);
  ctx.fill();

  // 徽标文字
  ctx.font = `bold ${sp(cfg.badge.size)}px "${fontFamily(cfg.badge.font, cfg.badge.weight)}"`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(cfg.badge.text, sp(cfg.badge.x), sp(cfg.badge.cy));
}

// style2: 小高数学
async function renderStyle2(bgSrc, hookText, tagText) {
  const img = await loadImage(bgSrc);
  const bgCanvas = coverResize(img, W, H);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bgCanvas, 0, 0);

  const cfg = STYLES.style2;

  if (hookText) {
    const spec = { ...cfg.hook, weight: 'Bold' };
    ctx.font = `bold ${sp(spec.size)}px "${fontFamily(spec.font, spec.weight)}"`;
    const { lines, px, trackingPx } = layoutHook(ctx, hookText, cfg.hook, SCALE);
    ctx.font = `bold ${px}px "${fontFamily(spec.font, spec.weight)}"`;
    ctx.fillStyle = spec.color;
    ctx.textBaseline = 'top';
    let y = sp(cfg.hook.yFirst);
    for (const line of lines) {
      drawTracked(ctx, line, sp(cfg.hook.x), y, trackingPx);
      y += cfg.hook.lineH * SCALE;
    }

    if (tagText) {
      const tagY = y + sp(cfg.tag.gap);
      drawTag(ctx, tagText, cfg.tag, tagY);
    }
  }

  // 下圆角矩形徽标
  const bx = sp(cfg.badge.x), bw = sp(cfg.badge.w), bh = sp(cfg.badge.h);
  const [r, g, b] = sampleTopColor(bgCanvas, sp(26));
  ctx.fillStyle = `rgb(${Math.round(r*cfg.badge.darken)},${Math.round(g*cfg.badge.darken)},${Math.round(b*cfg.badge.darken)})`;
  roundedRect(ctx, bx, 0, bw, bh, sp(4.8));
  ctx.fill();

  ctx.font = `bold ${sp(cfg.badge.size)}px "${fontFamily(cfg.badge.font, cfg.badge.weight)}"`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(cfg.badge.text, sp(cfg.badge.x), sp(cfg.badge.cy));

  return canvas;
}

// style3: 语文/科普单名
async function renderStyle3(bgSrc, nameText) {
  const img = await loadImage(bgSrc);
  const bgCanvas = coverResize(img, W, H);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bgCanvas, 0, 0);

  const cfg = STYLES.style3;
  const displayName = displayNameFromXueming(nameText);

  // 学名居中渲染
  const tSpec = { ...cfg.title, weight: '65W' };
  ctx.font = `normal ${sp(tSpec.size)}px "${fontFamily(tSpec.font, tSpec.weight)}"`;
  const { lines, px, isOneLine } = layoutTitleCJK(ctx, displayName, cfg.title, SCALE);

  // 先渲染文字到单独层（供 scrim 采样）
  const textLayer = document.createElement('canvas');
  textLayer.width = W;
  textLayer.height = H;
  const tCtx = textLayer.getContext('2d');
  tCtx.font = `normal ${px}px "${fontFamily(tSpec.font, tSpec.weight)}"`;
  tCtx.fillStyle = tSpec.color;
  tCtx.textBaseline = 'top';
  tCtx.textAlign = 'center';

  const centerX = sp(DESIGN_W / 2);
  let y = sp(cfg.title.cy) - (cfg.title.lineH * SCALE * lines.length) / 2;
  if (isOneLine) y = sp(cfg.title.cy) - px / 2;
  for (const line of lines) {
    tCtx.fillText(line, centerX, y);
    y += cfg.title.lineH * SCALE;
  }

  // 压暗带
  addScrim(ctx, textLayer, cfg.scrim);

  // 合成文字
  ctx.drawImage(textLayer, 0, 0);

  // 毛玻璃徽标
  drawFrostedBadge(ctx, bgCanvas, {
    x: 8.64, y: 0, w: cfg.badge.w, h: cfg.badge.h,
    alpha: cfg.badge.alpha, blur: cfg.badge.blur,
  });

  // 徽标文字
  ctx.font = `bold ${sp(cfg.badge.size)}px "${fontFamily(cfg.badge.font, cfg.badge.weight)}"`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(cfg.badge.text, sp(cfg.badge.x), sp(cfg.badge.cy));

  return canvas;
}

// 成语双行
async function renderChengyu(bgSrc, nameText, hookText) {
  const img = await loadImage(bgSrc);
  const bgCanvas = coverResize(img, W, H);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bgCanvas, 0, 0);

  const cfg = STYLES.chengyu;

  // 文字层（供 scrim 采样）
  const textLayer = document.createElement('canvas');
  textLayer.width = W;
  textLayer.height = H;
  const tCtx = textLayer.getContext('2d');
  tCtx.fillStyle = '#FFFFFF';
  tCtx.textBaseline = 'top';
  tCtx.textAlign = 'center';
  const cx = sp(DESIGN_W / 2);

  // 学名
  const mSpec = cfg.main;
  tCtx.font = `normal ${sp(mSpec.size)}px "${fontFamily(mSpec.font, mSpec.weight)}"`;
  const mPx = fitSingleLine(tCtx, nameText, mSpec, SCALE);
  tCtx.font = `normal ${mPx}px "${fontFamily(mSpec.font, mSpec.weight)}"`;
  tCtx.fillText(nameText, cx, sp(mSpec.cy) - mPx / 2);

  // 钩子（70% alpha）
  if (hookText) {
    const sSpec = cfg.sub;
    tCtx.font = `normal ${sp(sSpec.size)}px "${fontFamily(sSpec.font, sSpec.weight)}"`;
    const hookLines = wrapHookLines(tCtx, hookText, sSpec.maxW * SCALE);
    const sPx = fitMultiLine(tCtx, hookLines, sSpec, SCALE);
    tCtx.font = `normal ${sPx}px "${fontFamily(sSpec.font, sSpec.weight)}"`;

    let hy = sp(sSpec.cy) - (sSpec.lineH * SCALE * hookLines.length) / 2;
    for (const line of hookLines) {
      tCtx.fillText(line, cx, hy);
      hy += sSpec.lineH * SCALE;
    }

    // 用 70% alpha 合成到目标
    const hookLayer = document.createElement('canvas');
    hookLayer.width = W;
    hookLayer.height = H;
    const hCtx = hookLayer.getContext('2d');
    hCtx.globalAlpha = sSpec.alpha || 0.70;
    hCtx.drawImage(textLayer, 0, 0);

    // 重新画学名（不透明）
    hCtx.globalAlpha = 1.0;
    hCtx.font = `normal ${mPx}px "${fontFamily(mSpec.font, mSpec.weight)}"`;
    hCtx.fillStyle = '#FFFFFF';
    hCtx.textBaseline = 'top';
    hCtx.textAlign = 'center';
    hCtx.fillText(nameText, cx, sp(mSpec.cy) - mPx / 2);

    // 替换 textLayer
    const merged = document.createElement('canvas');
    merged.width = W;
    merged.height = H;
    const mCtx = merged.getContext('2d');
    mCtx.drawImage(textLayer, 0, 0);  // 学名 + 钩子全不透明
    mCtx.globalCompositeOperation = 'destination-out';
    mCtx.fillStyle = `rgba(0,0,0,${1 - (sSpec.alpha || 0.70)})`;
    // 简化：直接用 alpha 合成
    const finalText = document.createElement('canvas');
    finalText.width = W;
    finalText.height = H;
    const fCtx = finalText.getContext('2d');
    // 学名 100%
    fCtx.font = `normal ${mPx}px "${fontFamily(mSpec.font, mSpec.weight)}"`;
    fCtx.fillStyle = '#FFFFFF';
    fCtx.textBaseline = 'top';
    fCtx.textAlign = 'center';
    fCtx.fillText(nameText, cx, sp(mSpec.cy) - mPx / 2);
    // 钩子 70%
    fCtx.globalAlpha = sSpec.alpha || 0.70;
    fCtx.font = `normal ${sPx}px "${fontFamily(sSpec.font, sSpec.weight)}"`;
    hy = sp(sSpec.cy) - (sSpec.lineH * SCALE * hookLines.length) / 2;
    for (const line of hookLines) {
      fCtx.fillText(line, cx, hy);
      hy += sSpec.lineH * SCALE;
    }
    fCtx.globalAlpha = 1.0;

    addScrim(ctx, finalText, cfg.scrim);
    ctx.drawImage(finalText, 0, 0);
  } else {
    addScrim(ctx, textLayer, cfg.scrim);
    ctx.drawImage(textLayer, 0, 0);
  }

  // 毛玻璃徽标
  drawFrostedBadge(ctx, bgCanvas, {
    x: 8.64, y: 0, w: cfg.badge.w, h: cfg.badge.h,
    alpha: cfg.badge.alpha, blur: cfg.badge.blur,
  });
  ctx.font = `bold ${sp(cfg.badge.size)}px "${fontFamily(cfg.badge.font, cfg.badge.weight)}"`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(cfg.badge.text, sp(cfg.badge.x), sp(cfg.badge.cy));

  return canvas;
}

function fitSingleLine(ctx, text, spec, scale) {
  let px = spec.size * scale;
  ctx.font = `normal ${px}px "${fontFamily(spec.font, spec.weight)}"`;
  while (px > spec.min * scale && ctx.measureText(text).width > spec.maxW * scale) {
    px -= 0.5 * scale;
    ctx.font = `normal ${px}px "${fontFamily(spec.font, spec.weight)}"`;
  }
  return px;
}

function fitMultiLine(ctx, lines, spec, scale) {
  let px = spec.size * scale;
  ctx.font = `normal ${px}px "${fontFamily(spec.font, spec.weight)}"`;
  while (px > spec.min * scale) {
    let ok = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > spec.maxW * scale) { ok = false; break; }
    }
    if (ok) return px;
    px -= 0.5 * scale;
    ctx.font = `normal ${px}px "${fontFamily(spec.font, spec.weight)}"`;
  }
  return spec.min * scale;
}

// ====== 输出 ======

async function canvasToPNG(canvas) {
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
}

async function canvasToJPG(canvas, maxSizeKB) {
  // 先合成到白色背景
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const fctx = flat.getContext('2d');
  fctx.fillStyle = '#FFFFFF';
  fctx.fillRect(0, 0, flat.width, flat.height);
  fctx.drawImage(canvas, 0, 0);

  // 二分搜索最佳质量 (30-92)
  let lo = 30, hi = 92, bestBlob = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const quality = mid / 100;
    const blob = await new Promise(resolve => flat.toBlob(blob => resolve(blob), 'image/jpeg', quality));
    if (blob.size <= maxSizeKB * 1024) {
      bestBlob = blob;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (!bestBlob) {
    // fallback: 最低质量
    bestBlob = await new Promise(resolve => flat.toBlob(blob => resolve(blob), 'image/jpeg', 0.30));
  }

  return bestBlob;
}

// ====== 统一入口 ======

async function renderCover(style, bgSrc, fields) {
  // fields: { hook, tag, name, ... }
  let canvas;
  switch (style) {
    case 'style1':
      canvas = await renderStyle1(bgSrc, fields.hook, fields.tag);
      break;
    case 'style2':
      canvas = await renderStyle2(bgSrc, fields.hook, fields.tag);
      break;
    case 'style3':
      canvas = await renderStyle3(bgSrc, fields.name);
      break;
    case 'chengyu':
      canvas = await renderChengyu(bgSrc, fields.name, fields.hook);
      break;
    default:
      throw new Error(`Unknown style: ${style}`);
  }

  const png = await canvasToPNG(canvas);
  const jpg = await canvasToJPG(canvas, 50);  // ≤50KB target

  return { canvas, pngBlob: png, jpgBlob: jpg };
}

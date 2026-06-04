// 千问小讲堂 · 封面生成工具 — 主逻辑

// ====== 全局状态 ======
const state = {
  currentStep: 1,
  rows: [],           // 解析后的数据行 [{ 字段名: 值 }]
  headers: [],        // 原始表头
  configs: [],        // 每条的行配置 { style, colXueming, colHook, colTag, colUrl, bgSrc }
  results: [],        // 渲染结果 [{ canvas, pngBlob, jpgBlob, pngSize, jpgSize }]
  fontsReady: false,
};

// ====== 初始化 ======
document.addEventListener('DOMContentLoaded', async () => {
  setupDropZone();
  setupTabs();
  setupStepButtons();
  setupColumnMapping();

  // 字体加载
  showToast('正在加载字体...', '');
  const loaded = await loadAllFonts((done, total) => {
    document.querySelector('.header p').textContent = `字体加载中 ${done}/${total}...`;
  });
  state.fontsReady = loaded > 0;
  document.querySelector('.header p').textContent = '上传课程数据 → 预览封面 → 一键下载成品（PNG + JPG）';
  if (loaded < 3) {
    showToast('部分字体加载失败，可能影响渲染效果', 'error');
  } else {
    showToast('字体加载完成 ✅', 'success');
  }
});

// ====== Toast ======
function showToast(msg, type) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  if (type !== '') {
    setTimeout(() => t.remove(), 3000);
  }
}

// ====== Step Navigation ======
function goToStep(n) {
  state.currentStep = n;
  for (let i = 1; i <= 5; i++) {
    const panel = document.getElementById(`panel-step${i}`);
    if (panel) panel.style.display = i === n ? '' : 'none';
  }
  // Update stepper
  document.querySelectorAll('.step-dot').forEach(dot => {
    const s = parseInt(dot.dataset.step);
    dot.classList.remove('active', 'done');
    if (s === n) dot.classList.add('active');
    else if (s < n) dot.classList.add('done');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ====== Step 1: Upload ======
function setupDropZone() {
  const zone = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  });
  input.addEventListener('change', e => {
    if (e.target.files[0]) parseFile(e.target.files[0]);
  });

  document.getElementById('btnParsePaste').addEventListener('click', parsePaste);
  document.getElementById('btnLoadSample').addEventListener('click', loadSample);
  document.getElementById('btnClearData').addEventListener('click', clearData);
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      if (target) target.style.display = '';
    });
  });
}

async function parseFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    let rows;
    if (file.name.endsWith('.csv')) {
      const text = new TextDecoder().decode(buffer);
      rows = parseCSV(text);
    } else {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    }
    if (!rows || rows.length === 0) {
      showToast('文件中无数据', 'error');
      return;
    }
    loadRows(rows);
    showToast(`已解析 ${rows.length} 条数据`, 'success');
  } catch (e) {
    showToast('解析失败：' + e.message, 'error');
  }
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,\t]/).map(h => h.trim().replace(/^"(.*)"$/, '$1'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(/[,\t]/).map(v => v.trim().replace(/^"(.*)"$/, '$1'));
    const row = {};
    headers.forEach((h, j) => { row[h] = vals[j] || ''; });
    rows.push(row);
  }
  return rows;
}

function parsePaste() {
  const text = document.getElementById('pasteArea').value.trim();
  if (!text) { showToast('请先粘贴数据', 'error'); return; }
  const rows = parseCSV(text);
  if (rows.length === 0) { showToast('无法解析数据', 'error'); return; }
  loadRows(rows);
  showToast(`已解析 ${rows.length} 条数据`, 'success');
}

function loadRows(rows) {
  state.rows = rows;
  state.headers = Object.keys(rows[0] || {});
  state.configs = rows.map(() => ({
    style: document.getElementById('defaultStyle').value,
    colXueming: '', colHook: '', colTag: '', colUrl: '', bgSrc: ''
  }));
  state.results = [];

  // Render table
  const wrap = document.getElementById('dataTableWrap');
  const table = document.getElementById('dataTable');
  wrap.style.display = '';
  document.getElementById('rowCount').textContent = `（共 ${rows.length} 条）`;

  let html = '<table><thead><tr><th>#</th>';
  state.headers.forEach(h => { html += `<th>${escapeHtml(h)}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach((row, i) => {
    html += `<tr><td>${i + 1}</td>`;
    state.headers.forEach(h => { html += `<td>${escapeHtml(String(row[h] || ''))}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  table.innerHTML = html;
}

function loadSample() {
  state.rows = [
    { '学名': '文史趣闻《揠苗助长》', '钩子': '', 'url': '' },
    { '学名': '古诗词《静夜思》', '钩子': '', 'url': '' },
    { '学名': '守株待兔', '钩子': '坐着等就能天天捡到兔子？', 'url': '' },
    { '学名': '妙题高招《赶鸭子上架》', '钩子': '', 'url': '' },
    { '学名': '趣味数学-加法', '钩子': '1+1为什么一定等于2？', '标签': '一年级★超好玩', 'url': '' },
    { '学名': '趣味数学-几何', '钩子': '这个三角形到底藏着什么秘密？', '标签': '四年级｜趣味数学', 'url': '' },
  ];
  state.headers = ['学名', '钩子', '标签', 'url'];
  state.configs = state.rows.map(() => ({
    style: document.getElementById('defaultStyle').value,
    colXueming: '学名', colHook: '钩子', colTag: '标签', colUrl: 'url', bgSrc: ''
  }));
  state.results = [];
  loadRows(state.rows);
  showToast('已加载 6 条示例数据', 'success');
}

function clearData() {
  state.rows = [];
  state.headers = [];
  state.configs = [];
  state.results = [];
  document.getElementById('dataTableWrap').style.display = 'none';
  document.getElementById('dataTable').innerHTML = '';
  showToast('已清空数据', 'success');
}

// ====== Step 2: Configure ======
function setupColumnMapping() {
  document.getElementById('defaultStyle').addEventListener('change', e => {
    state.configs.forEach(c => { c.style = e.target.value; });
  });
}

function populateStep2() {
  const selectors = ['colXueming', 'colHook', 'colTag', 'colUrl'];
  selectors.forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="">-- 选择列 --</option>';
    state.headers.forEach(h => {
      sel.innerHTML += `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`;
    });
  });

  // 自动匹配列名
  const autoMap = {
    colXueming: ['学名', '学名确认版', '学名·确认版', 'name', 'title', '课程名'],
    colHook: ['钩子', '钩子确认版', '钩子·确认版', 'hook'],
    colTag: ['标签', 'tag', 'label'],
    colUrl: ['url', 'url确认版', 'url·确认版', '底图', 'bg'],
  };
  Object.entries(autoMap).forEach(([id, patterns]) => {
    const sel = document.getElementById(id);
    for (const h of state.headers) {
      const lh = h.toLowerCase().replace(/[··]/g, '');
      for (const p of patterns) {
        if (lh.includes(p.toLowerCase())) {
          sel.value = h;
          return;
        }
      }
    }
  });

  // 默认样式
  document.getElementById('defaultStyle').value = state.configs[0]?.style || 'style3';

  // 渲染配置表
  renderConfigTable();
}

function renderConfigTable() {
  const sel = {
    colXueming: document.getElementById('colXueming').value,
    colHook: document.getElementById('colHook').value,
    colTag: document.getElementById('colTag').value,
    colUrl: document.getElementById('colUrl').value,
  };
  const defaultStyle = document.getElementById('defaultStyle').value;

  state.configs.forEach((cfg, i) => {
    cfg.colXueming = sel.colXueming;
    cfg.colHook = sel.colHook;
    cfg.colTag = sel.colTag;
    cfg.colUrl = sel.colUrl;
    if (!cfg.style) cfg.style = defaultStyle;
    // 自动从 URL 列取值
    if (cfg.colUrl && state.rows[i]) {
      cfg.bgSrc = String(state.rows[i][cfg.colUrl] || '');
    }
  });

  let html = '<table><thead><tr><th>#</th><th>学名</th><th>钩子</th><th>标签</th><th>样式</th></tr></thead><tbody>';
  state.rows.forEach((row, i) => {
    const xueming = sel.colXueming ? row[sel.colXueming] : '';
    const hook = sel.colHook ? row[sel.colHook] : '';
    const tag = sel.colTag ? row[sel.colTag] : '';
    html += `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(String(xueming || '-'))}</td>
      <td>${escapeHtml(String(hook || '-'))}</td>
      <td>${escapeHtml(String(tag || '-'))}</td>
      <td><select class="row-style" data-row="${i}">
        <option value="style3" ${state.configs[i].style==='style3'?'selected':''}>Style3 语文/科普</option>
        <option value="style1" ${state.configs[i].style==='style1'?'selected':''}>Style1 小低数学</option>
        <option value="style2" ${state.configs[i].style==='style2'?'selected':''}>Style2 小高数学</option>
        <option value="chengyu" ${state.configs[i].style==='chengyu'?'selected':''}>成语故事</option>
      </select></td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('configTable').innerHTML = html;

  // 行样式变更事件
  document.querySelectorAll('.row-style').forEach(sel => {
    sel.addEventListener('change', e => {
      const i = parseInt(e.target.dataset.row);
      state.configs[i].style = e.target.value;
    });
  });

  // 列映射变更时更新配置
  document.querySelectorAll('.col-map').forEach(sel => {
    sel.addEventListener('change', renderConfigTable);
  });
}

// ====== Step 3: Base Images ======
function populateStep3() {
  let html = '<table><thead><tr><th>#</th><th>学名</th><th>样式</th><th>底图 URL / 文件</th><th>预览</th></tr></thead><tbody>';
  state.rows.forEach((row, i) => {
    const cfg = state.configs[i];
    const xueming = cfg.colXueming ? (row[cfg.colXueming] || '') : '';
    const bgSrc = cfg.bgSrc || '';
    html += `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(String(xueming || '-'))}</td>
      <td>${STYLES[cfg.style]?.name || cfg.style}</td>
      <td>
        <div style="display:flex;gap:4px;align-items:center">
          <input type="url" class="row-bg-url" data-row="${i}"
            value="${escapeHtml(bgSrc)}" placeholder="粘贴图片 URL"
            style="flex:1;font-size:.82em">
          <input type="file" class="row-bg-file" data-row="${i}" accept="image/*"
            style="display:none">
          <button class="btn btn-outline btn-sm row-bg-upload" data-row="${i}">📁</button>
        </div>
      </td>
      <td>${bgSrc ? `<img src="${escapeHtml(bgSrc)}" style="max-width:60px;max-height:60px;border-radius:4px" onerror="this.style.display='none'" loading="lazy">` : '<span style="color:var(--text-secondary);font-size:.8em">未设置</span>'}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('bgTable').innerHTML = html;

  // 事件绑定
  document.querySelectorAll('.row-bg-url').forEach(input => {
    input.addEventListener('change', e => {
      const i = parseInt(e.target.dataset.row);
      state.configs[i].bgSrc = e.target.value;
    });
  });
  document.querySelectorAll('.row-bg-upload').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.row);
      const fileInput = document.querySelector(`.row-bg-file[data-row="${i}"]`);
      fileInput.click();
    });
  });
  document.querySelectorAll('.row-bg-file').forEach(input => {
    input.addEventListener('change', async e => {
      const i = parseInt(e.target.dataset.row);
      const file = e.target.files[0];
      if (file) {
        const dataUrl = await fileToDataUrl(file);
        state.configs[i].bgSrc = dataUrl;
        document.querySelector(`.row-bg-url[data-row="${i}"]`).value = '[本地文件]';
        populateStep3(); // refresh
      }
    });
  });

  // 全局 URL 应用
  document.getElementById('btnApplyGlobalBg').addEventListener('click', () => {
    const url = document.getElementById('globalBgUrl').value.trim();
    if (!url) return;
    state.configs.forEach((cfg, i) => {
      if (!cfg.bgSrc) {
        cfg.bgSrc = url;
        const input = document.querySelector(`.row-bg-url[data-row="${i}"]`);
        if (input) input.value = url;
      }
    });
    showToast(`已应用全局 URL`, 'success');
  });
}

function fileToDataUrl(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// ====== Step 4: Render ======
async function runRender() {
  if (!state.fontsReady) {
    showToast('字体尚未加载完成，请稍候', 'error');
    return;
  }

  const total = state.rows.length;
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const previewArea = document.getElementById('previewArea');
  const previewActions = document.getElementById('previewActions');

  progressBar.style.display = '';
  progressText.style.display = '';
  previewArea.innerHTML = '';
  previewActions.style.display = 'none';
  state.results = [];

  for (let i = 0; i < total; i++) {
    const cfg = state.configs[i];
    const row = state.rows[i];

    progressText.textContent = `渲染中 ${i + 1} / ${total}：${row[cfg.colXueming] || `第${i + 1}条`}`;
    progressFill.style.width = `${((i + 1) / total) * 100}%`;

    const xueming = cfg.colXueming ? String(row[cfg.colXueming] || '') : '';
    const hook = cfg.colHook ? String(row[cfg.colHook] || '') : '';
    const tag = cfg.colTag ? String(row[cfg.colTag] || '') : '';

    if (!cfg.bgSrc) {
      // 无底图：显示占位卡片
      state.results.push({ error: '未设置底图', canvas: null, pngBlob: null, jpgBlob: null });
      addPreviewCard(previewArea, i, null, xueming, cfg.style, '未设置底图');
      continue;
    }

    try {
      const result = await renderCover(cfg.style, cfg.bgSrc, {
        name: xueming,
        hook: hook,
        tag: tag,
      });
      state.results.push({
        ...result,
        pngSize: result.pngBlob?.size || 0,
        jpgSize: result.jpgBlob?.size || 0,
        error: null,
      });
      addPreviewCard(previewArea, i, result.canvas, xueming, cfg.style, null);
    } catch (e) {
      console.error(`Row ${i} render error:`, e);
      state.results.push({ error: e.message, canvas: null, pngBlob: null, jpgBlob: null });
      addPreviewCard(previewArea, i, null, xueming, cfg.style, e.message);
    }
  }

  progressBar.style.display = 'none';
  progressText.textContent = `完成！成功 ${state.results.filter(r => !r.error).length} / ${total}`;
  previewActions.style.display = '';
}

function addPreviewCard(area, idx, canvas, name, style, error) {
  const div = document.createElement('div');
  div.className = 'preview-card';

  if (error) {
    div.innerHTML = `
      <div style="width:100%;aspect-ratio:3/4;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:var(--danger);font-size:.82em;text-align:center;padding:12px">
        ⚠️ ${escapeHtml(error)}
      </div>`;
  } else if (canvas) {
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/jpeg', 0.7);
    img.alt = name;
    img.loading = 'lazy';
    div.appendChild(img);
  }

  const styleName = STYLES[style]?.name || style;
  div.innerHTML += `<div class="info"><span>#${idx + 1} ${escapeHtml(name || '-')}</span><span style="font-size:.75em">${styleName}</span></div>`;
  previewArea.appendChild(div);
}

// ====== Step 5: Download ======
async function populateStep5() {
  const summary = document.getElementById('downloadSummary');
  const ok = state.results.filter(r => !r.error).length;
  const fail = state.results.length - ok;
  let totalPNG = 0, totalJPG = 0;
  state.results.forEach(r => {
    if (r.pngSize) totalPNG += r.pngSize;
    if (r.jpgSize) totalJPG += r.jpgSize;
  });

  summary.innerHTML = `
    <table style="max-width:500px">
      <tr><td>总条数</td><td><strong>${state.results.length}</strong></td></tr>
      <tr><td>成功</td><td style="color:var(--success)"><strong>${ok}</strong></td></tr>
      <tr><td>失败</td><td style="color:var(--danger)"><strong>${fail}</strong></td></tr>
      <tr><td>PNG 总大小</td><td>${formatBytes(totalPNG)}</td></tr>
      <tr><td>JPG 总大小</td><td>${formatBytes(totalJPG)}</td></tr>
    </table>`;
}

async function downloadAll() {
  const files = [];
  const manifestRows = [];

  for (let i = 0; i < state.results.length; i++) {
    const r = state.results[i];
    const cfg = state.configs[i];
    const row = state.rows[i];
    const name = (cfg.colXueming ? String(row[cfg.colXueming] || `item-${i + 1}`) : `item-${i + 1}`).replace(/[\\/:*?"<>|]/g, '_');
    const safeName = name.slice(0, 30);

    if (r.pngBlob) files.push({ name: `${safeName}.png`, blob: r.pngBlob });
    if (r.jpgBlob) files.push({ name: `${safeName}.jpg`, blob: r.jpgBlob });

    manifestRows.push({
      index: i + 1,
      name,
      style: cfg.style,
      pngOK: r.pngBlob ? 'Y' : 'N',
      jpgOK: r.jpgBlob ? 'Y' : 'N',
      pngSize: r.pngSize ? formatBytes(r.pngSize) : '',
      jpgSize: r.jpgSize ? formatBytes(r.jpgSize) : '',
      error: r.error || '',
    });
  }

  // 添加 manifest.csv
  const csvHeader = Object.keys(manifestRows[0]).join(',');
  const csvBody = manifestRows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  files.push({ name: 'manifest.csv', blob: new Blob(['﻿' + csvHeader + '\n' + csvBody], { type: 'text/csv;charset=utf-8' }) });

  if (files.length === 0) {
    showToast('没有可下载的文件', 'error');
    return;
  }

  showToast('正在打包...', '');
  await downloadZip(files, '千问小讲堂-封面成品.zip');
  showToast('下载完成 ✅', 'success');
}

function downloadManifestCSV() {
  const rows = [];
  for (let i = 0; i < state.results.length; i++) {
    const r = state.results[i];
    const cfg = state.configs[i];
    const row = state.rows[i];
    const name = cfg.colXueming ? String(row[cfg.colXueming] || `item-${i + 1}`) : `item-${i + 1}`;
    rows.push({
      index: i + 1,
      name,
      style: cfg.style,
      pngOK: r.pngBlob ? 'Y' : 'N',
      jpgOK: r.jpgBlob ? 'Y' : 'N',
      error: r.error || '',
    });
  }
  downloadCSV(rows, '千问小讲堂-封面回写表.csv');
}

// ====== Step Buttons ======
function setupStepButtons() {
  document.getElementById('btnToStep2').addEventListener('click', () => {
    if (state.rows.length === 0) { showToast('请先上传数据', 'error'); return; }
    populateStep2();
    goToStep(2);
  });
  document.getElementById('btnBackStep1').addEventListener('click', () => goToStep(1));

  document.getElementById('btnToStep3').addEventListener('click', () => {
    renderConfigTable(); // 保存最新列映射
    populateStep3();
    goToStep(3);
  });
  document.getElementById('btnBackStep2').addEventListener('click', () => goToStep(2));

  document.getElementById('btnToStep4').addEventListener('click', async () => {
    goToStep(4);
    await runRender();
  });
  document.getElementById('btnBackStep3').addEventListener('click', () => goToStep(3));
  document.getElementById('btnRerender').addEventListener('click', async () => {
    state.results = [];
    document.getElementById('previewArea').innerHTML = '';
    await runRender();
  });

  document.getElementById('btnToStep5').addEventListener('click', () => {
    populateStep5();
    goToStep(5);
  });
  document.getElementById('btnBackStep4').addEventListener('click', () => goToStep(4));

  document.getElementById('btnDownloadAll').addEventListener('click', downloadAll);
  document.getElementById('btnDownloadCSV').addEventListener('click', downloadManifestCSV);
  document.getElementById('btnReset').addEventListener('click', () => {
    state.rows = [];
    state.headers = [];
    state.configs = [];
    state.results = [];
    document.getElementById('dataTableWrap').style.display = 'none';
    goToStep(1);
  });
}

// ====== Keyboard shortcuts ======
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' && e.ctrlKey) {
    e.preventDefault();
    if (state.currentStep < 5) goToStep(state.currentStep + 1);
  }
  if (e.key === 'ArrowLeft' && e.ctrlKey) {
    e.preventDefault();
    if (state.currentStep > 1) goToStep(state.currentStep - 1);
  }
});

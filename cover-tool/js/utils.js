// 工具函数

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadZip(files, zipName) {
  // files: [{ name, blob }]
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  downloadBlob(zipBlob, zipName);
}

// CSV 下载
function downloadCSV(rows, filename) {
  const header = Object.keys(rows[0] || {}).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + header + '\n' + body], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}

// 简易 HTML escape
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// localStorage helpers
function storeGet(key, defaultVal) {
  try { return localStorage.getItem(key) || defaultVal; } catch { return defaultVal; }
}
function storeSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

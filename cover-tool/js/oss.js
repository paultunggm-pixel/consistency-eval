// 阿里云 OSS 浏览器端上传模块
// 使用 Web Crypto API 实现 HMAC-SHA1 签名

// 注意：不要在此处填写 AccessKey！
// 打开工具页面后在 Step 5「OSS 配置」中输入，数据仅存本地浏览器 localStorage
const OSS_DEFAULTS = {
  endpoint: 'oss-cn-hangzhou.aliyuncs.com',
  bucket: 'sm-frontend-private-img',
  pathPrefix: 'souti-imgs-tasting/',
  cdnHost: 'https://cdn-private.sm.cn',
  accessKeyId: '',
  accessKeySecret: '',
};

// ====== 凭证管理（localStorage） ======

function getOSSCredentials() {
  return {
    endpoint: storeGet('oss_endpoint', OSS_DEFAULTS.endpoint),
    bucket: storeGet('oss_bucket', OSS_DEFAULTS.bucket),
    pathPrefix: storeGet('oss_prefix', OSS_DEFAULTS.pathPrefix),
    cdnHost: storeGet('oss_cdn', OSS_DEFAULTS.cdnHost),
    accessKeyId: storeGet('oss_ak_id', OSS_DEFAULTS.accessKeyId),
    accessKeySecret: storeGet('oss_ak_secret', OSS_DEFAULTS.accessKeySecret),
  };
}

function saveOSSCredentials(cfg) {
  for (const [k, v] of Object.entries(cfg)) {
    storeSet(`oss_${k}`, v || '');
  }
}

// ====== HMAC-SHA1 签名（Web Crypto API） ======

async function hmacSha1(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function gmtDate() {
  return new Date().toUTCString();
}

// ====== 构建 OSS StringToSign ======

function buildStringToSign(method, contentType, date, objectPath) {
  const md5 = '';
  const ossHeaders = '';
  const resource = `/${objectPath}`;
  return `${method}\n${md5}\n${contentType}\n${date}\n${ossHeaders}${resource}`;
}

// ====== 上传单个文件 ======

async function uploadToOSS(blob, filename, onProgress) {
  const cfg = getOSSCredentials();
  const objectKey = cfg.pathPrefix + filename;
  const date = gmtDate();
  const contentType = blob.type || 'image/png';

  const stringToSign = buildStringToSign('PUT', contentType, date, objectKey);
  const sig = await hmacSha1(cfg.accessKeySecret, stringToSign);
  const signature = toBase64(new Uint8Array(sig));
  const auth = `OSS ${cfg.accessKeyId}:${signature}`;

  const domain = `${cfg.bucket}.${cfg.endpoint}`;
  const url = `https://${domain}/${objectKey}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('Date', date);
    xhr.setRequestHeader('Authorization', auth);

    xhr.upload.addEventListener('progress', (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(filename, e.loaded, e.total);
      }
    });

    xhr.onload = () => {
      if (xhr.status === 200) {
        const cdnUrl = `${cfg.cdnHost}/${objectKey}`;
        resolve({ objectKey, ossUrl: url, cdnUrl, status: 200 });
      } else {
        reject(new Error(`OSS upload failed: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(blob);
  });
}

// ====== 批量上传 ======

async function batchUploadToOSS(items, onItemProgress, onBatchProgress) {
  const results = [];
  let done = 0;

  for (const item of items) {
    if (onBatchProgress) onBatchProgress(done, items.length, item.filename);
    try {
      const result = await uploadToOSS(item.blob, item.filename, onItemProgress);
      results.push({ ...result, success: true, filename: item.filename });
    } catch (e) {
      results.push({ success: false, error: e.message, filename: item.filename });
    }
    done++;
    if (onBatchProgress) onBatchProgress(done, items.length, item.filename);
  }

  return results;
}

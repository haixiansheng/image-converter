/* 图片格式转换工具 —— 纯浏览器端 · 单张模式
 * 输入一张图 → 转成目标格式 → 输出一张图。图片不上传，全部本地处理。
 *
 * 支持: JPG / PNG / WebP / BMP / GIF 输入
 * 输出: PNG（无损·支持透明）/ JPEG（兼容性最好）/ WebP（体积最小）
 * 特色: 透明通道处理 —— PNG 转 JPEG 时可选择填充背景色
 */
'use strict';

const $ = id => document.getElementById(id);

/* ---------- i18n ---------- */
const I18N = {
  zh: {
    pickImage: '请选择一张图片',
    compressing: '转换中…',
    done: '转换完成',
    original: '原图',
    result: '转换后',
    download: '⬇ 下载图片',
    pickAnother: '换一张图片',
    failed: '转换失败，请换一张图试试',
    quality: '质量',
    targetFmt: '目标格式',
    maxDim: '最大边长 (px)',
    bgColor: '透明区域填充',
    alphaNotice: '检测到透明背景。JPEG 不支持透明，将填充为你选择的颜色。',
    keepAlpha: '透明背景已保留',
    sameFmt: '源格式与目标格式相同',
    jpegHint: 'JPEG：兼容性最好，不支持透明',
    pngHint: 'PNG：无损，支持透明，体积较大',
    webpHint: 'WebP：体积最小（比 JPEG 小 25-35%），现代浏览器全支持',
  },
  en: {
    pickImage: 'Please select an image',
    compressing: 'Converting…',
    done: 'Done',
    original: 'Original',
    result: 'Converted',
    download: '⬇ Download image',
    pickAnother: 'Choose another image',
    failed: 'Conversion failed — try a different image',
    quality: 'Quality',
    targetFmt: 'Target format',
    maxDim: 'Max dimension (px)',
    bgColor: 'Fill transparent areas with',
    alphaNotice: 'Transparent background detected. JPEG has no alpha channel, so it will be filled with your chosen colour.',
    keepAlpha: 'Transparency preserved',
    sameFmt: 'Source and target formats are the same',
    jpegHint: 'JPEG: best compatibility, no transparency',
    pngHint: 'PNG: lossless, supports transparency, larger files',
    webpHint: 'WebP: smallest files (25–35% under JPEG), supported by all modern browsers',
  },
};
const LANG = (document.documentElement.lang || 'zh').toLowerCase().startsWith('en') ? 'en' : 'zh';
const T = I18N[LANG];

const els = {
  dropZone: $('dropZone'), fileInput: $('fileInput'),
  uploadPanel: $('uploadPanel'), workPanel: $('workPanel'),
  origImg: $('origImg'), resultImg: $('resultImg'),
  origSize: $('origSize'), resultSize: $('resultSize'),
  origDims: $('origDims'), resultDims: $('resultDims'),
  origFmt: $('origFmt'), resultFmt: $('resultFmt'),
  targetFmt: $('targetFmt'), fmtHint: $('fmtHint'),
  quality: $('quality'), qualityVal: $('qualityVal'), qualityRow: $('qualityRow'),
  bgColor: $('bgColor'), bgRow: $('bgRow'),
  maxDim: $('maxDim'),
  notice: $('notice'),
  downloadBtn: $('downloadBtn'), resetBtn: $('resetBtn'), status: $('status'),
};

const state = {
  img: null,
  file: null,
  name: 'image',
  srcFmt: '',
  hasAlpha: false,
  url: null,
  gen: 0,
  busy: false,
};

const KB = 1024;
const fmtSize = b => b < KB ? `${b} B` : b < KB * KB ? `${(b / KB).toFixed(1)} KB` : `${(b / KB / KB).toFixed(2)} MB`;

/* 从 MIME / 文件名推断格式标签 */
function fmtLabel(file) {
  const m = (file.type || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'JPEG';
  if (m.includes('png')) return 'PNG';
  if (m.includes('webp')) return 'WebP';
  if (m.includes('bmp')) return 'BMP';
  if (m.includes('gif')) return 'GIF';
  if (m.includes('avif')) return 'AVIF';
  if (m.includes('svg')) return 'SVG';
  const ext = (file.name || '').split('.').pop().toUpperCase();
  return ext || '?';
}

/* ---------- 文件导入 ---------- */
els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('dragover', e => { e.preventDefault(); els.dropZone.classList.add('dragover'); });
els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('dragover'));
els.dropZone.addEventListener('drop', e => {
  e.preventDefault(); els.dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});
els.fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) handleFile(f);
});

document.addEventListener('paste', e => {
  const items = (e.clipboardData || {}).items || [];
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) { handleFile(f); e.preventDefault(); return; }
    }
  }
});

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) { alert(T.pickImage); return; }
  state.name = (file.name || 'image').replace(/\.[^.]+$/, '');
  state.file = file;
  state.srcFmt = fmtLabel(file);
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.img = img;
    els.origImg.src = url;
    els.origSize.textContent = fmtSize(file.size);
    els.origDims.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
    els.origFmt.textContent = state.srcFmt;

    // 智能推荐目标格式：源是 PNG 就默认 JPEG，否则默认 WebP
    els.targetFmt.value = state.srcFmt === 'PNG' ? 'jpeg' : 'webp';

    els.uploadPanel.classList.add('hidden');
    els.workPanel.classList.remove('hidden');
    convert();
  };
  img.onerror = () => alert('图片加载失败 / Failed to load image');
  img.src = url;
}

/* ---------- 参数变化 ---------- */
let debounce = null;
function schedule() {
  clearTimeout(debounce);
  debounce = setTimeout(convert, 200);
}
els.targetFmt.addEventListener('change', () => { updateHint(); convert(); });
els.quality.addEventListener('input', () => { els.qualityVal.textContent = els.quality.value; schedule(); });
els.bgColor.addEventListener('input', schedule);
els.maxDim.addEventListener('input', schedule);
els.resetBtn.addEventListener('click', resetAll);

function updateHint() {
  const f = els.targetFmt.value;
  els.fmtHint.textContent = f === 'png' ? T.pngHint : f === 'jpeg' ? T.jpegHint : T.webpHint;
}

/* ---------- 编码 ---------- */
function supportsType(mime) {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.toDataURL(mime).startsWith(`data:${mime}`);
}

function drawToCanvas(img, maxDim, fillColor) {
  let w = img.naturalWidth, h = img.naturalHeight;
  const cap = parseInt(maxDim, 10) || 0;
  if (cap > 0 && Math.max(w, h) > cap) {
    const s = cap / Math.max(w, h);
    w = Math.round(w * s); h = Math.round(h * s);
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { alpha: true });
  if (fillColor) {
    // JPEG 不支持透明：先铺底色
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas: c, w, h };
}

/** 采样检测是否存在透明像素（每隔若干像素采一次，够用且快） */
function detectAlpha(canvas) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { width: w, height: h } = canvas;
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)));  // 约采样 4 万点
    for (let y = 0; y < h; y += step) {
      const row = ctx.getImageData(0, y, w, 1).data;
      for (let x = 3; x < row.length; x += 4 * step) {
        if (row[x] < 250) return true;
      }
    }
  } catch (e) { /* 跨域等异常，忽略 */ }
  return false;
}

function canvasToBlob(canvas, mime, q) {
  return new Promise(res => canvas.toBlob(b => res(b), mime, q));
}

function mimeOf(fmt) {
  return fmt === 'png' ? 'image/png' : fmt === 'jpeg' ? 'image/jpeg' : 'image/webp';
}

async function convert() {
  if (!state.img || state.busy) return;
  state.busy = true;
  const gen = state.gen;
  els.status.textContent = T.compressing;

  let target = els.targetFmt.value;
  let mime = mimeOf(target);
  // 浏览器不支持 WebP 编码 → 回退 JPEG
  if (mime === 'image/webp' && !supportsType('image/webp')) { mime = 'image/jpeg'; target = 'jpeg'; }

  try {
    // 先不带底色画一次，用于检测透明
    const probe = drawToCanvas(state.img, els.maxDim.value, null);
    state.hasAlpha = detectAlpha(probe.canvas);

    const needFill = mime === 'image/jpeg' && state.hasAlpha;
    const fillColor = needFill ? els.bgColor.value : null;
    const { canvas, w, h } = drawToCanvas(state.img, els.maxDim.value, fillColor);

    const q = Math.max(1, Math.min(100, parseInt(els.quality.value, 10))) / 100;
    const blob = mime === 'image/png'
      ? await canvasToBlob(canvas, 'image/png', 1)
      : await canvasToBlob(canvas, mime, q);
    if (!blob) throw new Error('no blob');
    if (gen !== state.gen) { state.busy = false; return; }

    if (state.url) URL.revokeObjectURL(state.url);
    state.url = URL.createObjectURL(blob);
    els.resultImg.src = state.url;
    els.resultSize.textContent = fmtSize(blob.size);
    els.resultDims.textContent = `${w}×${h}`;
    els.resultFmt.textContent = target === 'png' ? 'PNG' : target === 'jpeg' ? 'JPEG' : 'WebP';

    // 透明通道提示
    if (needFill) {
      els.notice.textContent = T.alphaNotice;
      els.notice.className = 'notice warn';
    } else if (state.hasAlpha && mime !== 'image/jpeg') {
      els.notice.textContent = T.keepAlpha;
      els.notice.className = 'notice ok';
    } else if (state.srcFmt && state.srcFmt.toUpperCase() === els.resultFmt.textContent.toUpperCase()) {
      els.notice.textContent = T.sameFmt;
      els.notice.className = 'notice';
    } else {
      els.notice.textContent = '';
      els.notice.className = 'notice';
    }

    // 透明相关控件只在需要时显示
    els.bgRow.classList.toggle('hidden', mime !== 'image/jpeg' || !state.hasAlpha);

    // 质量滑块对 PNG 无意义
    els.qualityRow.classList.toggle('hidden', mime === 'image/png');

    els.downloadBtn.href = state.url;
    els.downloadBtn.download = outName(target);
    els.status.textContent = T.done;
  } catch (e) {
    console.warn('[convert]', e);
    if (gen === state.gen) els.status.textContent = T.failed;
  }
  state.busy = false;
}

function outName(fmt) {
  const ext = fmt === 'png' ? 'png' : fmt === 'jpeg' ? 'jpg' : 'webp';
  return `${state.name}.${ext}`;
}

function resetAll() {
  if (state.url) URL.revokeObjectURL(state.url);
  state.img = null; state.file = null; state.url = null; state.hasAlpha = false;
  state.gen++;
  els.fileInput.value = '';
  els.workPanel.classList.add('hidden');
  els.uploadPanel.classList.remove('hidden');
  els.status.textContent = '';
  els.notice.textContent = '';
}

/* ---------- init ---------- */
els.qualityVal.textContent = els.quality.value;
updateHint();

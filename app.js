"use strict";

const EXT_KIND = {
  jpg: "jpeg", jpeg: "jpeg", jpe: "jpeg", jfif: "jpeg", pjpeg: "jpeg", pjp: "jpeg",
  png: "png", apng: "png", gif: "gif", webp: "webp", bmp: "bmp", dib: "bmp",
  ico: "ico", cur: "cur", svg: "svg", svgz: "svgz", avif: "avif",
  tif: "tiff", tiff: "tiff", heic: "heic", heif: "heif"
};

const MIME_KIND = {
  "image/jpeg": "jpeg", "image/jpg": "jpeg", "image/pjpeg": "jpeg",
  "image/png": "png", "image/apng": "png", "image/gif": "gif", "image/webp": "webp",
  "image/bmp": "bmp", "image/x-ms-bmp": "bmp", "image/svg+xml": "svg",
  "image/avif": "avif", "image/tiff": "tiff", "image/tif": "tiff",
  "image/heic": "heic", "image/heif": "heif", "image/heic-sequence": "heic",
  "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico"
};

const KIND_LABEL = {
  jpeg: "JPG", png: "PNG", gif: "GIF", webp: "WEBP", bmp: "BMP",
  tiff: "TIFF", svg: "SVG", svgz: "SVG", ico: "ICO", cur: "CUR",
  avif: "AVIF", heic: "HEIC", heif: "HEIF"
};

const ADJUSTMENTS = [
  ["exposure", "노출", -100, 100],
  ["luminance", "휘도", -100, 100],
  ["highlights", "하이라이트", -100, 100],
  ["shadows", "그림자", -100, 100],
  ["contrast", "대비", -100, 100],
  ["brightness", "밝기", -100, 100],
  ["black", "블랙포인트", -100, 100],
  ["saturation", "채도", -100, 100],
  ["vibrance", "색선명도", -100, 100],
  ["warmth", "따뜻함", -100, 100],
  ["tint", "색조", -100, 100],
  ["sharpness", "선명도", 0, 100],
  ["clarity", "명료도", -100, 100],
  ["noise", "노이즈 감소", 0, 100],
  ["vignette", "비네트", -100, 100]
];

const FILTER_BIAS = {
  none: {},
  bw: { saturation: -100 },
  noir: { saturation: -100, contrast: 36, shadows: -18, highlights: -12, black: 18, vignette: 36, brightness: -4 },
  mono: { saturation: -82, contrast: 10, warmth: -6, luminance: 4 },
  silver: { saturation: -100, warmth: -16, tint: -10, black: -10, highlights: 10, contrast: 8 },
  warm: { warmth: 26, tint: 8, saturation: 10, brightness: 4 },
  cool: { warmth: -26, tint: -6, saturation: 6, highlights: 4 }
};

const MAX_EDGE = 8192;
const PREVIEW_EDGE = 720;

const dropzone = document.getElementById("dropzone");
const pickButton = document.getElementById("pick-button");
const fileInput = document.getElementById("file-input");
const toast = document.getElementById("toast");
const studio = document.getElementById("studio");
const stage = document.getElementById("stage");
const stageBoard = document.getElementById("stage-board");
const stageCanvas = document.getElementById("stage-canvas");
const stageTitle = document.getElementById("stage-title");
const cropVeil = document.getElementById("crop-veil");
const cropBox = document.getElementById("crop-box");
const cropTools = document.getElementById("crop-tools");
const cropZoom = document.getElementById("crop-zoom");
const cropZoomOut = document.getElementById("crop-zoom-out");
const ratioW = document.getElementById("ratio-w");
const ratioH = document.getElementById("ratio-h");
const padOptions = document.getElementById("pad-options");
const colorField = document.getElementById("color-field");
const padColor = document.getElementById("pad-color");
const extendHelp = document.getElementById("extend-help");
const angle = document.getElementById("angle");
const angleNum = document.getElementById("angle-num");
const adjSliders = document.getElementById("adj-sliders");
const aiHelp = document.getElementById("ai-help");
const shareSheet = document.getElementById("share-sheet");
const shareName = document.getElementById("share-name");
const qrPanel = document.getElementById("qr-panel");
const qrStatus = document.getElementById("qr-status");
const qrTarget = document.getElementById("qr-target");
const qrLink = document.getElementById("qr-link");
const qrCopy = document.getElementById("qr-copy");
const scaleInput = document.getElementById("scale");
const scaleNum = document.getElementById("scale-num");
const qualityInput = document.getElementById("quality");
const qualityNum = document.getElementById("quality-num");
const compactJpeg = document.getElementById("compact-jpeg");
const sizeHint = document.getElementById("size-hint");
const historySection = document.getElementById("history-section");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const filesSection = document.getElementById("files");
const fileCount = document.getElementById("file-count");
const fileList = document.getElementById("file-list");
const batchBtn = document.getElementById("batch-download");
const batchHint = document.getElementById("batch-hint");

const items = [];
let selectedId = null;
let nextId = 1;
let toastTimer = 0;
let previewTimer = 0;
let exportTimer = 0;
let heicPromise = null;
const encodeSupport = new Map();
const queue = { tail: Promise.resolve() };

ADJUSTMENTS.forEach(([key, label, min, max]) => {
  const row = document.createElement("label");
  row.className = "slider";
  row.innerHTML = `${label}<input type="range" min="${min}" max="${max}" value="0" data-adj="${key}"><input class="adj-num" type="number" min="${min}" max="${max}" value="0" data-adj="${key}" inputmode="numeric">`;
  adjSliders.appendChild(row);
});

pickButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

dropzone.addEventListener("dragenter", (event) => event.preventDefault());
dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  dropzone.classList.add("is-over");
});
dropzone.addEventListener("dragleave", (event) => {
  const next = event.relatedTarget;
  if (!next || !dropzone.contains(next)) dropzone.classList.remove("is-over");
});
dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("is-over");
  addFiles(event.dataTransfer ? event.dataTransfer.files : []);
});
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

document.querySelectorAll(".ratio").forEach((button) => {
  button.addEventListener("click", () => {
    selectRatio(button);
    syncModeUI();
    refreshPreview();
    reprocessAll();
  });
});

[ratioW, ratioH].forEach((input) => {
  input.addEventListener("wheel", () => input.blur(), { passive: true });
  input.addEventListener("input", () => {
    selectRatio(document.querySelector('.ratio[data-custom="true"]'));
    refreshPreview();
    scheduleExportAll();
  });
});

document.querySelectorAll(".mode").forEach((button) => {
  button.addEventListener("click", () => {
    setPressed(".mode", button);
    syncModeUI();
    refreshPreview();
    reprocessAll();
  });
});

document.querySelectorAll(".pad-fill").forEach((button) => {
  button.addEventListener("click", () => {
    setPressed(".pad-fill", button);
    syncModeUI();
    refreshPreview();
    reprocessAll();
  });
});

padColor.addEventListener("input", () => {
  if (currentMode() === "pad" && currentFill() === "color") {
    refreshPreview();
    scheduleExportAll();
  }
});

document.getElementById("flip-btn").addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  item.edit.flip = !item.edit.flip;
  afterItemEdit(item);
});

document.getElementById("rot-left").addEventListener("click", () => rotateBy(-1));
document.getElementById("rot-right").addEventListener("click", () => rotateBy(1));

function setAngle(value) {
  const item = selectedItem();
  if (!item) return;
  const next = clamp(Number(value) || 0, -180, 180);
  item.edit.angle = next;
  angle.value = String(next);
  angleNum.value = String(next);
  refreshPreview();
  scheduleExport(item);
}

angle.addEventListener("input", () => setAngle(angle.value));
angleNum.addEventListener("input", () => setAngle(angleNum.value));
angleNum.addEventListener("change", () => setAngle(angleNum.value));

function setScale(value) {
  const item = selectedItem();
  if (!item) return;
  const next = clamp(Number(value) || 100, 20, 100);
  item.edit.scale = next;
  scaleInput.value = String(next);
  scaleNum.value = String(next);
  updateSizeHint(item);
  scheduleExport(item);
}

function setQuality(value) {
  const item = selectedItem();
  if (!item) return;
  const next = clamp(Number(value) || 92, 20, 100);
  item.edit.quality = next;
  qualityInput.value = String(next);
  qualityNum.value = String(next);
  updateSizeHint(item);
  scheduleExport(item);
}

scaleInput.addEventListener("input", () => setScale(scaleInput.value));
scaleNum.addEventListener("input", () => setScale(scaleNum.value));
scaleNum.addEventListener("change", () => setScale(scaleNum.value));
qualityInput.addEventListener("input", () => setQuality(qualityInput.value));
qualityNum.addEventListener("input", () => setQuality(qualityNum.value));
qualityNum.addEventListener("change", () => setQuality(qualityNum.value));
compactJpeg.addEventListener("change", () => {
  const item = selectedItem();
  if (!item) return;
  item.edit.compact = compactJpeg.checked;
  updateSizeHint(item);
  scheduleExport(item);
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    const item = selectedItem();
    if (!item) return;
    item.edit.filter = button.dataset.filter;
    setPressed(".filter", button);
    refreshPreview();
    scheduleExport(item);
  });
});

function setAdj(key, raw) {
  const item = selectedItem();
  const spec = ADJUSTMENTS.find((row) => row[0] === key);
  if (!item || !spec) return;
  const value = clamp(Number(raw) || 0, spec[2], spec[3]);
  item.edit[key] = value;
  adjSliders.querySelectorAll(`[data-adj="${key}"]`).forEach((el) => { el.value = String(value); });
  refreshPreview();
  scheduleExport(item);
}

adjSliders.addEventListener("input", (event) => {
  const input = event.target.closest("[data-adj]");
  if (input) setAdj(input.dataset.adj, input.value);
});
adjSliders.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='number'][data-adj]");
  if (input) setAdj(input.dataset.adj, input.value);
});

document.getElementById("reset-adj").addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  ADJUSTMENTS.forEach(([key]) => { item.edit[key] = 0; });
  item.edit.filter = "none";
  syncEditorUI(item);
  refreshPreview();
  scheduleExport(item);
});

document.getElementById("apply-all").addEventListener("click", () => {
  const source = selectedItem();
  if (!source) return;
  items.forEach((item) => {
    if (item === source) return;
    const cropX = item.edit.cropX;
    const cropY = item.edit.cropY;
    const zoom = item.edit.zoom;
    Object.assign(item.edit, cloneEdit(source.edit), { cropX, cropY, zoom });
  });
  reprocessAll();
});

cropZoom.addEventListener("input", () => {
  const item = selectedItem();
  if (!item) return;
  item.edit.zoom = Number(cropZoom.value) || 1;
  cropZoomOut.textContent = `${item.edit.zoom.toFixed(1)}×`;
  refreshPreview();
  scheduleExport(item);
});

bindCropDrag();

fileList.addEventListener("click", (event) => {
  const card = event.target.closest(".file-card");
  if (!card) return;
  const item = items.find((entry) => entry.id === card.dataset.id);
  if (!item) return;
  if (event.target.closest(".remove")) {
    removeItem(item);
    return;
  }
  if (event.target.closest(".download") && item.blob && item.status === "done") {
    downloadBlob(item.blob, item.outName);
    return;
  }
  const send = event.target.closest("[data-send]");
  if (send && item.blob && item.status === "done") {
    openShare(item, send.dataset.send);
    return;
  }
  selectItem(item);
});

batchBtn.addEventListener("click", () => {
  downloadAll().catch((error) => showToast(error.message || "압축에 실패했습니다."));
});

let shareTarget = null;
shareSheet.querySelectorAll("[data-send]").forEach((button) => {
  button.addEventListener("click", () => {
    if (shareTarget) sendItem(shareTarget, button.dataset.send);
  });
});
document.getElementById("share-close").addEventListener("click", closeShare);
shareSheet.addEventListener("click", (event) => {
  if (event.target === shareSheet) closeShare();
});
qrCopy.addEventListener("click", async () => {
  const url = qrLink.dataset.url || qrLink.href;
  if (!url || url === "#") return;
  try {
    await navigator.clipboard.writeText(url);
    qrCopy.textContent = "복사됨";
  } catch {
    showToast("링크를 복사하지 못했습니다.");
  }
});

syncModeUI();

function defaultEdit() {
  const edit = {
    cropX: 0.5,
    cropY: 0.5,
    zoom: 1,
    flip: false,
    turns: 0,
    angle: 0,
    filter: "none",
    scale: 100,
    quality: 92,
    compact: false
  };
  ADJUSTMENTS.forEach(([key]) => { edit[key] = 0; });
  return edit;
}

function cloneEdit(edit) {
  return { ...edit };
}

function selectedItem() {
  return items.find((item) => item.id === selectedId) || null;
}

function setPressed(selector, button) {
  document.querySelectorAll(selector).forEach((other) => {
    const on = other === button;
    other.classList.toggle("is-selected", on);
    other.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function selectRatio(button) {
  document.querySelectorAll(".ratio").forEach((other) => {
    const on = other === button;
    other.classList.toggle("is-selected", on);
    other.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function currentMode() {
  return document.querySelector(".mode.is-selected")?.dataset.mode || "pad";
}

function currentFill() {
  return document.querySelector(".pad-fill.is-selected")?.dataset.fill || "color";
}

function currentRatio() {
  const button = document.querySelector(".ratio.is-selected");
  if (!button) return null;
  if (button.dataset.custom === "true") {
    const w = Number(ratioW.value);
    const h = Number(ratioH.value);
    if (!(w > 0) || !(h > 0) || w > 100000 || h > 100000) return null;
    return { w, h, label: `${trimNum(w)}x${trimNum(h)}` };
  }
  const w = Number(button.dataset.w);
  const h = Number(button.dataset.h);
  return { w, h, label: button.dataset.label || `${trimNum(w)}x${trimNum(h)}` };
}

function currentBackground() {
  const value = padColor.value || "#f2f2f7";
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#f2f2f7";
}

function syncModeUI() {
  const crop = currentMode() === "crop";
  const fill = currentFill();
  padOptions.hidden = crop;
  cropTools.hidden = !crop;
  cropVeil.hidden = !crop;
  colorField.hidden = crop || fill !== "color";
  extendHelp.hidden = crop || fill !== "extend";
  aiHelp.hidden = crop || fill !== "ai";
}

function rotateBy(step) {
  const item = selectedItem();
  if (!item) return;
  item.edit.turns = (((item.edit.turns + step) % 4) + 4) % 4;
  afterItemEdit(item);
}

function afterItemEdit(item) {
  refreshPreview();
  scheduleExport(item);
}

function addFiles(fileListLike) {
  const incoming = Array.from(fileListLike || []);
  const rejected = [];
  const added = [];
  let heavy = false;
  incoming.forEach((file) => {
    const kind = detectKind(file);
    if (!kind || !file.size) {
      rejected.push(file.name || "이름 없는 파일");
      return;
    }
    if (file.size > 15 * 1024 * 1024) heavy = true;
    const item = createItem(file, kind);
    items.push(item);
    added.push(item);
  });
  const notes = [];
  if (rejected.length) {
    const names = rejected.slice(0, 4).join(", ");
    const extra = rejected.length > 4 ? ` 외 ${rejected.length - 4}개` : "";
    notes.push(`지원하지 않는 파일이 있습니다: ${names}${extra}`);
  }
  if (heavy) notes.push("큰 파일은 조정에 시간이 더 걸릴 수 있습니다.");
  if (notes.length) showToast(notes.join(" "));
  updateBatch();
  if (added.length) {
    selectItem(added[0]);
    added.forEach((item) => enqueue(() => processItem(item)));
    requestAnimationFrame(() => refreshPreview());
  }
}

function createItem(file, kind) {
  const item = {
    id: String(nextId++),
    file,
    kind,
    edit: defaultEdit(),
    status: "queued",
    blob: null,
    outName: "",
    sourceUrl: URL.createObjectURL(file),
    resultUrl: "",
    source: null,
    preview: null,
    removed: false,
    job: 0,
    srcW: 0,
    srcH: 0,
    outW: 0,
    outH: 0,
    clamped: false,
    el: null
  };
  const card = document.createElement("li");
  card.className = "file-card";
  card.dataset.id = item.id;
  card.innerHTML = `
    <div class="thumb-wrap"><img class="thumb" alt=""></div>
    <div class="file-body">
      <div class="file-top">
        <div class="file-names">
          <p class="file-name"></p>
          <p class="file-meta"></p>
          <p class="file-out"></p>
        </div>
        <button type="button" class="remove">제거</button>
      </div>
      <p class="file-status">대기</p>
      <div class="progress-row">
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span class="progress-fill"></span>
          <span class="progress-label">0%</span>
        </div>
        <button type="button" class="download" disabled>다운로드</button>
      </div>
      <div class="share-row">
        <button type="button" data-send="kakao" disabled>카카오톡</button>
        <button type="button" data-send="mail" disabled>이메일</button>
        <button type="button" data-send="sms" disabled>문자</button>
        <button type="button" data-send="qr" disabled>QR 받기</button>
      </div>
    </div>`;
  card.querySelector(".file-name").textContent = file.name;
  card.querySelector(".thumb").src = item.sourceUrl;
  card.querySelector(".thumb").alt = `${file.name} 미리보기`;
  card.querySelector(".remove").setAttribute("aria-label", `${file.name} 제거`);
  card.querySelector(".file-meta").textContent = `${KIND_LABEL[kind] || kind} · ${formatBytes(file.size)}`;
  item.el = card;
  fileList.appendChild(card);
  return item;
}

function selectItem(item) {
  selectedId = item.id;
  items.forEach((entry) => entry.el.classList.toggle("is-active", entry === item));
  stageTitle.textContent = item.file.name;
  syncEditorUI(item);
  refreshPreview();
}

function syncEditorUI(item) {
  const edit = item.edit;
  cropZoom.value = String(edit.zoom);
  cropZoomOut.textContent = `${Number(edit.zoom).toFixed(1)}×`;
  angle.value = String(edit.angle);
  angleNum.value = String(edit.angle);
  scaleInput.value = String(edit.scale ?? 100);
  scaleNum.value = String(edit.scale ?? 100);
  qualityInput.value = String(edit.quality ?? 92);
  qualityNum.value = String(edit.quality ?? 92);
  compactJpeg.checked = Boolean(edit.compact);
  updateSizeHint(item);
  document.querySelectorAll(".filter").forEach((button) => {
    const on = button.dataset.filter === edit.filter;
    button.classList.toggle("is-selected", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  adjSliders.querySelectorAll("[data-adj]").forEach((input) => {
    input.value = String(edit[input.dataset.adj] || 0);
  });
}

function removeItem(item) {
  item.removed = true;
  item.job += 1;
  URL.revokeObjectURL(item.sourceUrl);
  if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
  item.el.remove();
  const index = items.indexOf(item);
  if (index >= 0) items.splice(index, 1);
  if (selectedId === item.id) {
    selectedId = items[0] ? items[0].id : null;
    if (items[0]) selectItem(items[0]);
    else clearStage();
  }
  updateBatch();
}

function clearStage() {
  const ctx = stageCanvas.getContext("2d");
  ctx.clearRect(0, 0, stageCanvas.width, stageCanvas.height);
  stageCanvas.width = 1;
  stageCanvas.height = 1;
  cropVeil.hidden = true;
  cropTools.hidden = true;
  stageTitle.textContent = "사진을 고르면 여기서 다듬습니다";
}

function reprocessAll() {
  items.forEach((item) => enqueue(() => processItem(item)));
}

function scheduleExport(item) {
  clearTimeout(exportTimer);
  exportTimer = setTimeout(() => enqueue(() => processItem(item)), 280);
}

function scheduleExportAll() {
  clearTimeout(exportTimer);
  exportTimer = setTimeout(reprocessAll, 280);
}

function refreshPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    drawPreview().catch((error) => showToast(error.message || "미리보기를 만들지 못했습니다."));
  }, 30);
}

async function drawPreview() {
  const item = selectedItem();
  const ratio = currentRatio();
  if (!item || !ratio) {
    if (!ratio && item) showToast("가로와 세로 비율을 0보다 큰 숫자로 입력해 주세요.");
    return;
  }
  syncModeUI();
  const source = await ensurePreview(item);
  if (selectedItem() !== item) return;
  const transformed = transformCanvas(source, item.edit);
  const mode = currentMode();
  if (mode === "crop") {
    const colored = applyColor(cloneCanvas(transformed), item.edit, { skipVignette: true });
    paintStage(colored);
    placeCropBox(transformed.width, transformed.height, ratio, item.edit);
    cropVeil.hidden = false;
  } else {
    const laid = await composeCanvas(transformed, ratio, mode, item, { waitAi: false });
    const colored = applyColor(laid.canvas, item.edit);
    paintStage(colored);
    cropVeil.hidden = true;
  }
}

function paintStage(source) {
  const maxW = Math.max(240, stage.clientWidth - 24);
  const maxH = Math.max(240, Math.min(560, window.innerHeight * 0.55));
  const scale = Math.min(maxW / source.width, maxH / source.height, 1);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  stageCanvas.width = width;
  stageCanvas.height = height;
  const ctx = stageCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
}

function placeCropBox(srcW, srcH, ratio, edit) {
  const crop = cropRect(srcW, srcH, ratio, edit);
  const scale = stageCanvas.width / srcW;
  const left = crop.sx * scale;
  const top = crop.sy * scale;
  const width = crop.sw * scale;
  const height = crop.sh * scale;
  cropBox.style.left = `${left}px`;
  cropBox.style.top = `${top}px`;
  cropBox.style.width = `${width}px`;
  cropBox.style.height = `${height}px`;
  const boardW = stageCanvas.width;
  const boardH = stageCanvas.height;
  document.getElementById("dim-t").style.cssText = `left:0;top:0;width:${boardW}px;height:${top}px`;
  document.getElementById("dim-b").style.cssText = `left:0;top:${top + height}px;width:${boardW}px;height:${Math.max(0, boardH - top - height)}px`;
  document.getElementById("dim-l").style.cssText = `left:0;top:${top}px;width:${left}px;height:${height}px`;
  document.getElementById("dim-r").style.cssText = `left:${left + width}px;top:${top}px;width:${Math.max(0, boardW - left - width)}px;height:${height}px`;
}

function bindCropDrag() {
  let drag = null;
  const point = (event) => {
    const box = stageCanvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  cropBox.addEventListener("pointerdown", (event) => {
    const item = selectedItem();
    if (!item || currentMode() !== "crop") return;
    cropBox.setPointerCapture(event.pointerId);
    drag = { item, start: point(event), x: item.edit.cropX, y: item.edit.cropY };
  });
  cropBox.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const ratio = currentRatio();
    if (!ratio) return;
    const source = drag.item.preview || drag.item.source;
    if (!source) return;
    const transformed = measureTransform(source.width, source.height, drag.item.edit);
    const crop = cropRect(transformed.w, transformed.h, ratio, { ...drag.item.edit, cropX: drag.x, cropY: drag.y });
    const now = point(event);
    const scale = stageCanvas.width / transformed.w;
    const nx = clamp(drag.x + (now.x - drag.start.x) / scale / transformed.w, crop.sw / (2 * transformed.w), 1 - crop.sw / (2 * transformed.w));
    const ny = clamp(drag.y + (now.y - drag.start.y) / scale / transformed.h, crop.sh / (2 * transformed.h), 1 - crop.sh / (2 * transformed.h));
    drag.item.edit.cropX = nx;
    drag.item.edit.cropY = ny;
    placeCropBox(transformed.w, transformed.h, ratio, drag.item.edit);
  });
  const endDrag = () => {
    if (!drag) return;
    const item = drag.item;
    drag = null;
    scheduleExport(item);
  };
  cropBox.addEventListener("pointerup", endDrag);
  cropBox.addEventListener("pointercancel", endDrag);
}

async function processItem(item) {
  const job = ++item.job;
  const ratio = currentRatio();
  if (!ratio) {
    markError(item, "가로와 세로 비율을 0보다 큰 숫자로 입력해 주세요.");
    updateBatch();
    return;
  }
  item.status = "working";
  item.el.classList.remove("is-error", "is-done");
  item.el.dataset.status = "working";
  setCardActions(item, false);
  setProgress(item, 16, "파일을 읽는 중");
  try {
    const source = await ensureSource(item);
    if (stale(item, job)) return;
    const fill = currentFill();
    setProgress(item, 42, fill === "ai" && currentMode() === "pad" ? "AI가 여백을 그리는 중" : "사진을 다듬는 중");
    const transformed = transformCanvas(source, item.edit);
    const laid = await composeCanvas(transformed, ratio, currentMode(), item, { waitAi: true });
    if (stale(item, job)) return;
    setProgress(item, 70, "색감을 맞추는 중");
    const colored = applyColor(laid.canvas, item.edit);
    item.clamped = laid.clamped;
    item.srcW = source.width;
    item.srcH = source.height;
    if (stale(item, job)) return;
    setProgress(item, 88, "파일을 만드는 중");
    const sized = shrinkCanvas(colored, item.edit.scale ?? 100);
    const encoded = await encodeCanvas(sized, item.kind, item.file.name, item.edit);
    const preview = await canvasToBlob(sized, "image/png");
    if (stale(item, job)) return;
    item.blob = encoded.blob;
    item.outW = sized.width;
    item.outH = sized.height;
    item.outName = buildName(item.file.name, item.outW, item.outH, encoded.ext);
    item.status = "done";
    item.el.classList.add("is-done");
    item.el.dataset.status = "done";
    item.el.dataset.outName = item.outName;
    item.el.dataset.outW = String(item.outW);
    item.el.dataset.outH = String(item.outH);
    item.el.querySelector(".file-meta").textContent = metaText(item);
    item.el.querySelector(".file-out").textContent = item.outName;
    setCardActions(item, true);
    item.el.querySelector(".download").setAttribute("aria-label", `${item.outName} 다운로드`);
    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    item.resultUrl = URL.createObjectURL(preview);
    const thumb = item.el.querySelector(".thumb");
    thumb.src = item.resultUrl;
    thumb.alt = `${item.file.name} 결과 미리보기`;
    setProgress(item, 100, "완료");
    updateSizeHint(item);
    rememberHistory(item).catch(() => {});
  } catch (error) {
    if (stale(item, job)) return;
    markError(item, error.message || "조정에 실패했습니다.");
  }
  updateBatch();
}

function stale(item, job) {
  return item.removed || item.job !== job;
}

function enqueue(task) {
  const run = queue.tail.then(task, task);
  queue.tail = run.then(() => {}, () => {});
  return run;
}

function markError(item, message) {
  item.status = "error";
  item.blob = null;
  item.outName = "";
  item.el.classList.remove("is-done");
  item.el.classList.add("is-error");
  item.el.dataset.status = "error";
  setCardActions(item, false);
  item.el.querySelector(".progress").classList.add("is-error");
  item.el.querySelector(".file-out").textContent = "";
  setProgress(item, 100, message);
}

function setCardActions(item, enabled) {
  item.el.querySelectorAll(".download, [data-send]").forEach((button) => {
    button.disabled = !enabled;
  });
}

function setProgress(item, value, stageText) {
  const amount = Math.max(0, Math.min(100, Math.round(value)));
  const bar = item.el.querySelector(".progress");
  bar.classList.toggle("is-error", item.status === "error");
  bar.setAttribute("aria-valuenow", String(amount));
  bar.setAttribute("aria-valuetext", `${stageText} ${amount}%`);
  bar.querySelector(".progress-fill").style.width = `${amount}%`;
  bar.querySelector(".progress-label").textContent = `${amount}%`;
  item.el.querySelector(".file-status").textContent = stageText;
}

function updateBatch() {
  const total = items.length;
  const done = items.filter((item) => item.status === "done").length;
  const ready = total > 0 && items.every((item) => item.status === "done");
  studio.hidden = total === 0;
  filesSection.hidden = total === 0;
  fileCount.textContent = total ? `${total}장` : "";
  batchBtn.disabled = !ready;
  if (ready) {
    const name = zipFilename();
    batchHint.textContent = `모든 사진의 작업이 끝났습니다. ${name} 으로 저장합니다.`;
    batchBtn.title = name;
  } else {
    batchHint.textContent = total
      ? `완료 ${done}/${total} · 모든 사진의 작업이 끝나면 일괄 다운로드가 켜집니다.`
      : "모든 사진의 작업이 끝나면 한꺼번에 받을 수 있습니다.";
    batchBtn.title = "모든 사진의 작업이 끝나면 사용할 수 있습니다.";
  }
}

function metaText(item) {
  const parts = [`원본 ${item.srcW}×${item.srcH}`, `결과 ${item.outW}×${item.outH}`, KIND_LABEL[item.kind] || item.kind];
  if (item.clamped) parts.push("최대 8192px로 축소");
  return parts.join(" · ");
}

async function ensureSource(item) {
  if (item.source) return item.source;
  const decoded = await decodeFile(item.file, item.kind);
  item.source = asCanvas(decoded);
  closeBitmap(decoded);
  item.srcW = item.source.width;
  item.srcH = item.source.height;
  item.preview = scaleCanvas(item.source, PREVIEW_EDGE);
  return item.source;
}

async function ensurePreview(item) {
  await ensureSource(item);
  return item.preview || item.source;
}

function asCanvas(source) {
  if (source instanceof HTMLCanvasElement) return source;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d").drawImage(source, 0, 0);
  return canvas;
}

function cloneCanvas(source) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d").drawImage(source, 0, 0);
  return canvas;
}

function scaleCanvas(source, edge) {
  const scale = Math.min(1, edge / Math.max(source.width, source.height));
  if (scale === 1) return source;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function measureTransform(w, h, edit) {
  const turns = ((edit.turns % 4) + 4) % 4;
  let tw = w;
  let th = h;
  if (turns % 2) {
    tw = h;
    th = w;
  }
  if (!edit.angle) return { w: tw, h: th };
  const rad = edit.angle * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    w: Math.max(1, Math.ceil(tw * cos + th * sin)),
    h: Math.max(1, Math.ceil(tw * sin + th * cos))
  };
}

function transformCanvas(source, edit) {
  const turns = ((edit.turns % 4) + 4) % 4;
  const size = measureTransform(source.width, source.height, { ...edit, angle: 0 });
  const mid = document.createElement("canvas");
  mid.width = size.w;
  mid.height = size.h;
  const ctx = mid.getContext("2d");
  ctx.translate(size.w / 2, size.h / 2);
  ctx.rotate(turns * Math.PI / 2);
  if (edit.flip) ctx.scale(-1, 1);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  if (!edit.angle) return mid;
  const rotated = measureTransform(source.width, source.height, edit);
  const out = document.createElement("canvas");
  out.width = rotated.w;
  out.height = rotated.h;
  const ctx2 = out.getContext("2d");
  ctx2.translate(rotated.w / 2, rotated.h / 2);
  ctx2.rotate(edit.angle * Math.PI / 180);
  ctx2.drawImage(mid, -mid.width / 2, -mid.height / 2);
  return out;
}

function cropRect(srcW, srcH, ratio, edit) {
  const target = ratio.w / ratio.h;
  let baseW;
  let baseH;
  if (srcW / srcH > target) {
    baseH = srcH;
    baseW = srcH * target;
  } else {
    baseW = srcW;
    baseH = srcW / target;
  }
  const zoom = Math.max(1, edit.zoom || 1);
  const sw = Math.max(1, Math.round(baseW / zoom));
  const sh = Math.max(1, Math.round(baseH / zoom));
  const sx = clamp(Math.round((edit.cropX || 0.5) * srcW - sw / 2), 0, Math.max(0, srcW - sw));
  const sy = clamp(Math.round((edit.cropY || 0.5) * srcH - sh / 2), 0, Math.max(0, srcH - sh));
  return { sx, sy, sw, sh };
}

async function composeCanvas(source, ratio, mode, item, options = {}) {
  if (mode === "crop") {
    const crop = cropRect(source.width, source.height, ratio, item.edit);
    const canvas = document.createElement("canvas");
    canvas.width = crop.sw;
    canvas.height = crop.sh;
    canvas.getContext("2d").drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
    return { canvas, clamped: false };
  }
  const current = source.width / source.height;
  const target = ratio.w / ratio.h;
  let canvasW;
  let canvasH;
  if (current > target) {
    canvasW = source.width;
    canvasH = Math.max(1, Math.round(source.width / target));
  } else {
    canvasH = source.height;
    canvasW = Math.max(1, Math.round(source.height * target));
  }
  const layout = clampLayout({
    canvasW,
    canvasH,
    dx: Math.floor((canvasW - source.width) / 2),
    dy: Math.floor((canvasH - source.height) / 2),
    dw: source.width,
    dh: source.height
  });
  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasW;
  canvas.height = layout.canvasH;
  const ctx = canvas.getContext("2d");
  const fill = currentFill();
  if (fill === "ai") {
    await fillAi(ctx, canvas, source, layout, item, options);
  } else if (fill === "extend") {
    fillExtended(ctx, canvas, source, layout);
  } else {
    ctx.fillStyle = currentBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, source.width, source.height, layout.dx, layout.dy, layout.dw, layout.dh);
  }
  return { canvas, clamped: layout.clamped };
}

function clampLayout(layout) {
  const maxEdge = Math.max(layout.canvasW, layout.canvasH);
  if (maxEdge <= MAX_EDGE) return { ...layout, clamped: false };
  const scale = MAX_EDGE / maxEdge;
  return {
    canvasW: Math.max(1, Math.round(layout.canvasW * scale)),
    canvasH: Math.max(1, Math.round(layout.canvasH * scale)),
    dx: Math.max(0, Math.round(layout.dx * scale)),
    dy: Math.max(0, Math.round(layout.dy * scale)),
    dw: Math.max(1, Math.round(layout.dw * scale)),
    dh: Math.max(1, Math.round(layout.dh * scale)),
    clamped: true
  };
}

function fillExtended(ctx, canvas, source, layout) {
  fillFromPhoto(ctx, canvas, source, layout);
}

function aiKey(source, canvas, edit, scene) {
  return `${canvas.width}x${canvas.height}|${source.width}x${source.height}|${edit.turns}|${edit.flip}|${edit.angle}|${scene?.type || ""}|v2`;
}

function toHexColor(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function isSkinTone(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sum = r + g + b;
  return r > 95 && g > 40 && b > 20
    && r > g && r > b
    && (r - g) > 15 && (r - g) < 85
    && Math.abs(r - g) > Math.abs(g - b)
    && (max - min) > 15
    && sum > 220 && sum < 680
    && r < 250;
}

function analyzeScene(source, fileName = "") {
  const sampleW = 48;
  const sampleH = 48;
  const tiny = document.createElement("canvas");
  tiny.width = sampleW;
  tiny.height = sampleH;
  const tctx = tiny.getContext("2d", { willReadFrequently: true });
  tctx.drawImage(source, 0, 0, sampleW, sampleH);
  const data = tctx.getImageData(0, 0, sampleW, sampleH).data;
  const edge = { r: 0, g: 0, b: 0, n: 0, skin: 0 };
  const samples = [];
  const center = { n: 0, skin: 0 };
  const bottom = { r: 0, g: 0, b: 0, n: 0 };
  const border = 5;
  for (let y = 0; y < sampleH; y += 1) {
    for (let x = 0; x < sampleW; x += 1) {
      const i = (y * sampleW + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const onEdge = x < border || x >= sampleW - border || y < border || y >= sampleH - border;
      const inCenter = x >= sampleW * 0.28 && x <= sampleW * 0.72 && y >= sampleH * 0.1 && y <= sampleH * 0.58;
      const inBottom = y >= sampleH * 0.72 && x >= sampleW * 0.22 && x <= sampleW * 0.78;
      const skin = isSkinTone(r, g, b);
      if (onEdge) {
        edge.r += r;
        edge.g += g;
        edge.b += b;
        edge.n += 1;
        if (skin) edge.skin += 1;
        samples.push([r, g, b]);
      }
      if (inCenter) {
        center.n += 1;
        if (skin) center.skin += 1;
      }
      if (inBottom) {
        bottom.r += r;
        bottom.g += g;
        bottom.b += b;
        bottom.n += 1;
      }
    }
  }
  const bg = {
    r: edge.r / Math.max(1, edge.n),
    g: edge.g / Math.max(1, edge.n),
    b: edge.b / Math.max(1, edge.n)
  };
  let variance = 0;
  samples.forEach(([r, g, b]) => {
    variance += (r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2;
  });
  variance /= Math.max(1, samples.length);
  const skinRatio = center.skin / Math.max(1, center.n);
  const edgeSkin = edge.skin / Math.max(1, edge.n);
  const nameHint = /증명|여권|프로필|증명사진|id.?photo|passport|portrait|headshot/.test((fileName || "").toLowerCase());
  const uniform = variance < 2200;
  const faceOnStudio = skinRatio > 0.08 && edgeSkin < 0.2;
  let type = "scene";
  if (nameHint || (uniform && faceOnStudio) || (skinRatio > 0.16 && edgeSkin < 0.16)) type = "portrait";
  else if (uniform) type = "object";
  const clothing = {
    r: bottom.r / Math.max(1, bottom.n),
    g: bottom.g / Math.max(1, bottom.n),
    b: bottom.b / Math.max(1, bottom.n)
  };
  return {
    type,
    bg,
    bgCss: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
    clothingCss: `rgb(${Math.round(clothing.r)}, ${Math.round(clothing.g)}, ${Math.round(clothing.b)})`,
    hex: toHexColor(bg.r, bg.g, bg.b),
    skinRatio,
    variance
  };
}

async function fillAi(ctx, canvas, source, layout, item, options) {
  const scene = analyzeScene(source, item.file?.name);
  item.scene = scene;
  const key = aiKey(source, canvas, item.edit, scene);
  if (item.aiCache?.key === key) {
    paintAi(ctx, canvas, source, layout, item.aiCache.image, scene);
    return;
  }
  fillFromPhoto(ctx, canvas, source, layout);
  const job = ensureAiBackground(item, source, canvas, layout, scene, key);
  if (options.waitAi) {
    try {
      const image = await job;
      if (image) paintAi(ctx, canvas, source, layout, image, scene);
    } catch {
      fillFromPhoto(ctx, canvas, source, layout);
    }
    return;
  }
  job.then((image) => {
    if (image && selectedItem() === item && currentFill() === "ai") refreshPreview();
  }).catch(() => {});
}

function ensureAiBackground(item, source, canvas, layout, scene, key) {
  if (item.aiJob?.key === key) return item.aiJob.promise;
  const promise = generateAiBackground(source, canvas, layout, scene).then((image) => {
    if (!image) {
      item.aiCache = { key, image: null, scene };
      return null;
    }
    const baked = asCanvas(image);
    closeBitmap(image);
    const usable = scene.type === "portrait" && !aiLooksLikeStudio(baked, canvas.width, canvas.height, layout, scene)
      ? null
      : baked;
    item.aiCache = { key, image: usable, scene };
    return usable;
  }).catch((error) => {
    item.aiCache = { key, image: null, scene };
    throw error;
  });
  item.aiJob = { key, promise };
  return promise;
}

function sampleEdgeColor(source, side) {
  const w = Math.min(source.width, 72);
  const h = Math.min(source.height, 72);
  const tiny = document.createElement("canvas");
  tiny.width = w;
  tiny.height = h;
  const tctx = tiny.getContext("2d", { willReadFrequently: true });
  tctx.drawImage(source, 0, 0, w, h);
  const data = tctx.getImageData(0, 0, w, h).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const band = 4;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const take = side === "left" ? x < band
        : side === "right" ? x >= w - band
        : side === "top" ? y < band
        : side === "bottom" ? y >= h - band
        : x < band || x >= w - band || y < band || y >= h - band;
      if (!take) continue;
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  return `rgb(${Math.round(r / Math.max(1, n))}, ${Math.round(g / Math.max(1, n))}, ${Math.round(b / Math.max(1, n))})`;
}

function fillFromPhoto(ctx, canvas, source, layout) {
  const { dx, dy, dw, dh } = layout;
  const W = canvas.width;
  const H = canvas.height;
  const edgeX = Math.max(6, Math.round(source.width * 0.045));
  const edgeY = Math.max(6, Math.round(source.height * 0.045));
  const hemY = Math.max(10, Math.round(source.height * 0.16));
  ctx.fillStyle = sampleEdgeColor(source, "all");
  ctx.fillRect(0, 0, W, H);
  if (dx > 0) {
    ctx.fillStyle = sampleEdgeColor(source, "left");
    ctx.fillRect(0, 0, dx, H);
  }
  if (dx + dw < W) {
    ctx.fillStyle = sampleEdgeColor(source, "right");
    ctx.fillRect(dx + dw, 0, W - dx - dw, H);
  }
  if (dy > 0) {
    ctx.fillStyle = sampleEdgeColor(source, "top");
    ctx.fillRect(dx, 0, dw, dy);
  }
  if (dy + dh < H) {
    ctx.fillStyle = sampleEdgeColor(source, "bottom");
    ctx.fillRect(dx, dy + dh, dw, H - dy - dh);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (dx > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, dy, dx + 1, dh);
    ctx.clip();
    ctx.translate(dx, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(source, 0, 0, edgeX, source.height, 0, 0, dx, dh);
    ctx.restore();
  }
  if (dx + dw < W) {
    const pad = W - dx - dw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx + dw - 1, dy, pad + 1, dh);
    ctx.clip();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(
      source,
      Math.max(0, source.width - edgeX),
      0,
      edgeX,
      source.height,
      -pad,
      0,
      pad,
      dh
    );
    ctx.restore();
  }
  if (dy > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, 0, dw, dy + 1);
    ctx.clip();
    ctx.translate(dx, dy);
    ctx.scale(1, -1);
    ctx.drawImage(source, 0, 0, source.width, edgeY, 0, 0, dw, dy);
    ctx.restore();
  }
  if (dy + dh < H) {
    const pad = H - dy - dh;
    ctx.drawImage(
      source,
      0,
      Math.max(0, source.height - hemY),
      source.width,
      hemY,
      dx,
      dy + dh - 2,
      dw,
      pad + 2
    );
  }
  if (dx > 0 && dy > 0) {
    ctx.drawImage(source, 0, 0, edgeX, edgeY, 0, 0, dx + 1, dy + 1);
  }
  if (dx + dw < W && dy > 0) {
    ctx.drawImage(source, source.width - edgeX, 0, edgeX, edgeY, dx + dw - 1, 0, W - dx - dw + 1, dy + 1);
  }
  if (dx > 0 && dy + dh < H) {
    ctx.drawImage(source, 0, source.height - edgeY, edgeX, edgeY, 0, dy + dh - 1, dx + 1, H - dy - dh + 1);
  }
  if (dx + dw < W && dy + dh < H) {
    ctx.drawImage(
      source,
      source.width - edgeX,
      source.height - edgeY,
      edgeX,
      edgeY,
      dx + dw - 1,
      dy + dh - 1,
      W - dx - dw + 1,
      H - dy - dh + 1
    );
  }
  blurPads(ctx, canvas, layout);
  ctx.drawImage(source, 0, 0, source.width, source.height, dx, dy, dw, dh);
}

function blurPads(ctx, canvas, layout) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d").drawImage(canvas, 0, 0);
  ctx.save();
  ctx.filter = "blur(10px)";
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.rect(layout.dx + 6, layout.dy + 6, Math.max(1, layout.dw - 12), Math.max(1, layout.dh - 12));
  ctx.clip("evenodd");
  ctx.drawImage(copy, 0, 0);
  ctx.restore();
}

function paintAi(ctx, canvas, source, layout, bg, scene) {
  fillFromPhoto(ctx, canvas, source, layout);
  if (!bg) return;
  const usableH = Math.max(1, Math.round(bg.height * 0.98));
  const ai = document.createElement("canvas");
  ai.width = canvas.width;
  ai.height = canvas.height;
  ai.getContext("2d").drawImage(bg, 0, 0, bg.width, usableH, 0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.rect(layout.dx, layout.dy, layout.dw, layout.dh);
  ctx.clip("evenodd");
  ctx.drawImage(ai, 0, 0);
  ctx.restore();
  ctx.drawImage(source, 0, 0, source.width, source.height, layout.dx, layout.dy, layout.dw, layout.dh);
}

function aiLooksLikeStudio(bg, width, height, layout, scene) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bg, 0, 0, 64, 64);
  const data = ctx.getImageData(0, 0, 64, 64).data;
  const sx = layout.dx / width * 64;
  const sy = layout.dy / height * 64;
  const sw = layout.dw / width * 64;
  const sh = layout.dh / height * 64;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      if (x >= sx && x < sx + sw && y >= sy && y < sy + sh) continue;
      const i = (y * 64 + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  if (!n) return true;
  const dr = r / n - scene.bg.r;
  const dg = g / n - scene.bg.g;
  const db = b / n - scene.bg.b;
  return (dr * dr + dg * dg + db * db) < 140 * 140;
}

function scenePrompt(scene) {
  if (scene.type === "portrait") {
    return `Seamlessly outpaint this ID portrait to the full canvas. Keep the same person, face, hair and clothes unchanged. Continue the same solid ${scene.hex} studio backdrop into the empty borders with matching lighting. If space remains below, naturally continue the shoulders and clothing. No landscape, mountains, sunset, trees, sky, scenery, extra people, text or watermark. Photorealistic.`;
  }
  if (scene.type === "object") {
    return `Seamlessly outpaint this product photo to the full canvas. Keep the subject unchanged. Continue the same ${scene.hex} backdrop and surface into the borders. No extra objects, text or watermark. Photorealistic.`;
  }
  return `Seamlessly outpaint this photograph to the full canvas. Keep the existing subject unchanged. Continue the same environment, colors, lighting and perspective into the empty borders. No extra people, text or watermark. Photorealistic continuation of the same scene.`;
}

function makeGuideCanvas(source, width, height, layout) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 768 / Math.max(width, height));
  canvas.width = Math.max(64, Math.round(width * scale));
  canvas.height = Math.max(64, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  const scaled = {
    dx: Math.round(layout.dx * scale),
    dy: Math.round(layout.dy * scale),
    dw: Math.round(layout.dw * scale),
    dh: Math.round(layout.dh * scale)
  };
  fillFromPhoto(ctx, canvas, source, scaled);
  return canvas;
}

let aiUnavailable = false;

async function fetchAiImage(url, ms = 12000) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), ms);
  try {
    const res = await fetch(url, { signal: control.signal });
    if (!res.ok) {
      const error = new Error("ai");
      error.status = res.status;
      throw error;
    }
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("ai");
    return bitmapFromBlob(blob);
  } finally {
    clearTimeout(timer);
  }
}

async function postImageEdit(blob, prompt, w, h, model) {
  const form = new FormData();
  form.append("image", new File([blob], "guide.jpg", { type: "image/jpeg" }));
  form.append("prompt", prompt);
  form.append("model", model);
  form.append("width", String(w));
  form.append("height", String(h));
  form.append("nologo", "true");
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 40000);
  try {
    const res = await fetch("https://gen.pollinations.ai/v1/images/edits", {
      method: "POST",
      body: form,
      signal: control.signal
    });
    if (!res.ok) {
      const error = new Error("edit");
      error.status = res.status;
      throw error;
    }
    const type = res.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const json = await res.json();
      const url = json?.data?.[0]?.url || json?.url;
      if (!url) throw new Error("edit");
      return fetchAiImage(url, 20000);
    }
    const out = await res.blob();
    if (!out.type.startsWith("image/")) throw new Error("edit");
    return bitmapFromBlob(out);
  } finally {
    clearTimeout(timer);
  }
}

async function uploadGuide(blob) {
  const file = new File([blob], "guide.jpg", { type: "image/jpeg" });
  try {
    const cat = new FormData();
    cat.append("reqtype", "fileupload");
    cat.append("fileToUpload", file);
    const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: cat });
    const url = (await res.text()).trim();
    if (res.ok && /^https?:\/\//.test(url)) return url;
  } catch {
    // fall through
  }
  return uploadTemp(blob, "guide.jpg");
}

function snapSize(value) {
  return Math.min(1280, Math.max(512, Math.round(value / 64) * 64));
}

async function generateAiBackground(source, canvas, layout, scene) {
  if (aiUnavailable) return null;
  const w = snapSize(canvas.width);
  const h = snapSize(canvas.height);
  const prompt = scenePrompt(scene);
  const guide = makeGuideCanvas(source, canvas.width, canvas.height, layout);
  const guideBlob = await canvasToBlob(guide, "image/jpeg", 0.88);
  try {
    const edited = await postImageEdit(guideBlob, prompt, w, h, "kontext");
    if (edited) return edited;
  } catch (error) {
    if (error && (error.status === 401 || error.status === 402 || error.status === 403)) {
      aiUnavailable = true;
      return null;
    }
  }
  let imageUrl;
  try {
    imageUrl = await uploadGuide(guideBlob);
  } catch {
    return null;
  }
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&enhance=false&model=kontext&image=${encodeURIComponent(imageUrl)}`;
    return await fetchAiImage(url, 12000);
  } catch (error) {
    if (error && (error.status === 401 || error.status === 402 || error.status === 403 || error.status === 500)) {
      aiUnavailable = true;
    }
    return null;
  }
}

function coverRect(sw, sh, dw, dh) {
  const scale = Math.max(dw / sw, dh / sh);
  const tw = sw * scale;
  const th = sh * scale;
  return {
    sx: 0,
    sy: 0,
    sw,
    sh,
    dx: (dw - tw) / 2,
    dy: (dh - th) / 2,
    dw: tw,
    dh: th
  };
}

function mergeEdit(edit) {
  const bias = FILTER_BIAS[edit.filter] || {};
  const out = { ...edit };
  ADJUSTMENTS.forEach(([key]) => {
    out[key] = (edit[key] || 0) + (bias[key] || 0);
  });
  return out;
}

function applyColor(canvas, edit, options = {}) {
  const e = mergeEdit(edit);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const exposure = Math.pow(2, e.exposure / 50);
  const contrast = 1 + e.contrast / 100;
  const brightness = e.brightness * 1.4;
  const black = e.black * 0.7;
  const lum = e.luminance / 100;
  const highlights = e.highlights / 100;
  const shadows = e.shadows / 100;
  const sat = 1 + e.saturation / 100;
  const vib = e.vibrance / 100;
  const warm = e.warmth * 0.55;
  const tint = e.tint * 0.4;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * exposure + brightness;
    let g = data[i + 1] * exposure + brightness;
    let b = data[i + 2] * exposure + brightness;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const hi = clamp01((y - 140) / 115);
    const sh = clamp01((115 - y) / 115);
    const mid = 1 - Math.abs(y - 128) / 128;
    r += highlights * hi * 70 + shadows * sh * 70 + lum * mid * 36;
    g += highlights * hi * 70 + shadows * sh * 70 + lum * mid * 36;
    b += highlights * hi * 70 + shadows * sh * 70 + lum * mid * 36;
    r = (r - 128) * contrast + 128 - black;
    g = (g - 128) * contrast + 128 - black;
    b = (b - 128) * contrast + 128 - black;
    r += warm;
    g += tint;
    b -= warm;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const satMix = sat + vib * (1 - clamp01(Math.max(r, g, b) - Math.min(r, g, b)) / 80);
    r = gray + (r - gray) * satMix;
    g = gray + (g - gray) * satMix;
    b = gray + (b - gray) * satMix;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  ctx.putImageData(image, 0, 0);
  if (e.sharpness || e.clarity || e.noise) applyLocal(canvas, e);
  if (!options.skipVignette && e.vignette) applyVignette(canvas, e.vignette);
  return canvas;
}

function applyLocal(canvas, edit) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const orig = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const sharpBlur = (edit.sharpness || edit.noise) ? blurCanvas(canvas, edit.noise > 40 ? 1.6 : 0.9) : null;
  const clearBlur = edit.clarity ? blurCanvas(canvas, 6) : null;
  const data = orig.data;
  const s = sharpBlur ? sharpBlur.data : null;
  const c = clearBlur ? clearBlur.data : null;
  const sharp = edit.sharpness / 70;
  const clear = edit.clarity / 90;
  const denoise = edit.noise / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (s && denoise) {
      r = r * (1 - denoise) + s[i] * denoise;
      g = g * (1 - denoise) + s[i + 1] * denoise;
      b = b * (1 - denoise) + s[i + 2] * denoise;
    }
    if (s && sharp) {
      r += (r - s[i]) * sharp;
      g += (g - s[i + 1]) * sharp;
      b += (b - s[i + 2]) * sharp;
    }
    if (c && clear) {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const mid = 1 - Math.abs(y - 128) / 128;
      r += (r - c[i]) * clear * mid;
      g += (g - c[i + 1]) * clear * mid;
      b += (b - c[i + 2]) * clear * mid;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  ctx.putImageData(orig, 0, 0);
}

function blurCanvas(source, radius) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  ctx.filter = `blur(${Math.max(0.4, radius)}px)`;
  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function applyVignette(canvas, amount) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const cx = (canvas.width - 1) / 2;
  const cy = (canvas.height - 1) / 2;
  const maxd = Math.sqrt(cx * cx + cy * cy) || 1;
  const strength = amount / 100;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const t = Math.pow(Math.hypot(x - cx, y - cy) / maxd, 1.6);
      const m = 1 - strength * t;
      data[i] *= m;
      data[i + 1] *= m;
      data[i + 2] *= m;
    }
  }
  ctx.putImageData(image, 0, 0);
}

async function decodeFile(file, kind) {
  if (kind === "tiff") return decodeTiff(file);
  if (kind === "heic" || kind === "heif") return decodeHeic(file);
  if (kind === "svgz") return decodeSvg(await gunzipFile(file));
  if (kind === "svg") return decodeSvg(file);
  try {
    return await bitmapFromBlob(file);
  } catch (error) {
    if (kind === "bmp") return decodeBmp(file);
    throw error;
  }
}

async function bitmapFromBlob(blob) {
  try {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch (error) {
      if (error && error.name === "InvalidStateError") throw error;
      return await createImageBitmap(blob);
    }
  } catch (firstError) {
    try {
      return await bitmapViaImage(blob);
    } catch {
      throw firstError instanceof Error ? firstError : new Error("이미지를 열 수 없습니다.");
    }
  }
}

function bitmapViaImage(blob) {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1024;
      canvas.height = img.naturalHeight || 1024;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 열 수 없습니다."));
    };
    img.src = url;
  });
}

async function decodeTiff(file) {
  if (typeof UTIF === "undefined") throw new Error("TIFF 변환 기능을 불러오지 못했습니다.");
  const buffer = await file.arrayBuffer();
  const pages = UTIF.decode(buffer);
  if (!pages.length) throw new Error("TIFF를 읽지 못했습니다.");
  UTIF.decodeImage(buffer, pages[0]);
  const rgba = UTIF.toRGBA8(pages[0]);
  const width = pages[0].width;
  const height = pages[0].height;
  if (!width || !height || rgba.length < width * height * 4) throw new Error("TIFF를 읽지 못했습니다.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  return applyOrientation(canvas, pages[0].t274 ? pages[0].t274[0] : 1);
}

async function decodeHeic(file) {
  await ensureHeic();
  const result = await heic2any({ blob: file, toType: "image/png" });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!blob) throw new Error("HEIC를 읽지 못했습니다.");
  return bitmapFromBlob(blob);
}

function ensureHeic() {
  if (typeof heic2any === "function") return Promise.resolve();
  if (!heicPromise) {
    heicPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "vendor/heic2any.min.js";
      script.onload = () => (typeof heic2any === "function" ? resolve() : reject(new Error("HEIC 변환 기능을 불러오지 못했습니다.")));
      script.onerror = () => reject(new Error("HEIC 변환 기능을 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
  }
  return heicPromise;
}

async function gunzipFile(file) {
  if (typeof DecompressionStream !== "function") throw new Error("이 브라우저는 SVGZ를 풀 수 없습니다.");
  const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
  return new File([await new Response(stream).arrayBuffer()], "image.svg", { type: "image/svg+xml" });
}

async function decodeSvg(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("SVG를 읽지 못했습니다.");
  const svg = doc.documentElement;
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  let width = plainLength(svg.getAttribute("width"));
  let height = plainLength(svg.getAttribute("height"));
  const viewBox = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if ((!(width > 0) || !(height > 0)) && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    width = width > 0 ? width : viewBox[2];
    height = height > 0 ? height : viewBox[3];
  }
  width = Math.max(1, Math.round(width || 1024));
  height = Math.max(1, Math.round(height || 1024));
  const scale = Math.min(1, 4096 / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  return bitmapFromBlob(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
}

async function decodeBmp(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const isBmp = bytes[0] === 0x42 && bytes[1] === 0x4d;
  const dibOffset = isBmp ? 14 : 0;
  if (buffer.byteLength < dibOffset + 16) throw new Error("BMP를 읽지 못했습니다.");
  const headerSize = view.getUint32(dibOffset, true);
  const width = view.getInt32(dibOffset + 4, true);
  const heightRaw = view.getInt32(dibOffset + 8, true);
  const height = Math.abs(heightRaw);
  const bitCount = view.getUint16(dibOffset + 14, true);
  const compression = headerSize >= 20 ? view.getUint32(dibOffset + 16, true) : 0;
  const pixelOffset = isBmp ? view.getUint32(10, true) : headerSize;
  if (!width || !height || compression !== 0 || (bitCount !== 24 && bitCount !== 32)) {
    throw new Error("이 BMP는 압축되어 있어 열 수 없습니다.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const image = canvas.getContext("2d").createImageData(width, height);
  const rowSize = Math.ceil((bitCount * width) / 32) * 4;
  for (let y = 0; y < height; y += 1) {
    const srcY = heightRaw > 0 ? height - 1 - y : y;
    const row = pixelOffset + srcY * rowSize;
    for (let x = 0; x < width; x += 1) {
      const src = row + x * (bitCount / 8);
      const dst = (y * width + x) * 4;
      image.data[dst] = bytes[src + 2] || 0;
      image.data[dst + 1] = bytes[src + 1] || 0;
      image.data[dst + 2] = bytes[src] || 0;
      image.data[dst + 3] = bitCount === 32 ? (bytes[src + 3] ?? 255) : 255;
    }
  }
  canvas.getContext("2d").putImageData(image, 0, 0);
  return canvas;
}

function applyOrientation(source, orientation) {
  if (!orientation || orientation === 1) return source;
  const width = source.width;
  const height = source.height;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (orientation > 4 && orientation < 9) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, height, width); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
    default: break;
  }
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function shrinkCanvas(source, percent) {
  const scale = clamp(Number(percent) || 100, 20, 100) / 100;
  if (scale >= 0.999) return source;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function encodeQuality(edit) {
  return clamp((edit?.quality ?? 92) / 100, 0.2, 1);
}

async function encodeCanvas(canvas, kind, originalName, edit = {}) {
  const quality = encodeQuality(edit);
  if (edit.compact) {
    return { blob: await canvasToBlob(canvas, "image/jpeg", quality), ext: "jpg" };
  }
  if (kind === "jpeg" || kind === "heic" || kind === "heif") {
    return { blob: await canvasToBlob(canvas, "image/jpeg", quality), ext: jpegExt(originalName) };
  }
  if (kind === "png" || kind === "gif" || kind === "svg" || kind === "svgz" || kind === "cur") {
    return { blob: await canvasToBlob(canvas, "image/png"), ext: "png" };
  }
  if (kind === "webp") {
    if (await canEncode("image/webp")) return { blob: await canvasToBlob(canvas, "image/webp", quality), ext: "webp" };
    return { blob: await canvasToBlob(canvas, "image/png"), ext: "png" };
  }
  if (kind === "avif") {
    if (await canEncode("image/avif")) return { blob: await canvasToBlob(canvas, "image/avif", Math.max(0.2, quality * 0.9)), ext: "avif" };
    return { blob: await canvasToBlob(canvas, "image/png"), ext: "png" };
  }
  if (kind === "bmp") return { blob: encodeBmp(canvas), ext: "bmp" };
  if (kind === "tiff") return { blob: encodeTiff(canvas), ext: tiffExt(originalName) };
  if (kind === "ico") {
    if (canvas.width <= 256 && canvas.height <= 256) return { blob: await encodeIco(canvas), ext: "ico" };
    return { blob: await canvasToBlob(canvas, "image/png"), ext: "png" };
  }
  return { blob: await canvasToBlob(canvas, "image/png"), ext: "png" };
}

function jpegExt(name) { return extension(name) === "jpeg" ? "jpeg" : "jpg"; }
function tiffExt(name) { return extension(name) === "tif" ? "tif" : "tiff"; }

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("결과 파일을 만들지 못했습니다.")), type, quality);
  });
}

async function canEncode(type) {
  if (encodeSupport.has(type)) return encodeSupport.get(type);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type));
  const ok = Boolean(blob && blob.type === type);
  encodeSupport.set(type, ok);
  return ok;
}

function encodeBmp(canvas) {
  const { width, height } = canvas;
  const image = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const buffer = new ArrayBuffer(54 + pixelSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, 54 + pixelSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  let offset = 54;
  for (let y = height - 1; y >= 0; y -= 1) {
    let row = offset;
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      bytes[row++] = image[index + 2];
      bytes[row++] = image[index + 1];
      bytes[row++] = image[index];
    }
    offset += rowSize;
  }
  return new Blob([buffer], { type: "image/bmp" });
}

function encodeTiff(canvas) {
  if (typeof UTIF === "undefined" || typeof UTIF.encodeImage !== "function") {
    throw new Error("TIFF 저장 기능을 불러오지 못했습니다.");
  }
  const image = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  return new Blob([UTIF.encodeImage(new Uint8Array(image), canvas.width, canvas.height)], { type: "image/tiff" });
}

async function encodeIco(canvas) {
  const png = await canvasToBlob(canvas, "image/png");
  const pngBytes = new Uint8Array(await png.arrayBuffer());
  const header = new ArrayBuffer(22);
  const view = new DataView(header);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  view.setUint8(6, canvas.width >= 256 ? 0 : canvas.width);
  view.setUint8(7, canvas.height >= 256 ? 0 : canvas.height);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, 22, true);
  return new Blob([header, pngBytes], { type: "image/x-icon" });
}

function buildName(original, width, height, ext) {
  const bare = original.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_").trim() || "image";
  return `${bare}_사이즈조정_${width}x${height}.${ext}`;
}

function zipFilename() {
  const ratio = currentRatio();
  return `사이즈조정_이미지_${ratio ? ratio.label : "custom"}.zip`;
}

async function downloadAll() {
  if (batchBtn.disabled) return;
  const ready = items.filter((item) => item.status === "done" && item.blob);
  if (!ready.length || ready.length !== items.length) return;
  if (typeof JSZip !== "function") throw new Error("압축 기능을 불러오지 못했습니다.");
  const label = batchBtn.textContent;
  batchBtn.disabled = true;
  batchBtn.textContent = "압축 중…";
  try {
    const zip = new JSZip();
    const used = new Set();
    ready.forEach((item) => zip.file(uniqueName(used, item.outName), item.blob));
    const blob = await zip.generateAsync({ type: "blob" }, (meta) => {
      batchBtn.textContent = `압축 중 ${Math.round(meta.percent)}%`;
    });
    downloadBlob(blob, zipFilename());
  } finally {
    batchBtn.textContent = label;
    updateBatch();
  }
}

function uniqueName(used, name) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const match = name.match(/^(.*)\.([^.]+)$/);
  const base = match ? match[1] : name;
  const ext = match ? match[2] : "bin";
  let index = 2;
  let next = `${base}_${index}.${ext}`;
  while (used.has(next)) {
    index += 1;
    next = `${base}_${index}.${ext}`;
  }
  used.add(next);
  return next;
}

function asShareFile(item) {
  const type = item.blob.type || "image/png";
  return new File([item.blob], item.outName, { type });
}

function openShare(item, action) {
  shareTarget = item;
  shareName.textContent = item.outName;
  qrPanel.hidden = true;
  qrCopy.textContent = "링크 복사";
  shareSheet.hidden = false;
  if (action) sendItem(item, action);
}

function closeShare() {
  shareSheet.hidden = true;
  qrPanel.hidden = true;
  shareTarget = null;
}

async function sendItem(item, action) {
  if (!item?.blob) return;
  if (action === "qr") {
    showQr(item).catch((error) => showToast(error.message || "QR을 만들지 못했습니다."));
    return;
  }
  const file = asShareFile(item);
  const text = "사진편집기에서 만든 사진입니다.";
  const shared = await tryShare(file, item.outName, text);
  if (shared) {
    closeShare();
    return;
  }
  downloadBlob(item.blob, item.outName);
  if (action === "mail") {
    window.location.href = `mailto:?subject=${encodeURIComponent(item.outName)}&body=${encodeURIComponent(`${text} 방금 저장한 파일을 메일에 첨부해 보내 주세요.`)}`;
  } else if (action === "sms") {
    window.location.href = `sms:?body=${encodeURIComponent(`${text} 저장한 사진을 첨부해 보내 주세요.`)}`;
  } else {
    showToast("이 브라우저에는 앱 공유가 없습니다. 사진을 저장한 뒤 카카오톡에서 보내 주세요.");
  }
}

async function tryShare(file, title, text) {
  if (!navigator.share) return false;
  const payload = { title, text, files: [file] };
  try {
    if (navigator.canShare && !navigator.canShare(payload)) {
      await navigator.share({ title, text });
      return true;
    }
    await navigator.share(payload);
    return true;
  } catch (error) {
    if (error && error.name === "AbortError") return true;
    return false;
  }
}

async function showQr(item) {
  shareSheet.hidden = false;
  qrPanel.hidden = false;
  qrTarget.innerHTML = "";
  qrLink.textContent = "";
  qrLink.href = "#";
  qrLink.dataset.url = "";
  qrStatus.textContent = "다른 기기에서 받을 수 있는 링크를 만드는 중입니다.";
  const url = await uploadTemp(item.blob, item.outName);
  qrStatus.textContent = "QR을 찍으면 사진을 받을 수 있습니다. 링크는 잠시 동안만 유지됩니다.";
  qrLink.href = url;
  qrLink.dataset.url = url;
  qrLink.textContent = url;
  if (typeof QRCode !== "function") throw new Error("QR 기능을 불러오지 못했습니다.");
  new QRCode(qrTarget, { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
}

async function uploadTemp(blob, name) {
  const file = new File([blob], name, { type: blob.type || "image/png" });
  const tmp = new FormData();
  tmp.append("file", file);
  try {
    const res = await fetch("https://tmpfiles.org/api/v1/upload", { method: "POST", body: tmp });
    if (res.ok) {
      const json = await res.json();
      const url = json?.data?.url;
      if (url) return url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    }
  } catch {
    // fall through to the next host
  }
  const cat = new FormData();
  cat.append("reqtype", "fileupload");
  cat.append("fileToUpload", file);
  const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: cat });
  const url = (await res.text()).trim();
  if (!res.ok || !/^https?:\/\//.test(url)) throw new Error("받는 링크를 만들지 못했습니다. 인터넷 연결을 확인해 주세요.");
  return url;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function detectKind(file) {
  const ext = extension(file.name);
  if (EXT_KIND[ext]) return EXT_KIND[ext];
  return MIME_KIND[(file.type || "").toLowerCase()] || null;
}

function extension(name) {
  const match = /\.([^.]+)$/.exec(name || "");
  return match ? match[1].toLowerCase() : "";
}

function plainLength(value) {
  if (!value || /cm|mm|in|pt|pc|em|ex|%/.test(value)) return 0;
  const number = parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function trimNum(value) {
  return String(Math.round(value * 1000) / 1000);
}

function formatBytes(size) {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function closeBitmap(bitmap) {
  if (bitmap && typeof bitmap.close === "function") bitmap.close();
}

function showToast(message) {
  toast.hidden = false;
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 7000);
}

function updateSizeHint(item) {
  if (!sizeHint) return;
  const edit = item?.edit || {};
  const scale = edit.scale ?? 100;
  const quality = edit.quality ?? 92;
  const parts = [];
  if (item?.outW && item?.outH) parts.push(`결과 ${item.outW}×${item.outH}px`);
  else if (item?.srcW && item?.srcH) {
    const w = Math.max(1, Math.round(item.srcW * scale / 100));
    const h = Math.max(1, Math.round(item.srcH * scale / 100));
    parts.push(`예상 ${w}×${h}px`);
  }
  parts.push(`해상도 ${scale}%`, `화질 ${quality}`);
  if (edit.compact) parts.push("JPEG 저장");
  if (item?.blob) parts.push(formatBytes(item.blob.size));
  sizeHint.textContent = parts.join(" · ") || "해상도와 화질을 낮추면 파일 크기가 작아집니다.";
}

const HISTORY_LIMIT = 40;
const HISTORY_DB = "kmou-photo-history";
const HISTORY_STORE = "edits";
let historyUrls = [];

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbWait(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("history"));
  });
}

function openHistoryDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("no-idb"));
      return;
    }
    const req = indexedDB.open(HISTORY_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("itemId", "itemId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function snapshotSettings() {
  const button = document.querySelector(".ratio.is-selected");
  const custom = button?.dataset.custom === "true";
  return {
    mode: currentMode(),
    fill: currentFill(),
    color: currentBackground(),
    ratioCustom: custom,
    ratioW: custom ? ratioW.value : button?.dataset.w,
    ratioH: custom ? ratioH.value : button?.dataset.h,
    ratioLabel: button?.dataset.label || ""
  };
}

function applySettings(settings) {
  if (!settings) return;
  if (settings.color && /^#[0-9a-fA-F]{6}$/.test(settings.color)) padColor.value = settings.color;
  const modeBtn = document.querySelector(`.mode[data-mode="${settings.mode}"]`);
  if (modeBtn) setPressed(".mode", modeBtn);
  const fillBtn = document.querySelector(`.pad-fill[data-fill="${settings.fill}"]`);
  if (fillBtn) setPressed(".pad-fill", fillBtn);
  let ratioBtn = null;
  if (settings.ratioCustom) {
    ratioBtn = document.querySelector('.ratio[data-custom="true"]');
    if (settings.ratioW) ratioW.value = settings.ratioW;
    if (settings.ratioH) ratioH.value = settings.ratioH;
  } else {
    const buttons = [...document.querySelectorAll(".ratio")];
    ratioBtn = buttons.find((btn) => (
      btn.dataset.w === String(settings.ratioW)
      && btn.dataset.h === String(settings.ratioH)
      && (btn.dataset.label || "") === (settings.ratioLabel || "")
    )) || buttons.find((btn) => (
      btn.dataset.custom !== "true"
      && btn.dataset.w === String(settings.ratioW)
      && btn.dataset.h === String(settings.ratioH)
      && !btn.dataset.label
    )) || buttons.find((btn) => (
      btn.dataset.custom !== "true"
      && btn.dataset.w === String(settings.ratioW)
      && btn.dataset.h === String(settings.ratioH)
    ));
  }
  if (ratioBtn) selectRatio(ratioBtn);
  syncModeUI();
}

async function makeHistoryThumb(item) {
  const src = item.preview || item.source;
  if (!src) return item.blob;
  const canvas = scaleCanvas(src, 160);
  return canvasToBlob(canvas, "image/jpeg", 0.72);
}

async function rememberHistory(item) {
  if (!item?.blob) return;
  const db = await openHistoryDb();
  const thumb = await makeHistoryThumb(item);
  const record = {
    itemId: item.id,
    original: item.file.name,
    originalName: item.file.name,
    originalKind: item.kind,
    originalBlob: item.file,
    outName: item.outName,
    createdAt: Date.now(),
    width: item.outW,
    height: item.outH,
    size: item.blob.size,
    mime: item.blob.type,
    blob: item.blob,
    thumb,
    edit: cloneEdit(item.edit),
    settings: snapshotSettings()
  };
  const readTx = db.transaction(HISTORY_STORE, "readonly");
  const rows = await idbRequest(readTx.objectStore(HISTORY_STORE).getAll());
  const recent = rows.filter((row) => row.itemId === item.id).sort((a, b) => b.createdAt - a.createdAt)[0];
  const writeTx = db.transaction(HISTORY_STORE, "readwrite");
  const store = writeTx.objectStore(HISTORY_STORE);
  if (recent && Date.now() - recent.createdAt < 2500) {
    record.id = recent.id;
    store.put(record);
  } else {
    store.add(record);
  }
  await idbWait(writeTx);
  await trimHistory();
  await renderHistory();
}

async function trimHistory() {
  const db = await openHistoryDb();
  const readTx = db.transaction(HISTORY_STORE, "readonly");
  const rows = (await idbRequest(readTx.objectStore(HISTORY_STORE).getAll())).sort((a, b) => a.createdAt - b.createdAt);
  const extra = rows.length - HISTORY_LIMIT;
  if (extra <= 0) return;
  const writeTx = db.transaction(HISTORY_STORE, "readwrite");
  const store = writeTx.objectStore(HISTORY_STORE);
  for (let i = 0; i < extra; i += 1) store.delete(rows[i].id);
  await idbWait(writeTx);
}

async function loadHistory() {
  const db = await openHistoryDb();
  const tx = db.transaction(HISTORY_STORE, "readonly");
  const rows = await idbRequest(tx.objectStore(HISTORY_STORE).getAll());
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

function revokeHistoryUrls() {
  historyUrls.forEach((url) => URL.revokeObjectURL(url));
  historyUrls = [];
}

function formatHistoryWhen(stamp) {
  const date = new Date(stamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function renderHistory() {
  if (!historyList) return;
  let rows = [];
  try {
    rows = await loadHistory();
  } catch {
    rows = [];
  }
  revokeHistoryUrls();
  historyList.innerHTML = "";
  historyEmpty.hidden = rows.length > 0;
  historyList.hidden = rows.length === 0;
  rows.forEach((row) => {
    const li = document.createElement("li");
    li.className = "history-item";
    const img = document.createElement("img");
    img.alt = `${row.original || "사진"} 기록`;
    const thumbBlob = row.thumb || row.blob;
    if (thumbBlob) {
      const url = URL.createObjectURL(thumbBlob);
      historyUrls.push(url);
      img.src = url;
    }
    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = row.outName || row.original || "수정본";
    const meta = document.createElement("p");
    meta.textContent = [
      formatHistoryWhen(row.createdAt),
      row.width && row.height ? `${row.width}×${row.height}` : "",
      row.size ? formatBytes(row.size) : ""
    ].filter(Boolean).join(" · ");
    body.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "tool-row";
    actions.innerHTML = `
      <button type="button" data-history="restore">다시 열기</button>
      <button type="button" data-history="download">받기</button>
      <button type="button" data-history="delete">삭제</button>`;
    actions.querySelector('[data-history="restore"]').addEventListener("click", () => restoreHistory(row).catch((error) => showToast(error.message || "기록을 열지 못했습니다.")));
    actions.querySelector('[data-history="download"]').addEventListener("click", () => {
      if (row.blob) downloadBlob(row.blob, row.outName || row.original || "photo.jpg");
    });
    actions.querySelector('[data-history="delete"]').addEventListener("click", () => deleteHistory(row.id).catch(() => showToast("기록을 지우지 못했습니다.")));
    li.append(img, body, actions);
    historyList.appendChild(li);
  });
}

async function restoreHistory(row) {
  const sourceBlob = row.originalBlob || row.blob;
  if (!sourceBlob) throw new Error("저장된 사진을 찾지 못했습니다.");
  applySettings(row.settings);
  const file = new File(
    [sourceBlob],
    row.originalName || row.original || row.outName || "history.jpg",
    { type: sourceBlob.type || row.mime || "image/jpeg" }
  );
  const kind = detectKind(file) || row.originalKind || "jpeg";
  const item = createItem(file, kind);
  if (row.edit && row.originalBlob) item.edit = { ...defaultEdit(), ...row.edit };
  items.push(item);
  selectItem(item);
  updateBatch();
  enqueue(() => processItem(item));
  requestAnimationFrame(() => refreshPreview());
}

async function deleteHistory(id) {
  const db = await openHistoryDb();
  const tx = db.transaction(HISTORY_STORE, "readwrite");
  tx.objectStore(HISTORY_STORE).delete(id);
  await idbWait(tx);
  await renderHistory();
}

async function clearHistory() {
  const db = await openHistoryDb();
  const tx = db.transaction(HISTORY_STORE, "readwrite");
  tx.objectStore(HISTORY_STORE).clear();
  await idbWait(tx);
  await renderHistory();
}

document.getElementById("history-clear").addEventListener("click", () => {
  if (!window.confirm("저장된 수정 기록을 모두 지울까요?")) return;
  clearHistory().catch(() => showToast("기록을 지우지 못했습니다."));
});

window.addEventListener("resize", () => refreshPreview());
syncModeUI();
renderHistory().catch(() => {});

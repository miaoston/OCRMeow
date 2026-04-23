import { getHistory, clearHistory, saveHistory, getAsset } from "../utils/db";
import { downloadAndCacheModels, DEFAULT_MODEL_URLS } from "../utils/models";

// ─── Environment ───────────────────────────────────────────────────
const IS_WEB_MODE = !window.chrome || !chrome.runtime || !chrome.runtime.id;

// ─── Modal Dialog ──────────────────────────────────────────────────

/**
 * Show a themed alert modal (replaces native alert()).
 * Returns a Promise that resolves when the user dismisses it.
 */
function showModal(message: string, title: string = "SYSTEM://NOTICE"): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-scanline"></div>
        <div class="modal-header">
          <div class="modal-led"></div>
          <div class="modal-title">${title}</div>
        </div>
        <div class="modal-body">${message}</div>
        <div class="modal-actions">
          <button class="btn btn-confirm" id="modal-ok">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const dismiss = () => {
      overlay.remove();
      resolve();
    };

    overlay.querySelector("#modal-ok")!.addEventListener("click", dismiss);
    overlay.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape" || (e as KeyboardEvent).key === "Enter") dismiss();
    });
    (overlay.querySelector("#modal-ok") as HTMLElement).focus();
  });
}

/**
 * Show a themed confirm modal (replaces native confirm()).
 * Returns a Promise<boolean> — true if confirmed, false if cancelled.
 */
function showConfirm(
  message: string,
  confirmText: string = "CONFIRM",
  cancelText: string = "CANCEL",
  destructive: boolean = false,
  title: string = "SYSTEM://CONFIRM",
): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const confirmClass = destructive ? "btn btn-destructive" : "btn btn-confirm";

    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-scanline"></div>
        <div class="modal-header">
          <div class="modal-led" ${destructive ? 'style="background:var(--red);color:var(--red);"' : ""}></div>
          <div class="modal-title" ${destructive ? 'style="color:var(--red);text-shadow:0 0 8px rgba(255,68,85,0.3);"' : ""}>${title}</div>
        </div>
        <div class="modal-body">${message}</div>
        <div class="modal-actions">
          <button class="btn" id="modal-cancel">${cancelText}</button>
          <button class="${confirmClass}" id="modal-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const done = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector("#modal-confirm")!.addEventListener("click", () => done(true));
    overlay.querySelector("#modal-cancel")!.addEventListener("click", () => done(false));
    overlay.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") done(false);
    });
    (overlay.querySelector("#modal-confirm") as HTMLElement).focus();
  });
}

// ─── Types ─────────────────────────────────────────────────────────

type Settings = {
  language: "auto" | "en" | "zh";
  model: "ppocr_v5";
  themeAction: string;
  themeStudio: string;
  distortionIntensity: string;
  historyLimit: string;
};

const defaultSettings: Settings = {
  language: "auto",
  model: "ppocr_v5",
  themeAction: "cyberpunk",
  themeStudio: "pro_dark",
  distortionIntensity: "0.1",
  historyLimit: "100",
};

let currentSettings = { ...defaultSettings };

// ─── i18n Dictionary ───────────────────────────────────────────────

const i18n = {
  en: {
    "nav-studio": "◉ WORKSPACE",
    "nav-history": "◎ HISTORY",
    "nav-settings": "⚙ SETTINGS",
    "title-workspace": "WORKSPACE",
    "subtitle-workspace": "Drag & Drop images, paste from clipboard (Ctrl+V), or click to upload.",
    "dropzone-text": "CLICK_OR_DRAG_IMAGE",
    "dropzone-sub": "SUPPORTS: PNG / JPG / WebP",
    "title-history": "HISTORY",
    "subtitle-history": "Past OCR results with source images. Click image to zoom.",
    "title-settings": "SETTINGS",
    "subtitle-settings": "Configure your OCRMeow experience.",
    "setting-grp-general": "▸ GENERAL",
    "setting-grp-theme": "▸ APPEARANCE",
    "setting-grp-history": "▸ HISTORY & STORAGE",
    "lbl-lang": "Language",
    "desc-lang": "Interface language (Auto detects browser setting)",
    "lbl-model": "OCR Model",
    "desc-model": "The underlying AI engine for text recognition",
    "lbl-theme-action": "Capture Theme",
    "desc-theme-action": "Visual theme for the OCR capture overlay and Data Pad",
    "lbl-theme-studio": "Studio Theme",
    "desc-theme-studio": "Theme for this dashboard interface",
    "lbl-distortion": "Distortion Intensity",
    "desc-distortion": "Strength of the liquid distortion effect during OCR. Set to 0 to disable.",
    "lbl-history-limit": "History Limit",
    "desc-history-limit": "Maximum number of recent OCR results to keep (10 – 9999).",
    "desc-export-location": "Export downloads a JSON file with text results and source images.",
    "lbl-export-history": "EXPORT_HISTORY",
    "lbl-clear-history": "CLEAR_ALL",
    "loading-text": "⚡ OCR_ENGINE::PROCESSING...",
    "copy-success": "✓ COPIED",
    "empty-history": "NO_RECORDS_FOUND",
    "setting-grp-models": "▸ MODEL MANAGEMENT",
    "lbl-model-status": "Local Models Status",
    "desc-model-status":
      "AI Models are not bundled to save space. They must be downloaded to your local database once.",
    "lbl-url-det": "Detection Model URL (det.tar)",
    "desc-url-det": "Advanced: Override the default download source.",
    "lbl-url-rec": "Recognition Model URL (rec.tar)",
    "desc-url-rec": "Advanced: Override the default download source.",
  },
  zh: {
    "nav-studio": "◉ 工作区",
    "nav-history": "◎ 历史",
    "nav-settings": "⚙ 设置",
    "title-workspace": "工作区",
    "subtitle-workspace": "拖拽图片到此处，或按 Ctrl+V / Cmd+V 粘贴剪贴板图片。",
    "dropzone-text": "点击或拖拽图片到这里",
    "dropzone-sub": "支持 PNG / JPG / WebP",
    "title-history": "历史记录",
    "subtitle-history": "过往 OCR 识别结果及源图片。点击图片可放大。",
    "title-settings": "设置",
    "subtitle-settings": "配置您的 OCRMeow 体验。",
    "setting-grp-general": "▸ 通用",
    "setting-grp-theme": "▸ 外观",
    "setting-grp-history": "▸ 历史与存储",
    "lbl-lang": "显示语言",
    "desc-lang": "界面语言（自动跟随浏览器）",
    "lbl-model": "OCR 模型",
    "desc-model": "底层文字识别 AI 引擎",
    "lbl-theme-action": "识别主题",
    "desc-theme-action": "截图识别时覆盖层和数据面板的视觉主题",
    "lbl-theme-studio": "控制台主题",
    "desc-theme-studio": "当前控制台界面的主题风格",
    "lbl-distortion": "喵力扭曲强度",
    "desc-distortion": "识别等待时液态扭曲特效的强度。设为0可关闭。",
    "lbl-history-limit": "历史记录上限",
    "desc-history-limit": "保存的最近识别结果数量上限（10 – 9999）。",
    "desc-export-location": "导出时会自动下载包含文本和源图片的 JSON 文件。",
    "lbl-export-history": "导出历史",
    "lbl-clear-history": "清空记录",
    "loading-text": "⚡ 喵力加载中，正在识别...",
    "copy-success": "✓ 复制成功",
    "empty-history": "暂无记录",
    "setting-grp-models": "▸ AI 模型管理",
    "lbl-model-status": "本地模型状态",
    "desc-model-status": "为缩减插件体积，大模型不再打包进插件中。您需要首次运行并在本地缓存它们。",
    "lbl-url-det": "检测模型下载地址 (det.tar)",
    "desc-url-det": "高阶：您可以覆盖默认的官方下载源。",
    "lbl-url-rec": "识别模型下载地址 (rec.tar)",
    "desc-url-rec": "高阶：您可以覆盖默认的官方下载源。",
    "btn-download-models": "初始化模型",
  },
};

// ─── Initialize ────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Web-Mode adaptation
  if (IS_WEB_MODE) {
    console.log("OCRMeow Studio: Web Mode detected. Disabling extension-only features.");
    const disabledIds = [
      "setting-theme-action",
      "setting-distortion",
      "btn-export-history",
      "btn-clear-history",
    ];
    disabledIds.forEach((id) => {
      const el = document.getElementById(id) as
        | HTMLSelectElement
        | HTMLInputElement
        | HTMLButtonElement;
      if (el) {
        el.disabled = true;
        el.style.opacity = "0.4";
        el.style.cursor = "not-allowed";
        el.title = "This feature is only available in the Chrome Extension.";
      }
    });

    const labelIds = [
      "lbl-theme-action",
      "lbl-distortion",
      "lbl-export-history",
      "lbl-clear-history",
    ];
    labelIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent += " [EXTENSION ONLY]";
    });
  }

  await loadSettings();
  applyLanguage();
  setupNavigation();
  setupDropzone();
  setupPaste();
  setupSettingsListeners();
  await loadHistoryView();
});

// ─── Navigation ────────────────────────────────────────────────────

function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const targetId = (e.currentTarget as HTMLElement).getAttribute("data-target");
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      (e.currentTarget as HTMLElement).classList.add("active");
      document.querySelectorAll(".view-section").forEach((sec) => sec.classList.remove("active"));
      document.getElementById(`view-${targetId}`)?.classList.add("active");

      // Refresh history when navigating to it
      if (targetId === "history") {
        loadHistoryView();
      }
    });
  });
}

// ─── Settings ──────────────────────────────────────────────────────

async function saveSettings() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ ocrSettings: currentSettings });
  } else {
    localStorage.setItem("ocrSettings", JSON.stringify(currentSettings));
  }
}

async function loadSettings() {
  let settings: any = null;
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const result = await chrome.storage.local.get("ocrSettings");
    settings = result.ocrSettings;
  } else {
    const local = localStorage.getItem("ocrSettings");
    if (local) settings = JSON.parse(local);
  }

  if (settings) {
    currentSettings = { ...defaultSettings, ...settings };
  }

  (document.getElementById("setting-language") as HTMLSelectElement).value =
    currentSettings.language;
  (document.getElementById("setting-model") as HTMLSelectElement).value = currentSettings.model;
  (document.getElementById("setting-theme-action") as HTMLSelectElement).value =
    currentSettings.themeAction;
  (document.getElementById("setting-theme-studio") as HTMLSelectElement).value =
    currentSettings.themeStudio;

  const distEl = document.getElementById("setting-distortion") as HTMLInputElement;
  if (distEl) {
    distEl.value = currentSettings.distortionIntensity;
    const valEl = document.getElementById("val-distortion");
    if (valEl) valEl.textContent = currentSettings.distortionIntensity;
  }

  const limitEl = document.getElementById("setting-history-limit") as HTMLInputElement;
  if (limitEl) limitEl.value = currentSettings.historyLimit;

  applyStudioTheme(currentSettings.themeStudio);
  applyLanguage();
  checkModelStatus();
}

function setupSettingsListeners() {
  // Select dropdowns
  const selects = document.querySelectorAll("select");
  selects.forEach((select) => {
    select.addEventListener("change", async (e) => {
      const target = e.target as HTMLSelectElement;
      const id = target.id;
      const value = target.value;

      if (id === "setting-language") currentSettings.language = value as Settings["language"];
      if (id === "setting-model") currentSettings.model = value as Settings["model"];
      if (id === "setting-theme-action")
        currentSettings.themeAction = value as Settings["themeAction"];
      if (id === "setting-theme-studio")
        currentSettings.themeStudio = value as Settings["themeStudio"];

      await saveSettings();

      if (id === "setting-language") applyLanguage();
      if (id === "setting-theme-studio") applyStudioTheme(value);
    });
  });

  // Model Download
  document.getElementById("btn-download-models")?.addEventListener("click", downloadModels);

  // Distortion slider
  const distEl = document.getElementById("setting-distortion") as HTMLInputElement;
  if (distEl) {
    distEl.addEventListener("input", async (e) => {
      const value = (e.target as HTMLInputElement).value;
      currentSettings.distortionIntensity = value;
      const valEl = document.getElementById("val-distortion");
      if (valEl) valEl.textContent = value;
      await saveSettings();
    });
  }

  // History limit (number input with debounce)
  const limitEl = document.getElementById("setting-history-limit") as HTMLInputElement;
  if (limitEl) {
    let limitTimer: ReturnType<typeof setTimeout> | null = null;
    limitEl.addEventListener("input", () => {
      if (limitTimer) clearTimeout(limitTimer);
      limitTimer = setTimeout(async () => {
        let val = parseInt(limitEl.value, 10);
        if (isNaN(val) || val < 10) val = 10;
        if (val > 9999) val = 9999;
        limitEl.value = String(val);
        currentSettings.historyLimit = String(val);
        await saveSettings();
      }, 600);
    });
  }

  // Clear history
  document.getElementById("btn-clear-history")?.addEventListener("click", async () => {
    const isZh = getLang() === "zh";
    const confirmed = await showConfirm(
      isZh
        ? "此操作将永久删除所有历史记录，无法恢复。"
        : "This will permanently delete all history records. This cannot be undone.",
      isZh ? "确认清空" : "CLEAR ALL",
      isZh ? "取消" : "CANCEL",
      true,
      isZh ? "⚠ 危险操作" : "⚠ DANGER_ZONE",
    );
    if (confirmed) {
      await clearHistory();
      const wc = document.getElementById("results-container");
      if (wc) wc.innerHTML = "";
      const hc = document.getElementById("history-container");
      if (hc) hc.innerHTML = "";
    }
  });

  // Export history
  document.getElementById("btn-export-history")?.addEventListener("click", async () => {
    const limit = parseInt(currentSettings.historyLimit, 10) || 100;
    const historyItems = await getHistory(limit);
    if (historyItems.length === 0) {
      await showModal(
        getLang() === "zh" ? "暂无历史记录可导出。" : "No history records to export.",
        getLang() === "zh" ? "提示" : "NOTICE",
      );
      return;
    }

    const exportData = historyItems.map((item) => ({
      id: item.id,
      timestamp: item.timestamp,
      timeString: new Date(item.timestamp).toISOString(),
      source: item.source,
      text: item.text,
      image_filename: `ocrmeow_${item.timestamp}.png`,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const exportTs = Date.now();
    await chrome.downloads.download({
      url: url,
      filename: `OCRMeow_History_${exportTs}/history.json`,
      saveAs: false,
    });

    for (const item of historyItems) {
      if (item.image) {
        await chrome.downloads.download({
          url: item.image,
          filename: `OCRMeow_History_${exportTs}/ocrmeow_${item.timestamp}.png`,
          saveAs: false,
        });
      }
    }

    await showModal(
      getLang() === "zh"
        ? "导出已开始，请检查浏览器下载管理器。"
        : "Export started. Check your browser downloads.",
      getLang() === "zh" ? "✓ 导出成功" : "✓ EXPORT_COMPLETE",
    );
  });
}

// ─── Language ──────────────────────────────────────────────────────

function applyLanguage() {
  let lang = currentSettings.language;
  if (lang === "auto") {
    lang = navigator.language.startsWith("zh") ? "zh" : "en";
  }
  const dict = i18n[lang as "en" | "zh"];
  Object.keys(dict).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = dict[id as keyof typeof dict];
  });
}

function getLang(): "en" | "zh" {
  if (currentSettings.language !== "auto") return currentSettings.language;
  const sysLang =
    typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n.getUILanguage() : navigator.language;
  return sysLang.startsWith("zh") ? "zh" : "en";
}

/**
 * Apply studio theme by swapping CSS custom properties on :root.
 */
function applyStudioTheme(theme: string) {
  const root = document.documentElement;

  const themes: Record<string, Record<string, string>> = {
    pro_dark: {
      "--bg": "#08090c",
      "--bg-surface": "#0c0d11",
      "--bg-elevated": "#101218",
      "--cyan": "#00f3ff",
      "--cyan-dim": "rgba(0, 243, 255, 0.15)",
      "--cyan-ghost": "rgba(0, 243, 255, 0.06)",
      "--border": "rgba(0, 243, 255, 0.1)",
      "--border-bright": "rgba(0, 243, 255, 0.3)",
    },
    midnight: {
      "--bg": "#080c14",
      "--bg-surface": "#0c1220",
      "--bg-elevated": "#10182c",
      "--cyan": "#5b9cf5",
      "--cyan-dim": "rgba(91, 156, 245, 0.15)",
      "--cyan-ghost": "rgba(91, 156, 245, 0.06)",
      "--border": "rgba(91, 156, 245, 0.12)",
      "--border-bright": "rgba(91, 156, 245, 0.3)",
    },
    hacker: {
      "--bg": "#060c06",
      "--bg-surface": "#0a120a",
      "--bg-elevated": "#0e180e",
      "--cyan": "#00ff41",
      "--cyan-dim": "rgba(0, 255, 65, 0.15)",
      "--cyan-ghost": "rgba(0, 255, 65, 0.06)",
      "--border": "rgba(0, 255, 65, 0.12)",
      "--border-bright": "rgba(0, 255, 65, 0.3)",
    },
  };

  const vars = themes[theme] ?? themes.pro_dark;
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

// ─── File Handling ─────────────────────────────────────────────────

function setupDropzone() {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e: any) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
    fileInput.value = "";
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("image/")) handleImageFile(file);
  });
}

function setupPaste() {
  window.addEventListener("paste", (e) => {
    const activeSection = document.querySelector(".view-section.active")?.id;
    if (activeSection !== "view-studio") return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageFile(file);
          break;
        }
      }
    }
  });
}

function handleImageFile(file: File) {
  const reader = new FileReader();
  reader.onload = async (event) => {
    const base64 = event.target?.result as string;
    await processOCR(base64, file.name || "Pasted Image");
  };
  reader.readAsDataURL(file);
}

// ─── OCR Processing ────────────────────────────────────────────────

async function processOCR(base64Image: string, sourceName: string) {
  const loadingEl = document.getElementById("loading-indicator");
  if (!loadingEl) return;

  loadingEl.style.display = "block";
  const startTime = performance.now();

  // Use the adaptive proxy defined earlier
  performOCR(base64Image)
    .then(async (items) => {
      const elapsed = Math.round(performance.now() - startTime);
      loadingEl.style.display = "none";

      let fullText = "";
      if (items && items.length > 0) {
        fullText = items.map((it: any) => it.text).join("\n");
      } else {
        fullText = getLang() === "zh" ? "未发现文字..." : "No text found...";
      }

      addResultCard(fullText, sourceName, new Date().toLocaleTimeString(), base64Image, elapsed);

      // Save to DB
      if (fullText && fullText !== "未发现文字..." && fullText !== "No text found...") {
        const limit = parseInt(currentSettings.historyLimit, 10) || 100;
        await saveHistory(fullText, base64Image, sourceName, limit);
      }
    })
    .catch((err: any) => {
      loadingEl.style.display = "none";
      addResultCard(`Error: ${err.message}`, sourceName, "", "", 0);
      console.error("OCR Studio: Recognition fatal error", err);
    });
}

// ─── Result Card (Workspace) ───────────────────────────────────────

function addResultCard(
  text: string,
  title: string,
  timeStr: string,
  imageBase64: string,
  elapsedMs: number,
) {
  const container = document.getElementById("results-container");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "result-card";

  // Header
  const header = document.createElement("div");
  header.className = "result-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "result-header-left";
  headerLeft.innerHTML = `<span>📄 ${title}</span>`;
  if (timeStr) {
    headerLeft.innerHTML += `<span style="color:var(--text-dim);">[${timeStr}]</span>`;
  }
  if (elapsedMs > 0) {
    headerLeft.innerHTML += `<span class="result-timing">${elapsedMs}ms</span>`;
  }

  const headerActions = document.createElement("div");
  headerActions.className = "result-header-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn-primary";
  copyBtn.textContent = "COPY";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(textArea.textContent || "");
    const orig = copyBtn.textContent;
    copyBtn.textContent = i18n[getLang()]["copy-success"];
    setTimeout(() => (copyBtn.textContent = orig), 2000);
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "✕";
  deleteBtn.style.padding = "6px 10px";
  deleteBtn.onclick = () => card.remove();

  headerActions.appendChild(copyBtn);
  headerActions.appendChild(deleteBtn);
  header.appendChild(headerLeft);
  header.appendChild(headerActions);
  card.appendChild(header);

  // Image thumbnail
  if (imageBase64) {
    const imgContainer = document.createElement("div");
    imgContainer.className = "result-image-container";
    const img = document.createElement("img");
    img.className = "result-image";
    img.src = imageBase64;
    img.alt = "OCR Source";
    img.onclick = () => openLightbox(imageBase64);
    imgContainer.appendChild(img);
    card.appendChild(imgContainer);
  }

  // Text content
  const textArea = document.createElement("div");
  textArea.className = "result-text";
  textArea.textContent = text;
  textArea.contentEditable = "true";
  card.appendChild(textArea);

  container.prepend(card);
}

// ─── History View ──────────────────────────────────────────────────

async function loadHistoryView() {
  const container = document.getElementById("history-container");
  if (!container) return;

  container.innerHTML = "";

  const limit = parseInt(currentSettings.historyLimit, 10) || 100;
  const historyItems = await getHistory(limit);

  if (historyItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = i18n[getLang()]["empty-history"];
    container.appendChild(empty);
    return;
  }

  for (const item of historyItems) {
    const card = document.createElement("div");
    card.className = "result-card";

    // Header
    const header = document.createElement("div");
    header.className = "result-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "result-header-left";
    const timeStr = new Date(item.timestamp).toLocaleString();
    headerLeft.innerHTML = `<span>📄 ${item.source}</span><span style="color:var(--text-dim);">[${timeStr}]</span>`;

    const headerActions = document.createElement("div");
    headerActions.className = "result-header-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-primary";
    copyBtn.textContent = "COPY";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(item.text);
      copyBtn.textContent = i18n[getLang()]["copy-success"];
      setTimeout(() => (copyBtn.textContent = "COPY"), 2000);
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "✕";
    deleteBtn.style.padding = "6px 10px";
    deleteBtn.onclick = () => card.remove();

    headerActions.appendChild(copyBtn);
    headerActions.appendChild(deleteBtn);
    header.appendChild(headerLeft);
    header.appendChild(headerActions);
    card.appendChild(header);

    // Image
    if (item.image) {
      const imgContainer = document.createElement("div");
      imgContainer.className = "result-image-container";
      const img = document.createElement("img");
      img.className = "result-image";
      img.src = item.image;
      img.alt = "OCR Source";
      img.loading = "lazy";
      img.onclick = () => openLightbox(item.image);
      imgContainer.appendChild(img);
      card.appendChild(imgContainer);
    }

    // Text
    const textEl = document.createElement("div");
    textEl.className = "result-text";
    textEl.textContent = item.text;
    card.appendChild(textEl);

    container.appendChild(card);
  }
}

// ─── Lightbox ──────────────────────────────────────────────────────

function openLightbox(imageSrc: string) {
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.onclick = () => overlay.remove();

  const img = document.createElement("img");
  img.src = imageSrc;

  overlay.appendChild(img);
  document.body.appendChild(overlay);

  // ESC to close
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      overlay.remove();
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);
}

/**
 * Perform OCR on a dataUrl, automatically choosing the best path (Extension msg vs Web local).
 */
async function performOCR(dataUrl: string): Promise<any[]> {
  if (!IS_WEB_MODE) {
    // EXTENSION PATH
    const response = await chrome.runtime.sendMessage({
      action: "OCR_REQUEST",
      payload: { image: dataUrl },
    });
    if (response && response.error) throw new Error(response.error);
    return response.items || [];
  } else {
    // WEB PATH — Redirect to sandbox.html or directly handle via imported engine logic
    // For simplicity in the demo, we'll try to use the same message protocol if possible,
    // but on web, we must use the hidden iframe we have in index.html (if we add it).
    // BETTER: Let's assume on web, the user must download models first.
    return new Promise((resolve, reject) => {
      const sandbox = document.getElementById("ocr-sandbox") as HTMLIFrameElement;
      if (!sandbox) {
        reject(new Error("OCR Sandbox not initialized. Please refresh."));
        return;
      }

      const requestId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        if (event.data.action === "OCR_RESULT" && event.data.requestId === requestId) {
          window.removeEventListener("message", listener);
          clearTimeout(timeout);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve(event.data.payload?.items || event.data.payload || []);
        }
      };

      // Safety timeout: 60s
      const timeout = setTimeout(() => {
        window.removeEventListener("message", listener);
        reject(new Error("OCR_ENGINE_TIMEOUT"));
      }, 60000);

      window.addEventListener("message", listener);
      sandbox.contentWindow?.postMessage(
        {
          action: "RUN_OCR",
          requestId,
          payload: { image: dataUrl },
        },
        "*",
      );
    });
  }
}

// ─── Theme Management ──────────────────────────────────────────────

async function checkModelStatus() {
  const detBlob = await getAsset("det.tar");
  const recBlob = await getAsset("rec.tar");
  const isZh = getLang() === "zh";

  const statusDet = document.getElementById("status-det");
  const statusRec = document.getElementById("status-rec");
  const storagePath = document.getElementById("storage-path");
  const btn = document.getElementById("btn-download-models") as HTMLButtonElement;

  const updateStatus = (el: HTMLElement | null, ready: boolean) => {
    if (!el) return;
    if (ready) {
      el.textContent = isZh ? "已就绪 READY" : "READY";
      el.style.color = "var(--green)";
      el.style.textShadow = "0 0 8px rgba(0, 255, 136, 0.4)";
    } else {
      el.textContent = isZh ? "缺失 MISSING" : "MISSING";
      el.style.color = "var(--red)";
      el.style.textShadow = "0 0 8px rgba(255, 68, 85, 0.4)";
    }
  };

  updateStatus(statusDet, !!detBlob);
  updateStatus(statusRec, !!recBlob);

  if (storagePath) {
    // If both ready, show as LOCAL_DB, if mixed show as PENDING
    if (detBlob && recBlob) {
      storagePath.textContent = isZh ? "内部数据库 (IndexedDB)" : "INTERNAL_DB (IDB)";
      storagePath.style.color = "var(--cyan)";

      // Initialize Web Mode Sandbox if applicable
      if (IS_WEB_MODE) {
        const sandbox = document.getElementById("ocr-sandbox") as HTMLIFrameElement;
        if (sandbox) {
          const sendInit = () => {
            sandbox.contentWindow?.postMessage(
              {
                action: "INIT_CONFIG",
                payload: {
                  detBlob,
                  recBlob,
                  wasmPath: "wasm/", // Use simple relative path
                },
              },
              "*",
            );
          };

          if (sandbox.contentWindow && sandbox.contentDocument?.readyState === "complete") {
            sendInit();
          } else {
            sandbox.onload = sendInit;
          }
        }
      }
    } else {
      storagePath.textContent = isZh ? "未就绪 (PENDING)" : "PENDING_INIT";
      storagePath.style.color = "var(--text-dim)";
    }
  }

  if (btn) {
    if (detBlob && recBlob) {
      btn.textContent = isZh ? "重新初始化 (RE-INIT)" : "RE-INITIALIZE";
      btn.style.opacity = "0.7";
    } else {
      btn.textContent = isZh ? "立即部署 (DEPLOY)" : "DEPLOY_MODELS";
      btn.style.opacity = "1";
    }
  }
}

async function downloadModels() {
  const isZh = getLang() === "zh";
  const confirmed = await showConfirm(
    isZh
      ? "即将下载 AI 模型文件 (约 22MB)，请确保网络连接畅通。确认下载？"
      : "About to download AI models (~22MB). Ensure stable network. Continue?",
    isZh ? "开始下载" : "DOWNLOAD",
    isZh ? "取消" : "CANCEL",
  );

  if (!confirmed) return;

  const btn = document.getElementById("btn-download-models") as HTMLButtonElement;
  const progressDiv = document.getElementById("model-download-progress");
  const progressText = document.getElementById("model-progress-text");
  const progressPct = document.getElementById("model-progress-pct");
  const progressBar = document.getElementById("model-progress-bar");

  const detInput = document.getElementById("setting-url-det") as HTMLInputElement;
  const recInput = document.getElementById("setting-url-rec") as HTMLInputElement;

  const detUrl = detInput?.value.trim() || DEFAULT_MODEL_URLS.det;
  const recUrl = recInput?.value.trim() || DEFAULT_MODEL_URLS.rec;

  if (btn) btn.disabled = true;
  if (progressDiv) progressDiv.style.display = "block";

  const updateProgress = (phase: string, pct: number) => {
    if (progressText) progressText.textContent = phase;
    if (progressPct) progressPct.textContent = `${pct}%`;
    if (progressBar) progressBar.style.width = `${pct}%`;
  };

  Promise.resolve()
    .then(async () => {
      await downloadAndCacheModels({ det: detUrl, rec: recUrl }, (phase, pct) => {
        const isZh = getLang() === "zh";
        // Translate phase names for UI
        let displayPhase = phase;
        if (isZh) {
          if (phase.includes("Detection")) displayPhase = "下载检测模型 (det.tar)...";
          else if (phase.includes("Recognition")) displayPhase = "下载识别模型 (rec.tar)...";
          else if (phase.includes("Done")) displayPhase = "下载完成!";
        }
        updateProgress(displayPhase, pct);
      });

      await showModal(
        isZh
          ? "模型已成功下载并缓存至本地数据库！您现在可以离线使用划词识别了。"
          : "Models successfully cached! You can now use OCR offline.",
        isZh ? "✓ 下载完成" : "✓ DOWNLOAD_COMPLETE",
      );
    })
    .catch(async (err: any) => {
      console.error("Model download error:", err);
      await showModal(
        `${isZh ? "下载失败：" : "Download failed: "} ${err.message}\n\n${isZh ? "请检查自定义的下载链接是否正确，或检查网络环境后重试。" : "Please check your network or custom URLs and try again."}`,
        "❌ ERROR",
      );
    })
    .finally(() => {
      if (btn) btn.disabled = false;
      setTimeout(() => {
        if (progressDiv) progressDiv.style.display = "none";
        checkModelStatus();
      }, 1500);
    });
}

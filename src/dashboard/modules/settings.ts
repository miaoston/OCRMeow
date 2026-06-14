// ─── Settings Module ───────────────────────────────────────────────
// Owns the Settings type, defaults, mutable state, persistence, and
// all settings-panel event bindings.

import { getHistory, clearHistory, saveAsset } from "../../utils/db";
import { IS_WEB_MODE } from "../../utils/compat";
import JSZip from "jszip";

// Re-export from here so other modules can import `currentSettings` cheaply.
export type Settings = {
  language: "auto" | "en" | "zh";
  model: "ppocr_v5";
  themeAction: string;
  themeStudio: string;
  distortionIntensity: string;
  historyLimit: string;
};

export const defaultSettings: Settings = {
  language: "auto",
  model: "ppocr_v5",
  themeAction: "cyberpunk",
  themeStudio: "pro_dark",
  distortionIntensity: "0.1",
  historyLimit: "100",
};

export let currentSettings: Settings = { ...defaultSettings };

// ─── Persistence ───────────────────────────────────────────────────

export async function saveSettings(): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ ocrSettings: currentSettings });
  } else {
    localStorage.setItem("ocrSettings", JSON.stringify(currentSettings));
  }
}

export async function loadSettings(
  applyLanguage: () => void,
  applyStudioTheme: (theme: string) => void,
): Promise<void> {
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
}

// ─── Settings Listeners ────────────────────────────────────────────
// Cross-module callbacks are passed in to avoid circular imports.

export function setupSettingsListeners(deps: {
  applyLanguage: () => void;
  applyStudioTheme: (theme: string) => void;
  getLang: () => "en" | "zh";
  showModal: (message: string, title?: string) => Promise<void>;
  showConfirm: (
    message: string,
    confirmText?: string,
    cancelText?: string,
    destructive?: boolean,
    title?: string,
  ) => Promise<boolean>;
  syncSingleModel: (type: "det" | "rec") => Promise<void>;
  handleSingleModelImport: (files: FileList | null, type: "det" | "rec") => Promise<void>;
  checkModelStatus: () => Promise<void>;
}): void {
  const {
    applyLanguage,
    applyStudioTheme,
    getLang,
    showModal,
    showConfirm,
    syncSingleModel,
    handleSingleModelImport,
    checkModelStatus,
  } = deps;

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

  // Per-model online sync buttons
  document.getElementById("btn-sync-det")?.addEventListener("click", () => syncSingleModel("det"));
  document.getElementById("btn-sync-rec")?.addEventListener("click", () => syncSingleModel("rec"));

  // Per-model local import buttons
  const fileInputDet = document.getElementById("file-input-det") as HTMLInputElement;
  const fileInputRec = document.getElementById("file-input-rec") as HTMLInputElement;

  document.getElementById("btn-import-det")?.addEventListener("click", () => {
    fileInputDet?.click();
  });
  document.getElementById("btn-import-rec")?.addEventListener("click", () => {
    fileInputRec?.click();
  });

  fileInputDet?.addEventListener("change", (e) => {
    handleSingleModelImport((e.target as HTMLInputElement).files, "det");
    if (fileInputDet) fileInputDet.value = "";
  });
  fileInputRec?.addEventListener("change", (e) => {
    handleSingleModelImport((e.target as HTMLInputElement).files, "rec");
    if (fileInputRec) fileInputRec.value = "";
  });

  // Legacy multi-file input for backward-compatible test harness
  const legacyFileInput = document.getElementById("model-file-input") as HTMLInputElement;
  legacyFileInput?.addEventListener("change", async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    const isZh = getLang() === "zh";
    let detImported = false;
    let recImported = false;

    const importPromises = Array.from(files).map((file) => {
      return Promise.resolve().then(async () => {
        if (file.name === "det.tar") {
          await saveAsset("det.tar", file);
          detImported = true;
        } else if (file.name === "rec.tar") {
          await saveAsset("rec.tar", file);
          recImported = true;
        }
      });
    });

    Promise.all(importPromises)
      .then(async () => {
        if (detImported || recImported) {
          await checkModelStatus();
          let msg = "";
          if (detImported && recImported) {
            msg = isZh
              ? "检测模型 (det.tar) 与 识别模型 (rec.tar) 已成功导入本地数据库！"
              : "Detection (det.tar) and Recognition (rec.tar) models imported successfully!";
          } else if (detImported) {
            msg = isZh
              ? "检测模型 (det.tar) 已成功导入本地数据库，请继续导入识别模型。"
              : "Detection model (det.tar) imported. Please import recognition model next.";
          } else {
            msg = isZh
              ? "识别模型 (rec.tar) 已成功导入本地数据库，请继续导入检测模型。"
              : "Recognition model (rec.tar) imported. Please import detection model next.";
          }
          await showModal(msg, isZh ? "✓ 导入成功" : "✓ IMPORT_SUCCESS");
        } else {
          await showModal(
            isZh
              ? "未识别到有效的模型文件。请确保文件名分别为 det.tar 或 rec.tar！"
              : "Invalid model files. Ensure the filenames are det.tar or rec.tar!",
            "❌ ERROR",
          );
        }
      })
      .catch(async (err: any) => {
        console.error("Local model import error:", err);
        await showModal(`${isZh ? "导入失败：" : "Import failed: "} ${err.message}`, "❌ ERROR");
      })
      .finally(() => {
        if (legacyFileInput) legacyFileInput.value = "";
      });
  });

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

    const zip = new JSZip();
    zip.file("history.json", JSON.stringify(exportData, null, 2));

    const imgFolder = zip.folder("images");
    for (const item of historyItems) {
      if (item.image && item.image.startsWith("data:image/")) {
        const base64Data = item.image.split(",")[1];
        imgFolder?.file(`ocrmeow_${item.timestamp}.png`, base64Data, { base64: true });
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const exportTs = Date.now();

    if (IS_WEB_MODE) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `OCRMeow_History_${exportTs}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      await showModal(
        getLang() === "zh"
          ? "历史记录及源图片已打包为 ZIP 压缩包并成功导出。"
          : "History and source images successfully packaged as ZIP and exported.",
        getLang() === "zh" ? "✓ 导出成功" : "✓ EXPORT_COMPLETE",
      );
      return;
    }

    await chrome.downloads.download({
      url: url,
      filename: `OCRMeow_History_${exportTs}.zip`,
      saveAs: false,
    });

    await showModal(
      getLang() === "zh"
        ? "历史记录及源图片已打包为 ZIP 压缩包并开始下载。"
        : "History successfully packaged as ZIP. Download started.",
      getLang() === "zh" ? "✓ 导出成功" : "✓ EXPORT_COMPLETE",
    );
  });
}

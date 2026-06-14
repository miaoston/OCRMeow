// ─── i18n Module ───────────────────────────────────────────────────
// Owns the translation dictionary, language detection, and DOM patching.

import { currentSettings } from "./settings";

export const i18n = {
  en: {
    "nav-studio": "◉ WORKSPACE",
    "nav-history": "◎ HISTORY",
    "nav-settings": "⚙ SETTINGS",
    "title-workspace": "WORKSPACE",
    "subtitle-workspace": "Recognize text locally from images. Results appear below.",
    "dropzone-text": "Click to choose an image, or drop it here",
    "dropzone-sub": "Paste from clipboard also supported · PNG / JPG / WebP",
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
    "lbl-download-det-official": "Official",
    "lbl-download-det-backup": "Backup",
    "lbl-download-rec-official": "Official",
    "lbl-download-rec-backup": "Backup",
    "btn-sync-det": "⚡ Sync",
    "btn-sync-rec": "⚡ Sync",
    "btn-import-det": "📦 Import",
    "btn-import-rec": "📦 Import",
    "wizard-title": "FIRST RUN SETUP",
    "wizard-desc":
      "OCRMeow needs to download the local OCR model before the first recognition. This is a one-time setup and usually takes under a minute.",
    "wizard-point-model-title": "One-time model download",
    "wizard-point-model-desc": "About 22MB will be cached in this browser for future OCR runs.",
    "wizard-point-local-title": "Recognition stays on device",
    "wizard-point-local-desc":
      "OCRMeow protects your privacy: recognition runs locally in your browser and is never uploaded to the cloud.",
    "wizard-point-history-title": "History is under your control",
    "wizard-point-history-desc":
      "Recognized text and source images are stored locally only when history is enabled.",
    "wizard-privacy-note":
      "You can clear history anytime from Settings. Clearing site data also removes the cached models.",
    "wizard-btn": "Download & Continue",
    "wizard-skip": "Set up later",
    "wizard-loading": "Preparing local OCR...",
  },
  zh: {
    "nav-studio": "◉ 工作区",
    "nav-history": "◎ 历史",
    "nav-settings": "⚙ 设置",
    "title-workspace": "工作区",
    "subtitle-workspace": "本地识别图片中的文字，结果会显示在下方。",
    "dropzone-text": "点击选择图片，或拖拽到这里",
    "dropzone-sub": "也可以粘贴剪贴板图片 · PNG / JPG / WebP",
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
    "lbl-download-det-official": "官方源",
    "lbl-download-det-backup": "备用源",
    "lbl-download-rec-official": "官方源",
    "lbl-download-rec-backup": "备用源",
    "btn-sync-det": "⚡ 在线同步",
    "btn-sync-rec": "⚡ 在线同步",
    "btn-import-det": "📦 本地导入",
    "btn-import-rec": "📦 本地导入",
    "wizard-title": "首次使用准备",
    "wizard-desc":
      "OCRMeow 首次识别前需要下载本地 OCR 模型。这个准备过程只需一次，通常一分钟内完成。",
    "wizard-point-model-title": "一次性下载模型",
    "wizard-point-model-desc": "约 22MB，会缓存在当前浏览器中，后续识别无需重复下载。",
    "wizard-point-local-title": "识别留在本机",
    "wizard-point-local-desc":
      "请放心，我们会保护您的隐私：所有识别操作都在本地完成，不会上传到云端。",
    "wizard-point-history-title": "历史记录可控",
    "wizard-point-history-desc": "识别文字和源图片仅按设置保存在本地历史中，可随时清空。",
    "wizard-privacy-note": "在设置中可清空历史；清除站点数据会同时删除模型缓存。",
    "wizard-btn": "下载并继续",
    "wizard-skip": "稍后设置",
    "wizard-loading": "正在准备本地 OCR...",
  },
};

export function applyLanguage(): void {
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

export function getLang(): "en" | "zh" {
  if (currentSettings.language !== "auto") return currentSettings.language;
  const sysLang =
    typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n.getUILanguage() : navigator.language;
  return sysLang.startsWith("zh") ? "zh" : "en";
}

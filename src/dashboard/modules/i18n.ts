// ─── i18n Module ───────────────────────────────────────────────────
// Owns the translation dictionary, language detection, and DOM patching.

import { currentSettings } from "./settings";

export const i18n = {
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
    "lbl-download-det-official": "Official",
    "lbl-download-det-backup": "Backup",
    "lbl-download-rec-official": "Official",
    "lbl-download-rec-backup": "Backup",
    "btn-sync-det": "⚡ Sync",
    "btn-sync-rec": "⚡ Sync",
    "btn-import-det": "📦 Import",
    "btn-import-rec": "📦 Import",
    "wizard-title": "AI_CORE://INITIALIZATION_WIZARD",
    "wizard-desc":
      "Welcome to OCRMeow. To enable 100% local and offline text recognition, we need to sync the AI core (approx. 22MB) to your browser's local database. This is a one-time operation.",
    "wizard-btn": "BOOT_CYBER_CORE (SYNC_MODELS)",
    "wizard-loading": "SYNCING_NEURAL_NETWORKS...",
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
    "lbl-download-det-official": "官方源",
    "lbl-download-det-backup": "备用源",
    "lbl-download-rec-official": "官方源",
    "lbl-download-rec-backup": "备用源",
    "btn-sync-det": "⚡ 在线同步",
    "btn-sync-rec": "⚡ 在线同步",
    "btn-import-det": "📦 本地导入",
    "btn-import-rec": "📦 本地导入",
    "wizard-title": "AI_CORE://初始化引导",
    "wizard-desc":
      "欢迎使用 OCRMeow。为了实现 100% 纯本地离线识别，我们需要将 AI 核心（约 22MB）同步到您的浏览器本地数据库。此操作仅需执行一次。",
    "wizard-btn": "启动赛博核心 (同步模型)",
    "wizard-loading": "正在同步神经网络...",
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

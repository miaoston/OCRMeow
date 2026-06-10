/**
 * Internationalization for Content Scripts (Data Pad, Selection, etc.)
 *
 * Resolves the user's language preference from chrome.storage.local,
 * falling back to browser language, then to English.
 */

export type Lang = "en" | "zh";

interface I18nStrings {
  selectionHint: string;
  selecting: string;
  recognizing: string;
  firstRunTitle: string;
  firstRunDownloading: string;
  firstRunPrivacy: string;
  firstRunProgressFallback: string;
  firstRunPhasePreparing: string;
  firstRunPhaseDetection: string;
  firstRunPhaseRecognition: string;
  firstRunPhaseDone: string;
  firstRunModelDetection: string;
  firstRunModelRecognition: string;
  firstRunModelWaiting: string;
  firstRunModelDone: string;
  modelsMissing: string;
  noTextFound: string;
  terminalTitle: string;
  editTab: string;
  filterTab: string;
  filterScanOn: string;
  filterInstruction: string;
  filterBright: string;
  filterDark: string;
  copyOutput: string;
  copied: string;
  closeEsc: string;
}

const dict: Record<Lang, I18nStrings> = {
  en: {
    selectionHint: "🐱 Drag to select area, press ESC to exit",
    selecting: "Selecting area...",
    recognizing: "🚀 Recognizing text...",
    firstRunTitle: "Preparing local OCR",
    firstRunDownloading:
      "First use needs a local OCR model download (~22MB). Please keep this page open.",
    firstRunPrivacy:
      "Relax. OCRMeow protects your privacy: recognition runs locally in your browser and is never uploaded to the cloud.",
    firstRunProgressFallback: "Downloading local model...",
    firstRunPhasePreparing: "Preparing local OCR models...",
    firstRunPhaseDetection: "Downloading text detection model...",
    firstRunPhaseRecognition: "Downloading text recognition model...",
    firstRunPhaseDone: "Models saved locally. Starting recognition...",
    firstRunModelDetection: "Text detection model",
    firstRunModelRecognition: "Text recognition model",
    firstRunModelWaiting: "Waiting",
    firstRunModelDone: "Ready",
    modelsMissing:
      "Local OCR models are missing. Open OCRMeow Studio to download or import them, then try again.",
    noTextFound: "No text found. Press ESC to exit.",
    terminalTitle: "TERMINAL://DATA_PAD",
    editTab: "◉ EDIT.TS",
    filterTab: "◎ FILTER.BLKS",
    filterScanOn: "SCAN_INTF://ON",
    filterInstruction: "Click text blocks on the left image",
    filterBright: "[Bright] = Include in result",
    filterDark: "[Dark] = Exclude from result",
    copyOutput: "COPY_OUTPUT",
    copied: "✓ COPIED",
    closeEsc: "CLOSE (ESC)",
  },
  zh: {
    selectionHint: "🐱 拖拽鼠标划选区域，按 ESC 退出",
    selecting: "正在选取区域...",
    recognizing: "🚀 喵力加载中，正在识别...",
    firstRunTitle: "正在准备本地 OCR",
    firstRunDownloading: "首次使用需要下载本地 OCR 模型（约 22MB），请保持页面打开。",
    firstRunPrivacy: "请放心，我们会保护您的隐私：所有识别都在本地完成，不会上传到云端。",
    firstRunProgressFallback: "正在下载本地模型...",
    firstRunPhasePreparing: "正在准备本地 OCR 模型...",
    firstRunPhaseDetection: "正在下载文本检测模型...",
    firstRunPhaseRecognition: "正在下载文本识别模型...",
    firstRunPhaseDone: "模型已保存到本地，正在启动识别...",
    firstRunModelDetection: "文本检测模型",
    firstRunModelRecognition: "文本识别模型",
    firstRunModelWaiting: "等待中",
    firstRunModelDone: "已就绪",
    modelsMissing: "本地 OCR 模型缺失。请打开 OCRMeow Studio 下载或导入模型后再试。",
    noTextFound: "未识别到文字，按 ESC 退出",
    terminalTitle: "终端://数据面板",
    editTab: "◉ 编辑模式",
    filterTab: "◎ 筛选模式",
    filterScanOn: "扫描接口://开启",
    filterInstruction: "请在左侧图像点选文字块",
    filterBright: "[亮] = 加入结果",
    filterDark: "[暗] = 剔除数据",
    copyOutput: "复制结果",
    copied: "✓ 已复制",
    closeEsc: "关闭 (ESC)",
  },
};

export type ContentI18nDict = I18nStrings;

let cachedLang: Lang | null = null;

/**
 * Resolve the effective language. Reads from cache first,
 * then chrome.storage.local, falls back to navigator.language.
 */
export async function resolveContentLang(): Promise<Lang> {
  if (cachedLang) return cachedLang;
  const result: any = await chrome.storage.local.get("ocrSettings");
  const pref = result.ocrSettings?.language ?? "auto";
  if (pref === "zh") {
    cachedLang = "zh";
  } else if (pref === "en") {
    cachedLang = "en";
  } else {
    cachedLang = navigator.language.startsWith("zh") ? "zh" : "en";
  }
  return cachedLang;
}

/**
 * Get the i18n dictionary for content scripts.
 * Must be called after resolveContentLang().
 */
export function getContentDict(): ContentI18nDict {
  return dict[cachedLang ?? "en"];
}

/**
 * Read the user's selected model name for display.
 */
export async function resolveModelName(): Promise<string> {
  const result: any = await chrome.storage.local.get("ocrSettings");
  const model = result.ocrSettings?.model ?? "ppocr_v5";
  const names: Record<string, string> = {
    ppocr_v5: "PP-OCRv5",
  };
  return names[model] ?? model;
}

// ─── Capture Theme System ──────────────────────────────────────────

export interface CaptureTheme {
  /** Primary accent color (borders, text, glows) */
  accent: string;
  /** Accent at lower opacity (backgrounds) */
  accentDim: string;
  /** Accent very faint (ghost backgrounds) */
  accentGhost: string;
  /** Secondary accent (filter mode, magenta-like) */
  secondary: string;
  /** Selection box border */
  selectionBorder: string;
  /** Info panel glow */
  infoGlow: string;
}

const captureThemes: Record<string, CaptureTheme> = {
  cyberpunk: {
    accent: "#00f3ff",
    accentDim: "rgba(0, 243, 255, 0.15)",
    accentGhost: "rgba(0, 243, 255, 0.06)",
    secondary: "#ff00ff",
    selectionBorder: "rgba(0, 243, 255, 0.5)",
    infoGlow: "0 0 15px #00f3ff",
  },
  stealth: {
    accent: "#8a8a8a",
    accentDim: "rgba(138, 138, 138, 0.12)",
    accentGhost: "rgba(138, 138, 138, 0.05)",
    secondary: "#c0392b",
    selectionBorder: "rgba(138, 138, 138, 0.4)",
    infoGlow: "0 0 10px rgba(138, 138, 138, 0.5)",
  },
  ocean: {
    accent: "#4fc3f7",
    accentDim: "rgba(79, 195, 247, 0.15)",
    accentGhost: "rgba(79, 195, 247, 0.06)",
    secondary: "#ab47bc",
    selectionBorder: "rgba(79, 195, 247, 0.5)",
    infoGlow: "0 0 15px rgba(79, 195, 247, 0.7)",
  },
  ember: {
    accent: "#ff9800",
    accentDim: "rgba(255, 152, 0, 0.15)",
    accentGhost: "rgba(255, 152, 0, 0.06)",
    secondary: "#e91e63",
    selectionBorder: "rgba(255, 152, 0, 0.5)",
    infoGlow: "0 0 15px rgba(255, 152, 0, 0.7)",
  },
  minimal: {
    accent: "#ffffff",
    accentDim: "rgba(255, 255, 255, 0.1)",
    accentGhost: "rgba(255, 255, 255, 0.04)",
    secondary: "#aaaaaa",
    selectionBorder: "rgba(255, 255, 255, 0.4)",
    infoGlow: "0 0 10px rgba(255, 255, 255, 0.3)",
  },
};

/**
 * Resolve the user's capture (action) theme.
 */
export async function resolveActionTheme(): Promise<CaptureTheme> {
  const result: any = await chrome.storage.local.get("ocrSettings");
  const key = result.ocrSettings?.themeAction ?? "cyberpunk";
  return captureThemes[key] ?? captureThemes.cyberpunk;
}

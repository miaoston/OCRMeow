// ─── OCR Engine Module ─────────────────────────────────────────────
// Core OCR pipeline: environment detection, model status, processing,
// download-and-run, and single-model sync/import.

import { IS_WEB_MODE } from "../../utils/compat";
import { getAsset, saveAsset, saveHistory } from "../../utils/db";
import {
  downloadAndCacheModels,
  downloadSingleModel,
  DEFAULT_MODEL_URLS,
} from "../../utils/models";
import { getLang } from "./i18n";
import { currentSettings } from "./settings";
import { showModal, showConfirm } from "./modals";
import { addResultCard } from "./history";

export { IS_WEB_MODE };

const WEB_OCR_TIMEOUT_MS = 180000;
type LoadingProgressReporter = (phase: string, pct?: number) => void;

function formatModelDownloadPhase(phase: string, isZh: boolean): string {
  if (isZh) {
    if (phase.includes("Detection")) return "正在下载文本检测模型...";
    if (phase.includes("Recognition")) return "正在下载文本识别模型...";
    if (phase.includes("Done")) return "模型已保存到本地，正在完成设置...";
    return "正在准备本地 OCR...";
  }
  if (phase.includes("Detection")) return "Downloading text detection model...";
  if (phase.includes("Recognition")) return "Downloading text recognition model...";
  if (phase.includes("Done")) return "Models saved locally. Finishing setup...";
  return phase;
}

function firstRunDownloadMessage(isZh: boolean): string {
  if (isZh) {
    return `
      <div class="first-run-inline">
        <p><strong>首次识别需要先下载本地 OCR 模型。</strong></p>
        <p>模型约 22MB，会缓存在当前浏览器中；下载完成后，OCRMeow 会自动继续识别您刚才选择的图片。</p>
        <p>请放心，我们会保护您的隐私：所有识别操作都在本地完成，不会上传到云端。识别历史可在设置中随时清空。</p>
      </div>
    `;
  }
  return `
    <div class="first-run-inline">
      <p><strong>First recognition needs a local OCR model download.</strong></p>
      <p>The model is about 22MB and will be cached in this browser. OCRMeow will resume your current recognition automatically after setup.</p>
      <p>OCRMeow protects your privacy: recognition runs locally in your browser and is never uploaded to the cloud. History can be cleared from Settings.</p>
    </div>
  `;
}

function updateLoadingText(phase: string, pct?: number): void {
  const loadingText = document.getElementById("loading-text");
  if (!loadingText) return;
  loadingText.textContent =
    typeof pct === "number" ? `⚡ ${phase} ${Math.round(pct)}%` : `⚡ ${phase}`;
}

function webOcrPhase(key: "det" | "rec" | "init" | "run", isZh: boolean): string {
  if (isZh) {
    if (key === "det") return "正在加载检测模型";
    if (key === "rec") return "正在加载识别模型";
    if (key === "init") return "正在初始化本地 OCR 引擎";
    return "正在本地识别图片";
  }
  if (key === "det") return "Loading detection model";
  if (key === "rec") return "Loading recognition model";
  if (key === "init") return "Initializing local OCR engine";
  return "Recognizing locally";
}

async function responseToBlobWithProgress(
  response: Response,
  phase: string,
  startPct: number,
  endPct: number,
  onProgress?: LoadingProgressReporter,
): Promise<Blob> {
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body || total <= 0) {
    const blob = await response.blob();
    if (onProgress) onProgress(phase, endPct);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      const chunk = result.value.buffer.slice(
        result.value.byteOffset,
        result.value.byteOffset + result.value.byteLength,
      ) as ArrayBuffer;
      chunks.push(chunk);
      received += result.value.byteLength;
      const fraction = Math.min(received / total, 1);
      const pct = Math.round(startPct + (endPct - startPct) * fraction);
      if (onProgress) onProgress(phase, pct);
    }
  }

  return new Blob(chunks, {
    type: response.headers.get("content-type") || "application/octet-stream",
  });
}

async function fetchBundledModelWithProgress(
  type: "det" | "rec",
  phase: string,
  startPct: number,
  endPct: number,
  onProgress?: LoadingProgressReporter,
): Promise<Blob> {
  if (onProgress) onProgress(phase, startPct);
  const response = await fetch(`models/${type}.tar`);
  if (!response.ok) throw new Error(`OCR_MODEL_${type.toUpperCase()}_UNAVAILABLE`);
  const blob = await responseToBlobWithProgress(response, phase, startPct, endPct, onProgress);
  await saveAsset(`${type}.tar`, blob);
  return blob;
}

// ─── Bundled Model Check ───────────────────────────────────────────

let cachedBundledExist: boolean | null = null;

export async function checkBundledModelsExist(): Promise<boolean> {
  if (cachedBundledExist !== null) return cachedBundledExist;

  // Try HEAD method first for ultra-lightweight check
  const dRes = await fetch("models/det.tar", { method: "HEAD" }).catch(() => null);
  const rRes = await fetch("models/rec.tar", { method: "HEAD" }).catch(() => null);
  if (dRes && rRes && dRes.ok && rRes.ok) {
    cachedBundledExist = true;
    return true;
  }

  // Fallback to GET check with range header (only requests 1 byte to verify existence)
  const dResRange = await fetch("models/det.tar", { headers: { Range: "bytes=0-0" } }).catch(
    () => null,
  );
  const rResRange = await fetch("models/rec.tar", { headers: { Range: "bytes=0-0" } }).catch(
    () => null,
  );
  if (dResRange && rResRange && dResRange.ok && rResRange.ok) {
    cachedBundledExist = true;
    return true;
  }

  cachedBundledExist = false;
  return false;
}

// ─── OCR Processing Pipeline ───────────────────────────────────────

export async function processOCR(base64Image: string, sourceName: string): Promise<void> {
  const loadingEl = document.getElementById("loading-indicator");
  if (!loadingEl) return;

  if (IS_WEB_MODE) {
    const hasDet = await getAsset("det.tar");
    const hasRec = await getAsset("rec.tar");
    if (!hasDet || !hasRec) {
      const bundledExist = await checkBundledModelsExist();
      if (!bundledExist) {
        const isZh = getLang() === "zh";
        const confirmed = await showConfirm(
          firstRunDownloadMessage(isZh),
          isZh ? "下载并继续" : "Download & Continue",
          isZh ? "稍后" : "Later",
          false,
          isZh ? "首次使用准备" : "First Run Setup",
        );

        if (confirmed) {
          await downloadModelsAndRunOCR(base64Image, sourceName);
        }
        return;
      }
    }
  }

  loadingEl.style.display = "block";
  updateLoadingText(
    getLang() === "zh" ? "喵力加载中，正在准备本地识别..." : "Preparing local OCR...",
  );
  const startTime = performance.now();

  performOCR(base64Image, updateLoadingText)
    .then(async (items) => {
      const elapsed = Math.round(performance.now() - startTime);
      loadingEl.style.display = "none";

      let fullText = "";
      if (items && items.length > 0) {
        fullText = items.map((it: any) => it.text).join("\n");
      } else {
        fullText = getLang() === "zh" ? "未发现文字..." : "No text found...";
      }

      let cardId: number | undefined;
      // Save to DB
      if (fullText && fullText !== "未发现文字..." && fullText !== "No text found...") {
        const limit = parseInt(currentSettings.historyLimit, 10) || 100;
        cardId = await saveHistory(fullText, base64Image, sourceName, limit);
      }

      addResultCard(
        fullText,
        sourceName,
        new Date().toLocaleTimeString(),
        base64Image,
        elapsed,
        cardId,
      );
    })
    .catch((err: any) => {
      loadingEl.style.display = "none";
      addResultCard(`Error: ${err.message}`, sourceName, "", "", 0);
      console.error("OCR Studio: Recognition fatal error", err);
    });
}

// ─── Perform OCR ───────────────────────────────────────────────────

/**
 * Perform OCR on a dataUrl, automatically choosing the best path (Extension msg vs Web local).
 * NOTE: `skipHistory: true` has been REMOVED from the extension path —
 *       the background worker no longer auto-saves history.
 */
export async function performOCR(
  dataUrl: string,
  onProgress?: LoadingProgressReporter,
): Promise<any[]> {
  if (!IS_WEB_MODE) {
    // EXTENSION PATH
    const response = await chrome.runtime.sendMessage({
      action: "OCR_REQUEST",
      payload: { image: dataUrl },
    });
    if (response && response.error) throw new Error(response.error);
    return response.items || [];
  } else {
    // WEB PATH — use hidden iframe sandbox
    return new Promise((resolve, reject) => {
      const sandbox = document.getElementById("ocr-sandbox") as HTMLIFrameElement;
      if (!sandbox) {
        reject(new Error("OCR Sandbox not initialized. Please refresh."));
        return;
      }

      let timeout = 0;
      const cleanup = (listener: (event: MessageEvent) => void) => {
        window.removeEventListener("message", listener);
        window.clearTimeout(timeout);
      };

      const requestId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        if (event.data.action === "OCR_RESULT" && event.data.requestId === requestId) {
          cleanup(listener);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve(event.data.payload?.items || event.data.payload || []);
        }
      };

      timeout = window.setTimeout(() => {
        cleanup(listener);
        reject(new Error("OCR_ENGINE_TIMEOUT"));
      }, WEB_OCR_TIMEOUT_MS);

      window.addEventListener("message", listener);

      Promise.resolve()
        .then(async () => {
          const isZh = getLang() === "zh";
          if (onProgress) onProgress(webOcrPhase("init", isZh), 2);

          // Check if we need to initialize sandbox dynamically (first run fallback)
          const detBlob = await getAsset("det.tar");
          const recBlob = await getAsset("rec.tar");
          let activeDetBlob = detBlob;
          let activeRecBlob = recBlob;

          if (!activeDetBlob) {
            activeDetBlob = await fetchBundledModelWithProgress(
              "det",
              webOcrPhase("det", isZh),
              5,
              32,
              onProgress,
            );
          }
          if (!activeRecBlob) {
            activeRecBlob = await fetchBundledModelWithProgress(
              "rec",
              webOcrPhase("rec", isZh),
              36,
              86,
              onProgress,
            );
          }

          if (activeDetBlob && activeRecBlob) {
            if (onProgress) onProgress(webOcrPhase("init", isZh), 92);
            sandbox.contentWindow?.postMessage(
              {
                action: "INIT_CONFIG",
                payload: {
                  detBlob: activeDetBlob,
                  recBlob: activeRecBlob,
                  wasmPath: "wasm/",
                },
              },
              "*",
            );
          }

          if (!sandbox.contentWindow) {
            throw new Error("OCR_SANDBOX_WINDOW_UNAVAILABLE");
          }

          if (onProgress) onProgress(webOcrPhase("run", isZh), 96);
          sandbox.contentWindow?.postMessage(
            {
              action: "RUN_OCR",
              requestId,
              payload: { image: dataUrl },
            },
            "*",
          );
        })
        .catch((err: any) => {
          cleanup(listener);
          reject(err);
        });
    });
  }
}

// ─── Model Status ──────────────────────────────────────────────────

export async function checkModelStatus(): Promise<void> {
  const detBlob = await getAsset("det.tar");
  const recBlob = await getAsset("rec.tar");
  const isZh = getLang() === "zh";

  const statusDet = document.getElementById("status-det");
  const statusRec = document.getElementById("status-rec");

  let hasDet = !!detBlob;
  let hasRec = !!recBlob;
  let isBundled = false;

  if (!hasDet || !hasRec) {
    const bundledExist = await checkBundledModelsExist();
    if (bundledExist) {
      hasDet = true;
      hasRec = true;
      isBundled = true;
    }
  }

  const updateStatus = (el: HTMLElement | null, ready: boolean, bundled: boolean) => {
    if (!el) return;
    if (ready) {
      if (bundled) {
        el.textContent = isZh ? "已就绪 (BUNDLED)" : "READY (BUNDLED)";
        el.style.color = "var(--green)";
        el.style.textShadow = "0 0 8px rgba(0, 255, 136, 0.4)";
      } else {
        el.textContent = isZh ? "已就绪" : "READY";
        el.style.color = "var(--green)";
        el.style.textShadow = "0 0 8px rgba(0, 255, 136, 0.4)";
      }
    } else {
      el.textContent = isZh ? "缺失" : "MISSING";
      el.style.color = "var(--red)";
      el.style.textShadow = "0 0 8px rgba(255, 68, 85, 0.4)";
    }
  };

  updateStatus(statusDet, hasDet, isBundled);
  updateStatus(statusRec, hasRec, isBundled);

  // Update per-row inline button states
  const syncDetBtn = document.getElementById("btn-sync-det") as HTMLButtonElement;
  const syncRecBtn = document.getElementById("btn-sync-rec") as HTMLButtonElement;
  if (syncDetBtn) syncDetBtn.style.opacity = hasDet ? "0.5" : "1";
  if (syncRecBtn) syncRecBtn.style.opacity = hasRec ? "0.5" : "1";

  // Initialize Web Mode Sandbox if both models are available
  if (hasDet && hasRec && IS_WEB_MODE) {
    const sandbox = document.getElementById("ocr-sandbox") as HTMLIFrameElement;
    if (sandbox) {
      const sendInit = () => {
        // ONLY initialize if models exist in IndexedDB (to avoid downloading 22MB on page load)
        if (detBlob && recBlob) {
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
        }
      };

      // Send immediately in case it has already loaded, and set onload to cover loading phase safely
      sendInit();
      sandbox.onload = sendInit;
    }
  }
}

// ─── Single-Model Sync ─────────────────────────────────────────────

export async function syncSingleModel(type: "det" | "rec"): Promise<void> {
  const isZh = getLang() === "zh";
  const label =
    type === "det"
      ? isZh
        ? "检测模型 (det.tar)"
        : "Detection Model (det.tar)"
      : isZh
        ? "识别模型 (rec.tar)"
        : "Recognition Model (rec.tar)";
  const confirmed = await showConfirm(
    isZh
      ? `即将下载${label}，请确保网络连接畅通。确认下载？`
      : `About to download ${label}. Ensure stable network. Continue?`,
    isZh ? "开始下载" : "DOWNLOAD",
    isZh ? "取消" : "CANCEL",
  );

  if (!confirmed) return;

  const btn = document.getElementById(`btn-sync-${type}`) as HTMLButtonElement;
  const progressDiv = document.getElementById("model-download-progress");
  const progressText = document.getElementById("model-progress-text");
  const progressPct = document.getElementById("model-progress-pct");
  const progressBar = document.getElementById("model-progress-bar");

  if (btn) btn.disabled = true;
  if (progressDiv) progressDiv.style.display = "block";

  const updateProgress = (phase: string, pct: number) => {
    if (progressText) progressText.textContent = phase;
    if (progressPct) progressPct.textContent = `${pct}%`;
    if (progressBar) progressBar.style.width = `${pct}%`;
  };

  Promise.resolve()
    .then(async () => {
      await downloadSingleModel(type, (phase, pct) => {
        updateProgress(formatModelDownloadPhase(phase, isZh), pct);
      });

      await showModal(
        isZh ? `${label}已成功下载并缓存至本地数据库！` : `${label} successfully cached!`,
        isZh ? "✓ 下载完成" : "✓ DOWNLOAD_COMPLETE",
      );
    })
    .catch(async (err: any) => {
      console.error(`Model download error (${type}):`, err);
      await showModal(
        `${isZh ? "下载失败：" : "Download failed: "} ${err.message}\n\n${isZh ? "请检查您的网络连接或尝试手动下载并导入模型。" : "Please check your network connection or try downloading and importing the models manually."}`,
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

// ─── Single-Model Import ───────────────────────────────────────────

export async function handleSingleModelImport(
  files: FileList | null,
  type: "det" | "rec",
): Promise<void> {
  if (!files || files.length === 0) return;

  const isZh = getLang() === "zh";
  const targetFilename = `${type}.tar`;
  const file = files[0];
  const { saveAsset } = await import("../../utils/db");

  Promise.resolve()
    .then(async () => {
      await saveAsset(targetFilename, file);
      await checkModelStatus();
      const label =
        type === "det"
          ? isZh
            ? "检测模型 (det.tar)"
            : "Detection model (det.tar)"
          : isZh
            ? "识别模型 (rec.tar)"
            : "Recognition model (rec.tar)";
      await showModal(
        isZh ? `${label} 已成功导入本地数据库！` : `${label} imported successfully!`,
        isZh ? "✓ 导入成功" : "✓ IMPORT_SUCCESS",
      );
    })
    .catch(async (err: any) => {
      console.error(`Local model import error (${type}):`, err);
      await showModal(`${isZh ? "导入失败：" : "Import failed: "} ${err.message}`, "❌ ERROR");
    });
}

// ─── Download Models & Run OCR ─────────────────────────────────────

export async function downloadModelsAndRunOCR(
  base64Image: string,
  sourceName: string,
): Promise<void> {
  const isZh = getLang() === "zh";
  const progressDiv = document.getElementById("model-download-progress");
  const progressText = document.getElementById("model-progress-text");
  const progressPct = document.getElementById("model-progress-pct");
  const progressBar = document.getElementById("model-progress-bar");

  const detUrl = DEFAULT_MODEL_URLS.det;
  const recUrl = DEFAULT_MODEL_URLS.rec;

  if (progressDiv) progressDiv.style.display = "block";

  const updateProgress = (phase: string, pct: number) => {
    if (progressText) progressText.textContent = phase;
    if (progressPct) progressPct.textContent = `${pct}%`;
    if (progressBar) progressBar.style.width = `${pct}%`;
  };

  Promise.resolve()
    .then(async () => {
      await downloadAndCacheModels({ det: detUrl, rec: recUrl }, (phase, pct) => {
        updateProgress(formatModelDownloadPhase(phase, isZh), pct);
      });

      await checkModelStatus();

      await showModal(
        isZh
          ? "✓ 模型已成功下载并缓存至本地数据库！正在为您自动启动刚才的文本识别..."
          : "✓ Model deployed! Resuming your OCR request automatically...",
        isZh ? "✓ 部署完成" : "✓ DEPLOY_COMPLETE",
      );

      await processOCR(base64Image, sourceName);
    })
    .catch(async (err: any) => {
      console.error("Auto model download error:", err);
      await showModal(
        `${isZh ? "下载失败：" : "Download failed: "} ${err.message}\n\n${isZh ? "请检查您的网络连接或尝试手动下载并导入模型。" : "Please check your network connection or try downloading and importing the models manually."}`,
        "❌ ERROR",
      );
    })
    .finally(() => {
      setTimeout(() => {
        if (progressDiv) progressDiv.style.display = "none";
      }, 1500);
    });
}

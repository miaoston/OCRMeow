/**
 * OCRMeow Content Script — Orchestrator
 *
 * Coordinates the lifecycle of:
 *   1. Screenshot capture → WebGL backdrop
 *   2. Mouse selection → crop → OCR
 *   3. Interaction layer (block rendering & filtering)
 *   4. Data Pad (result display & editing)
 *
 * This file is intentionally slim.
 * All heavy logic is delegated to specialized modules.
 */

import { GLRenderer } from "../ui/gl-renderer";
import { bindSelection } from "./selection";
import { createState } from "./state";
import { createInteractionLayer } from "./interaction-layer";
import { createDataPad } from "./data-pad";
import { resolveContentLang, getContentDict, resolveModelName, resolveActionTheme } from "./i18n";
import { createUIHost, createOverlay, createInfoPanel } from "./overlay";
import { projector } from "./projector";

function formatFirstRunPhase(phase: string, t: ReturnType<typeof getContentDict>): string {
  if (phase.includes("Detection")) return t.firstRunPhaseDetection;
  if (phase.includes("Recognition")) return t.firstRunPhaseRecognition;
  if (phase.includes("Done")) return t.firstRunPhaseDone;
  if (phase.includes("Preparing")) return t.firstRunPhasePreparing;
  return t.firstRunProgressFallback;
}

function updateFirstRunDownloadPanel(
  infoPanel: HTMLElement,
  phase: string,
  pct: number,
  t: ReturnType<typeof getContentDict>,
): void {
  const progress = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const isDetection = phase.includes("Detection");
  const isRecognition = phase.includes("Recognition");
  const isDone = phase.includes("Done");
  const detProgress = isDone
    ? 100
    : isRecognition
      ? 100
      : isDetection
        ? Math.max(0, Math.min(100, Math.round(((progress - 2) / 30) * 100)))
        : 0;
  const recProgress = isDone
    ? 100
    : isRecognition
      ? Math.max(0, Math.min(100, Math.round(((progress - 36) / 60) * 100)))
      : 0;

  infoPanel.style.whiteSpace = "normal";
  infoPanel.style.width = "min(520px, calc(100vw - 32px))";
  infoPanel.style.maxWidth = "min(520px, calc(100vw - 32px))";
  infoPanel.style.padding = "16px 18px";
  infoPanel.style.borderRadius = "18px";
  infoPanel.style.textAlign = "left";
  infoPanel.style.lineHeight = "1.45";
  infoPanel.style.fontFamily =
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif";
  infoPanel.style.color = "#f7d7ff";
  infoPanel.style.borderColor = "#ff00ff";
  infoPanel.style.background = "rgba(10, 10, 14, 0.9)";
  infoPanel.style.boxShadow = "0 18px 60px rgba(0, 0, 0, 0.45), 0 0 26px rgba(255, 0, 255, 0.42)";

  if (!infoPanel.querySelector("#ocrmeow-download-progress-bar")) {
    infoPanel.innerHTML = `
      <div style="display:grid;gap:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div id="ocrmeow-download-title" style="font-size:15px;font-weight:800;color:#fff;"></div>
          <div id="ocrmeow-download-pct" style="font-size:13px;font-weight:800;color:#ff7cff;min-width:42px;text-align:right;"></div>
        </div>
        <div id="ocrmeow-download-desc" style="font-size:13px;font-weight:650;color:#f2d8f8;"></div>
        <div id="ocrmeow-download-privacy" style="font-size:12px;font-weight:520;color:rgba(255,255,255,0.76);"></div>
        <div style="height:6px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;">
          <div id="ocrmeow-download-progress-bar" style="width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#00f3ff,#ff4dff);transition:width 220ms ease;"></div>
        </div>
        <div style="display:grid;gap:8px;margin-top:2px;">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">
              <span id="ocrmeow-det-label" style="font-size:11px;font-weight:750;color:rgba(255,255,255,0.78);"></span>
              <span id="ocrmeow-det-status" style="font-size:11px;font-weight:750;color:#7df8ff;"></span>
            </div>
            <div style="height:4px;border-radius:999px;background:rgba(255,255,255,0.1);overflow:hidden;">
              <div id="ocrmeow-det-progress-bar" style="width:0%;height:100%;border-radius:999px;background:#00f3ff;transition:width 220ms ease;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">
              <span id="ocrmeow-rec-label" style="font-size:11px;font-weight:750;color:rgba(255,255,255,0.78);"></span>
              <span id="ocrmeow-rec-status" style="font-size:11px;font-weight:750;color:#ff7cff;"></span>
            </div>
            <div style="height:4px;border-radius:999px;background:rgba(255,255,255,0.1);overflow:hidden;">
              <div id="ocrmeow-rec-progress-bar" style="width:0%;height:100%;border-radius:999px;background:#ff4dff;transition:width 220ms ease;"></div>
            </div>
          </div>
        </div>
        <div id="ocrmeow-download-phase" style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.62);"></div>
      </div>
    `;
  }

  const title = infoPanel.querySelector("#ocrmeow-download-title");
  const pctEl = infoPanel.querySelector("#ocrmeow-download-pct");
  const desc = infoPanel.querySelector("#ocrmeow-download-desc");
  const privacy = infoPanel.querySelector("#ocrmeow-download-privacy");
  const phaseEl = infoPanel.querySelector("#ocrmeow-download-phase");
  const bar = infoPanel.querySelector("#ocrmeow-download-progress-bar") as HTMLElement | null;
  const detLabel = infoPanel.querySelector("#ocrmeow-det-label");
  const recLabel = infoPanel.querySelector("#ocrmeow-rec-label");
  const detStatus = infoPanel.querySelector("#ocrmeow-det-status");
  const recStatus = infoPanel.querySelector("#ocrmeow-rec-status");
  const detBar = infoPanel.querySelector("#ocrmeow-det-progress-bar") as HTMLElement | null;
  const recBar = infoPanel.querySelector("#ocrmeow-rec-progress-bar") as HTMLElement | null;

  if (title) title.textContent = t.firstRunTitle;
  if (pctEl) pctEl.textContent = `${progress}%`;
  if (desc) desc.textContent = t.firstRunDownloading;
  if (privacy) privacy.textContent = t.firstRunPrivacy;
  if (phaseEl) phaseEl.textContent = formatFirstRunPhase(phase, t);
  if (bar) bar.style.width = `${progress}%`;
  if (detLabel) detLabel.textContent = t.firstRunModelDetection;
  if (recLabel) recLabel.textContent = t.firstRunModelRecognition;
  if (detStatus)
    detStatus.textContent =
      detProgress >= 100
        ? t.firstRunModelDone
        : isDetection
          ? `${detProgress}%`
          : t.firstRunModelWaiting;
  if (recStatus)
    recStatus.textContent =
      recProgress >= 100
        ? t.firstRunModelDone
        : isRecognition
          ? `${recProgress}%`
          : t.firstRunModelWaiting;
  if (detBar) detBar.style.width = `${detProgress}%`;
  if (recBar) recBar.style.width = `${recProgress}%`;
}

// Global listener for status updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "OCR_AUTO_DOWNLOADING") {
    resolveContentLang().then(() => {
      const host = document.getElementById("ocrmeow-root");
      const infoPanel = host?.shadowRoot?.getElementById("ocrmeow-info");
      if (!infoPanel) return;
      const payload = message.payload || {};
      updateFirstRunDownloadPanel(
        infoPanel,
        payload.phase || "Preparing local OCR models...",
        payload.pct || 0,
        getContentDict(),
      );
    });
  }
});

let uiRoot: ShadowRoot | null = null;
let overlay: HTMLDivElement | null = null;
let isAnimating = false;
let renderer: GLRenderer | null = null;

// ─── Message Router ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "PING") {
    sendResponse({ pong: true });
  }
  if (message.action === "START_SELECTION") {
    initSelection(message.payload?.dataUrl).catch(console.error);
  }
});

// ─── Animation Loop ────────────────────────────────────────────────

function animate(time: number) {
  if (renderer && isAnimating) {
    renderer.render(time);
    requestAnimationFrame(animate);
  }
}

// ─── Main Orchestration ────────────────────────────────────────────

async function initSelection(dataUrl: string) {
  if (overlay) return;

  // 0. Environment Setup
  await resolveContentLang();
  const t = getContentDict();
  const modelName = await resolveModelName();
  const theme = await resolveActionTheme();

  // 1. Storage requests (capture is now pre-fetched by background script)
  const settingsResult = await chrome.storage.local.get("ocrSettings");
  const settingsData = settingsResult as any;

  if (!dataUrl) throw new Error("Capture failed");
  const intensity = parseFloat(settingsData.ocrSettings?.distortionIntensity ?? "0.1");

  // 2. Build Shadow DOM UI Layers IMMEDIATELY after capture to reduce perceived latency
  uiRoot = createUIHost();
  const ui = createOverlay(theme);
  overlay = ui.overlay;
  const selectionBox = ui.selectionBox;
  overlay.appendChild(selectionBox);

  // Temporarily set CSS background so user sees the frozen page instantly
  // while WebGL and image decoding spin up.
  overlay.style.backgroundImage = `url(${dataUrl})`;
  overlay.style.backgroundSize = "100% 100%";
  uiRoot.appendChild(overlay);

  // 3. Info Terminal appears instantly
  const infoPanel = createInfoPanel(theme, `${t.selectionHint}  ⟨${modelName}⟩`);
  overlay.appendChild(infoPanel);

  // 4. Async decode and WebGL initialization
  const bgImage = new Image();
  bgImage.src = dataUrl;
  await bgImage.decode();

  // Remove temporary CSS background
  overlay.style.backgroundImage = "none";

  // 5. WebGL Backdrop — High-DPI (Retina) support
  const canvas = document.createElement("canvas");
  const dpr = projector.getDPR();
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  canvas.style.pointerEvents = "none";
  // Insert canvas behind other elements
  overlay.insertBefore(canvas, overlay.firstChild);

  renderer = new GLRenderer(canvas);
  renderer.updateBackground(bgImage);
  renderer.setDistortionIntensity(intensity);

  // 5. Lifecycle Handlers — single AbortController governs ALL selection-phase listeners
  isAnimating = true;
  requestAnimationFrame(animate);

  const lifecycleController = new AbortController();
  const { signal } = lifecycleController;

  const handleResize = () => {
    if (renderer && canvas) {
      const currentDpr = projector.getDPR();
      canvas.width = window.innerWidth * currentDpr;
      canvas.height = window.innerHeight * currentDpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      renderer.resize(canvas.width, canvas.height);
    }
  };

  window.addEventListener("resize", handleResize, { signal });
  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key === "Escape") cleanup();
    },
    { signal, once: true },
  );

  // 9. Wait for user to select a region → OCR
  bindSelection(overlay, selectionBox, infoPanel, renderer, bgImage, modelName, theme)
    .then((result) => {
      if (!result) {
        cleanup();
        return;
      }

      if (result.items.length === 0) {
        infoPanel.textContent = t.noTextFound;
        infoPanel.style.display = "block";
        return;
      }

      // 10. Transition: hide loading UI, show results
      infoPanel.style.display = "none";
      isAnimating = false;

      // 11. Build state from OCR results
      const state = createState(result.items);

      // 12. Create interaction layer (blocks) — themed
      const syncTextRef = { current: () => {} };
      const interactionLayerHandle = createInteractionLayer(
        state,
        result.minX,
        result.minY,
        () => syncTextRef.current(),
        theme,
      );
      overlay!.appendChild(interactionLayerHandle.element);

      // 13. Create Data Pad — themed
      const dataPad = createDataPad(
        state,
        result.minX,
        result.minY,
        result.width,
        result.height,
        interactionLayerHandle,
        () => cleanup(),
        theme,
      );
      overlay!.appendChild(dataPad.element);

      // Wire up the sync reference
      syncTextRef.current = dataPad.syncText;
      overlay!.style.cursor = "default";
    })
    .catch((err: any) => {
      console.error("OCRMeow: Fatal error during selection:", err);
      if (infoPanel) {
        infoPanel.textContent = `❌ ${err.message}`;
        infoPanel.style.color = theme.secondary;
      }
    });

  // Single cleanup path — AbortController guarantees all listeners are removed atomically
  function cleanup() {
    lifecycleController.abort();
    performFinalCleanup();
  }
}

// ─── Cleanup ───────────────────────────────────────────────────────

function performFinalCleanup() {
  isAnimating = false;
  if (renderer) {
    renderer.destroy();
    renderer = null;
  }
  if (overlay) {
    overlay = null;
  }
  const host = document.getElementById("ocrmeow-root");
  if (host) host.remove();
  uiRoot = null;
  chrome.runtime.sendMessage({ action: "SELECTION_DONE" });
}

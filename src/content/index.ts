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

// Global listener for status updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "OCR_AUTO_DOWNLOADING") {
    const host = document.getElementById("ocrmeow-root");
    const infoPanel = host?.shadowRoot?.getElementById("ocrmeow-info");
    if (infoPanel) {
      const isZh =
        document.documentElement.lang.startsWith("zh") || navigator.language.startsWith("zh");
      infoPanel.textContent = isZh
        ? "⚡ 首次运行：正在自动下载 AI 模型 (约 22MB)，请稍候..."
        : "⚡ First-run: Auto-downloading AI models (~22MB), please wait...";
    }
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

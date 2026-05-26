import { CaptureTheme } from "./i18n";

/**
 * UI Host — The root container using Shadow DOM to isolate OCRMeow from the host page.
 */
export function createUIHost() {
  const host = document.createElement("div");
  host.id = "ocrmeow-root";
  // Ensure host itself doesn't affect page layout
  host.style.cssText =
    "position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;";

  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  return shadow;
}

/**
 * Overlay Manager — Handles the creation and styling of the primary UI layers.
 */

export function createOverlay(theme: CaptureTheme) {
  const overlay = document.createElement("div");
  overlay.id = "ocrmeow-overlay";

  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
    cursor: crosshair;
    background: #000;
    overflow: hidden;
    color-scheme: dark;
  `;

  const selectionBox = document.createElement("div");
  selectionBox.style.cssText = `
    position: absolute;
    border: 2px solid ${theme.selectionBorder};
    background: transparent;
    display: none;
    pointer-events: none;
    z-index: 2;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  `;

  return { overlay, selectionBox };
}

export function createInfoPanel(theme: CaptureTheme, text: string) {
  const panel = document.createElement("div");
  panel.id = "ocrmeow-info";
  panel.style.all = "initial";
  panel.textContent = text;

  panel.style.cssText = `
    position: fixed;
    top: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10, 10, 12, 0.85);
    color: ${theme.accent};
    padding: 12px 24px;
    border-radius: 100px;
    font-size: 14px;
    font-weight: bold;
    font-family: 'Fira Code', monospace, sans-serif;
    z-index: 100;
    border: 2px solid ${theme.accent};
    box-shadow: ${theme.infoGlow};
    backdrop-filter: blur(10px);
    display: block;
    pointer-events: none;
    white-space: nowrap;
    transition: all 0.3s ease;
  `;

  return panel;
}

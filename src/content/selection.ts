/**
 * Selection module — handles mouse-driven area selection,
 * image cropping, and OCR request dispatching.
 *
 * Coordinate System Contract:
 * - The overlay is `position: fixed`, so `e.clientX/Y` maps 1:1 to overlay coordinates.
 * - CSS pixels are used for DOM positioning and WebGL uniforms (canvas.width = innerWidth).
 * - Physical pixels (CSS × DPR) are used only for the crop canvas sent to OCR.
 */

import { GLRenderer } from "../ui/gl-renderer";
import { getContentDict, CaptureTheme } from "./i18n";
import { projector } from "./projector";

export interface SelectionResult {
  items: any[];
  minX: number;
  minY: number;
  width: number;
  height: number;
}

// Persistent crop canvas — avoids GC churn on repeated selections.
let cropCanvas: HTMLCanvasElement | null = null;
let cropCtx: CanvasRenderingContext2D | null = null;

function getCropCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!cropCanvas || !cropCtx) {
    cropCanvas = document.createElement("canvas");
    cropCtx = cropCanvas.getContext("2d")!;
  }
  return { canvas: cropCanvas, ctx: cropCtx };
}

/**
 * Crop a region from the captured screenshot.
 * Input coordinates are CSS pixels; output is at physical pixel resolution.
 */
export function cropImage(
  img: HTMLImageElement,
  start: { x: number; y: number },
  end: { x: number; y: number },
): string {
  const dpr = projector.getDPR();
  const { canvas, ctx } = getCropCanvas();

  const x = Math.min(start.x, end.x) * dpr;
  const y = Math.min(start.y, end.y) * dpr;
  const width = Math.abs(end.x - start.x) * dpr;
  const height = Math.abs(end.y - start.y) * dpr;

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

/**
 * Send cropped image to OCR engine via background worker.
 */
export async function performOCR(dataUrl: string): Promise<any[]> {
  const response = await chrome.runtime.sendMessage({
    action: "OCR_REQUEST",
    payload: { image: dataUrl },
  });

  if (response && response.error) {
    throw new Error(response.error);
  }

  if (response && response.items) {
    return response.items;
  }

  return [];
}

/**
 * Bind mouse selection events to the overlay.
 * Returns a Promise that resolves with the selection result (items + geometry).
 *
 * All event listeners are managed by an AbortController, guaranteeing
 * cleanup on every exit path (success, error, ESC, or external abort).
 */
export function bindSelection(
  overlay: HTMLDivElement,
  selectionBox: HTMLDivElement,
  infoPanel: HTMLDivElement,
  renderer: GLRenderer,
  bgImage: HTMLImageElement,
  modelName: string = "PP-OCRv5",
  theme?: CaptureTheme,
): Promise<SelectionResult | null> {
  return new Promise((resolve) => {
    const t = getContentDict();
    let isSelecting = false;
    let startPos = { x: 0, y: 0 };

    // AbortController ensures ALL listeners are cleaned up on ANY exit path.
    const controller = new AbortController();
    const signal = controller.signal;

    const cleanupListeners = () => {
      controller.abort();
    };

    const onMouseDown = (e: MouseEvent) => {
      isSelecting = true;
      startPos = { x: e.clientX, y: e.clientY };
      infoPanel.textContent = t.selecting;
      selectionBox.style.display = "block";
      selectionBox.style.left = `${startPos.x}px`;
      selectionBox.style.top = `${startPos.y}px`;
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
      const dpr = projector.getDPR();
      renderer.setSelection(startPos.x * dpr, startPos.y * dpr, 0, 0);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isSelecting) return;
      const width = Math.abs(e.clientX - startPos.x);
      const height = Math.abs(e.clientY - startPos.y);
      const left = Math.min(startPos.x, e.clientX);
      const top = Math.min(startPos.y, e.clientY);

      selectionBox.style.left = `${left}px`;
      selectionBox.style.top = `${top}px`;
      selectionBox.style.width = `${width}px`;
      selectionBox.style.height = `${height}px`;

      const dpr = projector.getDPR();
      renderer.setSelection(left * dpr, top * dpr, width * dpr, height * dpr);
    };

    const onMouseUp = async (e: MouseEvent) => {
      if (!isSelecting) return;
      isSelecting = false;
      const endPos = { x: e.clientX, y: e.clientY };

      // Ignore tiny selections (accidental clicks)
      if (Math.abs(endPos.x - startPos.x) < 5 || Math.abs(endPos.y - startPos.y) < 5) {
        selectionBox.style.display = "none";
        renderer.setSelection(0, 0, 0, 0);
        return;
      }

      // Selection phase is over — detach all listeners immediately
      cleanupListeners();

      // Visual: loading state — show model name
      const loadColor = theme?.secondary ?? "#ff00ff";
      infoPanel.textContent = `${t.recognizing}  ⟨${modelName}⟩`;
      infoPanel.style.color = loadColor;
      infoPanel.style.borderColor = loadColor;
      infoPanel.style.boxShadow = `0 0 15px ${loadColor}`;
      renderer.setRecognizing(true);

      const croppedDataUrl = cropImage(bgImage, startPos, endPos);

      performOCR(croppedDataUrl)
        .then((items) => {
          renderer.setRecognizing(false);
          renderer.render(performance.now());

          const minX = Math.min(startPos.x, endPos.x);
          const minY = Math.min(startPos.y, endPos.y);

          resolve({
            items,
            minX,
            minY,
            width: Math.abs(endPos.x - startPos.x),
            height: Math.abs(endPos.y - startPos.y),
          });
        })
        .catch((err: any) => {
          infoPanel.textContent =
            err.message === "MODELS_MISSING"
              ? "❌ Error: Models missing! Please open Settings to download them."
              : `❌ OCR Error: ${err.message}`;
          infoPanel.style.color = "var(--red, #ff4455)";
          infoPanel.style.borderColor = "var(--red, #ff4455)";
          infoPanel.style.boxShadow = "0 0 15px rgba(255, 68, 85, 0.5)";
          renderer.setRecognizing(false);
          renderer.render(performance.now());
          resolve(null); // Abort
        });
    };

    overlay.addEventListener("mousedown", onMouseDown, { signal });
    overlay.addEventListener("mousemove", onMouseMove, { signal });
    overlay.addEventListener("mouseup", onMouseUp, { signal });
  });
}

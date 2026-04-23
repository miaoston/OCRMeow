/**
 * Interaction Layer — renders clickable text blocks over the captured image.
 *
 * Architecture:
 *   #ocrmeow-overlay (fixed, fullscreen)
 *     ├── <canvas>              pointer-events: none   ← WebGL backdrop
 *     ├── #selection-box        pointer-events: none   ← selection outline
 *     ├── #info-panel           pointer-events: none   ← status text
 *     ├── #interaction-layer    pointer-events: none   ← container
 *     │    └── .ocrmeow-block   pointer-events: auto   ← clickable blocks
 *     └── #result-panel         pointer-events: auto   ← Data Pad
 *
 * Coordinate Projection (Golden Formula from GEMINI.md):
 *   1. physicalPx = OCR raw result (relative to cropped image)
 *   2. cssPx      = physicalPx / devicePixelRatio
 *   3. screenPos  = cssPx + selectionOffset (minX/minY)
 */

import { AppState, OcrItem } from "./state";
import type { CaptureTheme } from "./i18n";
import { projector } from "./projector";

export interface InteractionLayerHandle {
  element: HTMLDivElement;
  show: () => void;
  hide: () => void;
  destroy: () => void;
}

/** Default theme (cyberpunk) used as fallback */
const defaultTheme: CaptureTheme = {
  accent: "#00f3ff",
  accentDim: "rgba(0, 243, 255, 0.15)",
  accentGhost: "rgba(0, 243, 255, 0.06)",
  secondary: "#ff00ff",
  selectionBorder: "rgba(0, 243, 255, 0.5)",
  infoGlow: "0 0 15px #00f3ff",
};

import { getInteractionLayerStyles } from "./styles";

/**
 * Create the interaction layer with all text blocks positioned correctly.
 */
export function createInteractionLayer(
  state: AppState,
  minX: number,
  minY: number,
  syncText: () => void,
  theme?: CaptureTheme,
): InteractionLayerHandle {
  const t = theme ?? defaultTheme;

  const layer = document.createElement("div");
  layer.id = "ocrmeow-interaction-layer";

  // Inject centralized styles
  const styleTag = document.createElement("style");
  styleTag.textContent = getInteractionLayerStyles(t);
  layer.appendChild(styleTag);

  // Render each block
  state.items.forEach((item) => {
    const block = createBlock(item, minX, minY, syncText, t);
    layer.appendChild(block);
  });

  console.log(
    `OCRMeow: Interaction layer rendered ${state.items.length} blocks.` +
      ` DPR=${projector.getDPR()}, offset=(${minX}, ${minY})`,
  );

  return {
    element: layer,
    show: () => {
      layer.style.display = "block";
    },
    hide: () => {
      layer.style.display = "none";
    },
    destroy: () => {
      layer.remove();
    },
  };
}

/**
 * Create a single clickable block element for one OCR item.
 */
function createBlock(
  item: OcrItem,
  minX: number,
  minY: number,
  syncText: () => void,
  theme: CaptureTheme,
): HTMLDivElement {
  const box = item.box;

  // Project OCR physical coords → CSS screen coords using projector
  const xs = box.map((p) => projector.physicalToCss(p[0]));
  const ys = box.map((p) => projector.physicalToCss(p[1]));

  const bx = Math.min(...xs) + minX;
  const by = Math.min(...ys) + minY;
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);

  const block = document.createElement("div");
  block.className = "ocrmeow-block";
  block.dataset.index = String(item.index);

  Object.assign(block.style, {
    position: "absolute",
    left: `${bx}px`,
    top: `${by}px`,
    width: `${bw}px`,
    height: `${bh}px`,
    cursor: "pointer",
    pointerEvents: "auto",
    zIndex: "2147483646",
    transition: "all 0.15s ease",
    display: "block",
    visibility: "visible",
    boxSizing: "border-box",
  });

  applyStateStyle(block, item.selected);

  // Click handler: toggle selection
  block.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    item.selected = !item.selected;
    applyStateStyle(block, item.selected);
    syncText();
  };

  // Hover feedback
  block.onmouseenter = () => {
    if (item.selected) {
      block.style.background = theme.accentDim.replace(/[\d.]+\)$/, "0.35)");
      block.style.boxShadow = `0 0 18px ${theme.selectionBorder}, 0 0 35px ${theme.accentGhost}`;
    } else {
      block.style.opacity = "0.55";
    }
  };

  block.onmouseleave = () => {
    applyStateStyle(block, item.selected);
  };

  return block;
}

function applyStateStyle(block: HTMLDivElement, isSelected: boolean): void {
  if (isSelected) {
    block.classList.remove("excluded");
    // Clear manual overrides if any
    block.style.background = "";
    block.style.boxShadow = "";
    block.style.opacity = "";
  } else {
    block.classList.add("excluded");
    block.style.background = "";
    block.style.boxShadow = "";
    block.style.opacity = "";
  }
}

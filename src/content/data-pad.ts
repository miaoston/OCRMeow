/**
 * Data Pad — Military-Grade Cyber Terminal UI
 *
 * Design spec from AGENTS.md §4 "赛博工业级 UI":
 *   - Deep graphite matte background + neon cyan (#00f3ff) angular borders
 *   - HEX decoration (pseudo-code like 0x7F), status LEDs
 *   - Monospace font (Fira Code), line-height ≥ 1.7
 *   - All buttons: hover translateY(-2px) lift feedback
 *   - Scanline animation overlay
 */

import { AppState } from "./state";
import { InteractionLayerHandle } from "./interaction-layer";
import { getContentDict } from "./i18n";
import type { CaptureTheme } from "./i18n";

import { getDataPadStyles } from "./styles";

export interface DataPadHandle {
  element: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  syncText: () => void;
  destroy: () => void;
}

export function createDataPad(
  state: AppState,
  minX: number,
  minY: number,
  selectionWidth: number,
  _selectionHeight: number,
  interactionLayer: InteractionLayerHandle,
  onClose: () => void,
  theme?: CaptureTheme,
): DataPadHandle {
  const t = getContentDict();
  const themeRef = theme ?? {
    accent: "#00f3ff",
    accentDim: "rgba(0, 243, 255, 0.15)",
    secondary: "#ff00ff",
    selectionBorder: "rgba(0, 243, 255, 0.5)",
    infoGlow: "0 0 15px #00f3ff",
    accentGhost: "rgba(0, 243, 255, 0.06)",
  };
  const accent = themeRef.accent;
  const accentDim = themeRef.accentDim;

  const panel = document.createElement("div");
  panel.id = "ocrmeow-result-panel";
  panel.style.all = "initial";

  // --- Smart Position Calculation ---
  const panelWidth = 460;
  const panelHeight = 540;
  const margin = 24;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let panelLeft = Math.max(
    margin,
    Math.min(minX + selectionWidth + margin, vw - panelWidth - margin),
  );
  let panelTop = Math.max(margin, Math.min(minY, vh - panelHeight - margin));

  panel.style.cssText = `
    position: fixed;
    top: ${panelTop}px;
    left: ${panelLeft}px;
    width: ${panelWidth}px;
  `;

  // Inject centralized styles
  const styleTag = document.createElement("style");
  styleTag.textContent = getDataPadStyles(themeRef);
  panel.appendChild(styleTag);

  // --- Scanline Overlay ---
  const scanline = document.createElement("div");
  scanline.className = "ocrmeow-scanline";
  panel.appendChild(scanline);

  // --- Header ---
  const header = createHeader(accent);
  panel.appendChild(header);

  // --- HEX Decoration Bar ---
  const hexBar = document.createElement("div");
  hexBar.className = "ocrmeow-pad-hexbar";
  hexBar.textContent = generateHexSequence(state.items.length);
  panel.appendChild(hexBar);

  // --- Mode Toggle Bar ---
  const { toggleBar, btnEdit, btnFilter } = createToggleBar();
  panel.appendChild(toggleBar);

  // --- Main Content Area ---
  const mainView = document.createElement("div");
  mainView.className = "ocrmeow-pad-mainview";

  // Textarea
  const textArea = document.createElement("textarea");
  textArea.className = "ocrmeow-pad-textarea";
  textArea.spellcheck = false;

  // Filter mode hint
  const filterHint = document.createElement("div");
  filterHint.className = "ocrmeow-pad-filterhint";
  filterHint.innerHTML = `
    <div class="ocrmeow-pad-filterhint-title">${t.filterScanOn}</div>
    <div class="ocrmeow-pad-filterhint-desc">
      ${t.filterInstruction}<br/>
      <span style="color:${accent}; text-shadow: 0 0 6px ${accentDim};">${t.filterBright}</span><br/>
      <span style="color:#555;">${t.filterDark}</span>
    </div>
    <div class="ocrmeow-pad-filterhint-meta">
      BLOCKS_TOTAL: ${state.items.length} // MODE: INTERACTIVE
    </div>
  `;

  mainView.appendChild(textArea);
  mainView.appendChild(filterHint);
  panel.appendChild(mainView);

  // --- Status Bar (HEX footer) ---
  const statusBar = document.createElement("div");
  statusBar.className = "ocrmeow-pad-statusbar";
  statusBar.innerHTML = `
    <span>MEM: 0x${(Math.random() * 0xffff).toString(16).slice(0, 4).toUpperCase()}</span>
    <span id="ocrmeow-block-count" style="color:${accent}; font-size:10px; font-weight:bold; text-shadow:0 0 8px ${accentDim}; letter-spacing:1px;">BLK: ${state.items.length}/${state.items.length}</span>
    <span>CRC: OK</span>
  `;
  panel.appendChild(statusBar);

  // --- Action Buttons ---
  const actionBar = document.createElement("div");
  actionBar.className = "ocrmeow-pad-actionbar";

  const copyBtn = document.createElement("button");
  copyBtn.textContent = t.copyOutput;
  copyBtn.className = "ocrmeow-pad-copybtn";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = t.closeEsc;
  closeBtn.className = "ocrmeow-pad-closebtn";

  actionBar.appendChild(copyBtn);
  actionBar.appendChild(closeBtn);
  panel.appendChild(actionBar);

  // --- Sync Function (Debounced to prevent layout thrashing) ---
  let syncTimeout: any = null;
  const syncText = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      const selected = state.items.filter((it) => it.selected);
      textArea.value = selected.map((it) => it.text).join("\n");
      const counter = panel.querySelector("#ocrmeow-block-count") as HTMLElement | null;
      if (counter) {
        counter.textContent = `BLK: ${selected.length}/${state.items.length}`;
        counter.style.textShadow = "0 0 12px rgba(0,243,255,0.8)";
        setTimeout(() => {
          counter.style.textShadow = "0 0 8px rgba(0,243,255,0.5)";
        }, 300);
      }
    }, 16); // ~1 frame delay
  };

  // --- UI Update Function ---
  const updateUI = () => {
    const isEdit = state.activeTab === "edit";
    btnEdit.classList.toggle("active", isEdit);
    btnFilter.classList.toggle("filter-active", !isEdit);
    textArea.style.display = isEdit ? "block" : "none";
    filterHint.style.display = isEdit ? "none" : "flex";
    if (isEdit) interactionLayer.hide();
    else interactionLayer.show();
  };

  // --- Event Bindings ---
  btnEdit.onclick = () => {
    state.activeTab = "edit";
    updateUI();
  };
  btnFilter.onclick = () => {
    state.activeTab = "filter";
    updateUI();
  };

  copyBtn.onclick = () => {
    navigator.clipboard
      .writeText(textArea.value.trim())
      .then(() => {
        copyBtn.textContent = t.copied;
        setTimeout(() => {
          copyBtn.textContent = t.copyOutput;
        }, 2000);
      })
      .catch((err) => {
        console.error("OCRMeow: Clipboard write failed", err);
        copyBtn.textContent = "❌ ERROR";
        setTimeout(() => {
          copyBtn.textContent = t.copyOutput;
        }, 2000);
      });
  };

  closeBtn.onclick = onClose;

  setupDrag(panel, header);

  syncText();
  updateUI();

  return {
    element: panel,
    textarea: textArea,
    syncText,
    destroy: () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      panel.remove();
    },
  };
}

// ─── Internal Helpers ──────────────────────────────────────────────

function createHeader(accent: string): HTMLDivElement {
  const header = document.createElement("div");
  header.className = "ocrmeow-pad-header";
  header.style.cursor = "move";
  header.style.userSelect = "none";

  const left = document.createElement("div");
  left.className = "ocrmeow-pad-header-left";

  const ledCluster = document.createElement("div");
  ledCluster.className = "ocrmeow-pad-header-leds";
  const ledColors = [accent, "#00ff88", "#ff00ff"];
  ledColors.forEach((color) => {
    const led = document.createElement("div");
    // Just the dynamic parts inline, rest in CSS
    led.style.cssText = `width:6px; height:6px; border-radius:1px; background:${color}; animation:ocrmeow-led-pulse 2s ease-in-out infinite; animation-delay:${Math.random()}s;`;
    ledCluster.appendChild(led);
  });
  left.appendChild(ledCluster);

  const title = document.createElement("div");
  title.className = "ocrmeow-pad-header-title";
  title.textContent = "TERMINAL://DATA_PAD";
  left.appendChild(title);

  const right = document.createElement("div");
  right.className = "ocrmeow-pad-header-version";
  right.textContent = `v0.1.0 // ${new Date().toLocaleTimeString("en-US", { hour12: false })}`;

  header.appendChild(left);
  header.appendChild(right);
  return header;
}

function createToggleBar(): {
  toggleBar: HTMLDivElement;
  btnEdit: HTMLDivElement;
  btnFilter: HTMLDivElement;
} {
  const t = getContentDict();
  const toggleBar = document.createElement("div");
  toggleBar.className = "ocrmeow-pad-togglebar";

  const createBtn = (label: string): HTMLDivElement => {
    const b = document.createElement("div");
    b.textContent = label;
    b.className = "ocrmeow-pad-togglebtn";
    return b;
  };

  const btnEdit = createBtn(t.editTab);
  const btnFilter = createBtn(t.filterTab);
  toggleBar.appendChild(btnEdit);
  toggleBar.appendChild(btnFilter);
  return { toggleBar, btnEdit, btnFilter };
}

function setupDrag(panel: HTMLDivElement, handle: HTMLDivElement): void {
  let dragStartX = 0;
  let dragStartY = 0;

  const onMove = (e: MouseEvent) => {
    panel.style.left = `${e.clientX - dragStartX}px`;
    panel.style.top = `${e.clientY - dragStartY}px`;
  };

  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("blur", onUp);
    panel.style.transition = "transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)";
  };

  handle.onmousedown = (e) => {
    dragStartX = e.clientX - panel.offsetLeft;
    dragStartY = e.clientY - panel.offsetTop;
    panel.style.transition = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onUp);
    e.preventDefault();
  };
}

function generateHexSequence(blockCount: number): string {
  const chunks: string[] = [];
  const seed = blockCount * 0x1f;
  for (let i = 0; i < 12; i++) {
    const val = ((seed + i * 0x3d) & 0xff).toString(16).toUpperCase().padStart(2, "0");
    chunks.push(`0x${val}`);
  }
  return chunks.join(" ");
}

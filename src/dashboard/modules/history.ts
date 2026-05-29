// ─── History Module ────────────────────────────────────────────────
// Result cards (workspace), history list, and lightbox.

import { getHistory } from "../../utils/db";
import { getLang, i18n } from "./i18n";
import { currentSettings } from "./settings";

// ─── Result Card (Workspace) ───────────────────────────────────────

export function addResultCard(
  text: string,
  title: string,
  timeStr: string,
  imageBase64: string,
  elapsedMs: number,
): void {
  const container = document.getElementById("results-container");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "result-card";

  // Header
  const header = document.createElement("div");
  header.className = "result-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "result-header-left";
  headerLeft.innerHTML = `<span>📄 ${title}</span>`;
  if (timeStr) {
    headerLeft.innerHTML += `<span style="color:var(--text-dim);">[${timeStr}]</span>`;
  }
  if (elapsedMs > 0) {
    headerLeft.innerHTML += `<span class="result-timing">${elapsedMs}ms</span>`;
  }

  const headerActions = document.createElement("div");
  headerActions.className = "result-header-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn-primary";
  copyBtn.textContent = "COPY";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(textArea.textContent || "");
    const orig = copyBtn.textContent;
    copyBtn.textContent = i18n[getLang()]["copy-success"];
    setTimeout(() => (copyBtn.textContent = orig), 2000);
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "✕";
  deleteBtn.style.padding = "6px 10px";
  deleteBtn.onclick = () => card.remove();

  headerActions.appendChild(copyBtn);
  headerActions.appendChild(deleteBtn);
  header.appendChild(headerLeft);
  header.appendChild(headerActions);
  card.appendChild(header);

  // Image thumbnail
  if (imageBase64) {
    const imgContainer = document.createElement("div");
    imgContainer.className = "result-image-container";
    const img = document.createElement("img");
    img.className = "result-image";
    img.src = imageBase64;
    img.alt = "OCR Source";
    img.onclick = () => openLightbox(imageBase64);
    imgContainer.appendChild(img);
    card.appendChild(imgContainer);
  }

  // Text content
  const textArea = document.createElement("div");
  textArea.className = "result-text";
  textArea.textContent = text;
  textArea.contentEditable = "true";
  card.appendChild(textArea);

  container.prepend(card);
}

// ─── History View ──────────────────────────────────────────────────

export async function loadHistoryView(): Promise<void> {
  const container = document.getElementById("history-container");
  if (!container) return;

  container.innerHTML = "";

  const limit = parseInt(currentSettings.historyLimit, 10) || 100;
  const historyItems = await getHistory(limit);

  if (historyItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = i18n[getLang()]["empty-history"];
    container.appendChild(empty);
    return;
  }

  for (const item of historyItems) {
    const card = document.createElement("div");
    card.className = "result-card";

    // Header
    const header = document.createElement("div");
    header.className = "result-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "result-header-left";
    const timeStr = new Date(item.timestamp).toLocaleString();
    headerLeft.innerHTML = `<span>📄 ${item.source}</span><span style="color:var(--text-dim);">[${timeStr}]</span>`;

    const headerActions = document.createElement("div");
    headerActions.className = "result-header-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-primary";
    copyBtn.textContent = "COPY";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(item.text);
      copyBtn.textContent = i18n[getLang()]["copy-success"];
      setTimeout(() => (copyBtn.textContent = "COPY"), 2000);
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "✕";
    deleteBtn.style.padding = "6px 10px";
    deleteBtn.onclick = () => card.remove();

    headerActions.appendChild(copyBtn);
    headerActions.appendChild(deleteBtn);
    header.appendChild(headerLeft);
    header.appendChild(headerActions);
    card.appendChild(header);

    // Image
    if (item.image) {
      const imgContainer = document.createElement("div");
      imgContainer.className = "result-image-container";
      const img = document.createElement("img");
      img.className = "result-image";
      img.src = item.image;
      img.alt = "OCR Source";
      img.loading = "lazy";
      img.onclick = () => openLightbox(item.image);
      imgContainer.appendChild(img);
      card.appendChild(imgContainer);
    }

    // Text
    const textEl = document.createElement("div");
    textEl.className = "result-text";
    textEl.textContent = item.text;
    card.appendChild(textEl);

    container.appendChild(card);
  }
}

// ─── Lightbox ──────────────────────────────────────────────────────

export function openLightbox(imageSrc: string): void {
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.onclick = () => overlay.remove();

  const img = document.createElement("img");
  img.src = imageSrc;

  overlay.appendChild(img);
  document.body.appendChild(overlay);

  // ESC to close
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      overlay.remove();
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);
}

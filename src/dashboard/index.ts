// ─── Dashboard Orchestrator ────────────────────────────────────────
// Slim entry point — all business logic lives in ./modules/*.
// This file only imports, wires, and boots.

import {
  IS_WEB_MODE,
  checkBundledModelsExist,
  processOCR,
  checkModelStatus,
  syncSingleModel,
  handleSingleModelImport,
} from "./modules/engine";
import { applyLanguage, getLang } from "./modules/i18n";
import { showModal, showConfirm, showSetupWizard } from "./modules/modals";
import { applyStudioTheme } from "./modules/theme";
import { loadSettings, setupSettingsListeners } from "./modules/settings";
import { loadHistoryView } from "./modules/history";
import { setupDropzone, setupPaste } from "./modules/file-handler";
import { getAsset } from "../utils/db";

// ─── Navigation ────────────────────────────────────────────────────

function setupNavigation(): void {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const targetId = (e.currentTarget as HTMLElement).getAttribute("data-target");
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      (e.currentTarget as HTMLElement).classList.add("active");
      document.querySelectorAll(".view-section").forEach((sec) => sec.classList.remove("active"));
      document.getElementById(`view-${targetId}`)?.classList.add("active");

      // Refresh history when navigating to it
      if (targetId === "history") {
        loadHistoryView();
      }
    });
  });
}

// ─── Boot ──────────────────────────────────────────────────────────

async function initializeModelState(): Promise<void> {
  if (IS_WEB_MODE) {
    const det = await getAsset("det.tar");
    const rec = await getAsset("rec.tar");
    if (!det || !rec) {
      const bundledExist = await checkBundledModelsExist();
      if (bundledExist) {
        await checkModelStatus();
      } else {
        await showSetupWizard();
        await checkModelStatus();
      }
    } else {
      await checkModelStatus();
    }
  } else {
    await checkModelStatus();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (IS_WEB_MODE) {
    const disabledIds = ["setting-theme-action", "setting-distortion"];
    disabledIds.forEach((id) => {
      const el = document.getElementById(id) as
        | HTMLSelectElement
        | HTMLInputElement
        | HTMLButtonElement;
      if (el) {
        el.disabled = true;
        el.style.opacity = "0.4";
        el.style.cursor = "not-allowed";
        el.title = "This feature is only available in the Chrome Extension.";
      }
    });

    const labelIds = ["lbl-theme-action", "lbl-distortion"];
    labelIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent += " [EXTENSION ONLY]";
    });
  }

  setupNavigation();
  setupDropzone(processOCR);
  setupPaste(processOCR);
  setupSettingsListeners({
    applyLanguage,
    applyStudioTheme,
    getLang,
    showModal,
    showConfirm,
    syncSingleModel,
    handleSingleModelImport,
    checkModelStatus,
  });

  Promise.resolve()
    .then(async () => {
      await loadSettings(applyLanguage, applyStudioTheme);
      applyLanguage();
      await loadHistoryView();
      await initializeModelState();
    })
    .catch((err: any) => {
      console.error("OCR Studio: Startup initialization failed", err);
    });
});

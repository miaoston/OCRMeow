// ─── Modal Dialogs Module ──────────────────────────────────────────
// Themed replacements for native alert() and confirm().

import { downloadAndCacheModels, DEFAULT_MODEL_URLS } from "../../utils/models";
import { getLang, i18n } from "./i18n";

/**
 * Show a themed alert modal (replaces native alert()).
 * Returns a Promise that resolves when the user dismisses it.
 */
export function showModal(message: string, title: string = "SYSTEM://NOTICE"): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-scanline"></div>
        <div class="modal-header">
          <div class="modal-led"></div>
          <div class="modal-title">${title}</div>
        </div>
        <div class="modal-body">${message}</div>
        <div class="modal-actions">
          <button class="btn btn-confirm" id="modal-ok">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const dismiss = () => {
      overlay.remove();
      resolve();
    };

    overlay.querySelector("#modal-ok")!.addEventListener("click", dismiss);
    overlay.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape" || (e as KeyboardEvent).key === "Enter") dismiss();
    });
    (overlay.querySelector("#modal-ok") as HTMLElement).focus();
  });
}

/**
 * Show a themed confirm modal (replaces native confirm()).
 * Returns a Promise<boolean> — true if confirmed, false if cancelled.
 */
export function showConfirm(
  message: string,
  confirmText: string = "CONFIRM",
  cancelText: string = "CANCEL",
  destructive: boolean = false,
  title: string = "SYSTEM://CONFIRM",
): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const confirmClass = destructive ? "btn btn-destructive" : "btn btn-confirm";

    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-scanline"></div>
        <div class="modal-header">
          <div class="modal-led" ${destructive ? 'style="background:var(--red);color:var(--red);"' : ""}></div>
          <div class="modal-title" ${destructive ? 'style="color:var(--red);text-shadow:0 0 8px rgba(255,68,85,0.3);"' : ""}>${title}</div>
        </div>
        <div class="modal-body">${message}</div>
        <div class="modal-actions">
          <button class="btn" id="modal-cancel">${cancelText}</button>
          <button class="${confirmClass}" id="modal-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const done = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector("#modal-confirm")!.addEventListener("click", () => done(true));
    overlay.querySelector("#modal-cancel")!.addEventListener("click", () => done(false));
    overlay.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") done(false);
    });
    (overlay.querySelector("#modal-confirm") as HTMLElement).focus();
  });
}

let isWizardActive = false;

/**
 * Show a setup wizard for Web Mode if models are missing.
 */
export function showSetupWizard(): Promise<void> {
  if (isWizardActive) return Promise.resolve();
  isWizardActive = true;

  const isZh = getLang() === "zh";
  const dict = isZh ? i18n.zh : (i18n as any).en;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.backdropFilter = "blur(12px)";

    overlay.innerHTML = `
      <div class="modal-box" style="width: 480px; border-color: var(--magenta); box-shadow: 0 0 40px var(--magenta-dim);">
        <div class="modal-scanline" style="background: linear-gradient(90deg, transparent, var(--magenta-dim), transparent);"></div>
        <div class="modal-header" style="background: rgba(255, 0, 255, 0.05);">
          <div class="modal-led" style="background: var(--magenta); box-shadow: 0 0 10px var(--magenta);"></div>
          <div class="modal-title" style="color: var(--magenta); text-shadow: 0 0 8px var(--magenta-dim);">${dict["wizard-title"]}</div>
        </div>
        <div class="modal-body">
          <div style="font-size: 32px; margin-bottom: 20px;">🐱</div>
          <p style="letter-spacing: 0.5px; line-height: 1.8;">${dict["wizard-desc"]}</p>
          
          <div id="wizard-progress-area" style="display: none; margin-top: 24px;">
            <div style="font-size: 10px; color: var(--magenta); display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span id="wizard-progress-text">${dict["wizard-loading"]}</span>
              <span id="wizard-progress-pct">0%</span>
            </div>
            <div style="width: 100%; height: 4px; background: rgba(255, 0, 255, 0.1); border-radius: 2px; overflow: hidden;">
              <div id="wizard-progress-bar" style="width: 0%; height: 100%; background: var(--magenta); transition: width 0.3s ease;"></div>
            </div>
          </div>
        </div>
        <div class="modal-actions" id="wizard-actions">
          <button class="btn btn-destructive" id="btn-wizard-skip" style="flex: 1; padding: 12px; margin-right: 10px;">
            ${isZh ? "跳过 (手动导入)" : "SKIP (MANUAL IMPORT)"}
          </button>
          <button class="btn btn-confirm" id="btn-wizard-start" style="background: var(--magenta-dim); color: var(--magenta); border-color: var(--magenta); flex: 1; padding: 12px;">
            ${dict["wizard-btn"]}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const btn = overlay.querySelector("#btn-wizard-start") as HTMLButtonElement;
    const skipBtn = overlay.querySelector("#btn-wizard-skip") as HTMLButtonElement;
    const progressArea = overlay.querySelector("#wizard-progress-area") as HTMLElement;
    const progressBar = overlay.querySelector("#wizard-progress-bar") as HTMLElement;
    const progressPct = overlay.querySelector("#wizard-progress-pct") as HTMLElement;

    skipBtn.addEventListener("click", () => {
      overlay.remove();
      isWizardActive = false;
      resolve();
    });

    btn.addEventListener("click", () => {
      btn.style.display = "none";
      skipBtn.style.display = "none";
      progressArea.style.display = "block";

      const progressDivMain = document.getElementById("model-download-progress");
      if (progressDivMain) progressDivMain.style.display = "block";

      downloadAndCacheModels(DEFAULT_MODEL_URLS, (phase, pct) => {
        const isZhLocal = getLang() === "zh";
        let displayPhase = phase;
        if (isZhLocal) {
          if (phase.includes("Detection")) displayPhase = "下载检测模型 (det.tar)...";
          else if (phase.includes("Recognition")) displayPhase = "下载识别模型 (rec.tar)...";
          else if (phase.includes("Done")) displayPhase = "下载完成!";
        }
        // Update both wizard and main progress bars
        const mainBar = document.getElementById("model-progress-bar");
        const mainPct = document.getElementById("model-progress-pct");
        const mainText = document.getElementById("model-progress-text");
        if (mainBar) mainBar.style.width = `${pct}%`;
        if (mainPct) mainPct.textContent = `${pct}%`;
        if (mainText) mainText.textContent = displayPhase;
        progressBar.style.width = `${pct}%`;
        progressPct.textContent = `${pct}%`;
      }).then(() => {
        setTimeout(() => {
          if (progressDivMain) progressDivMain.style.display = "none";
          overlay.remove();
          isWizardActive = false;
          resolve();
        }, 1000);
      });
    });
  });
}

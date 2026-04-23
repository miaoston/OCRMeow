import { CaptureTheme } from "./i18n";

/**
 * Shared Styles — Centralized CSS for content components.
 * This keeps the logic modules clean and allows for easy theme adjustments.
 */

export function getInteractionLayerStyles(theme: CaptureTheme) {
  return `
    #ocrmeow-interaction-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483645;
      pointer-events: none;
      display: none;
    }
    
    @keyframes ocrmeow-breathe {
      0%, 100% { box-shadow: 0 0 10px ${theme.accentDim}; }
      50% { box-shadow: 0 0 22px ${theme.selectionBorder}, 0 0 40px ${theme.accentGhost}; }
    }
    
    .ocrmeow-block {
      position: absolute;
      cursor: pointer;
      pointer-events: auto;
      z-index: 2147483646;
      transition: all 0.15s ease;
      box-sizing: border-box;
      border: 2px solid ${theme.accent};
      background: ${theme.accentDim};
      box-shadow: 0 0 10px ${theme.accentDim};
      animation: ocrmeow-breathe 2.5s ease-in-out infinite;
    }
    
    .ocrmeow-block.excluded {
      border: 1px solid transparent;
      background: rgba(0, 0, 0, 0.8);
      box-shadow: none;
      opacity: 0.4;
      animation: none;
    }
  `;
}

export function getDataPadStyles(theme: CaptureTheme) {
  return `
    #ocrmeow-result-panel {
      position: absolute;
      width: 320px;
      background: rgba(10, 10, 12, 0.9);
      border: 1px solid ${theme.accent};
      color: #fff;
      font-family: 'Fira Code', monospace;
      padding: 0;
      border-radius: 4px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), ${theme.infoGlow};
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      backdrop-filter: blur(15px);
    }
    
    .ocrmeow-pad-header {
      padding: 8px 12px;
      background: ${theme.accentDim};
      border-bottom: 1px solid ${theme.accent};
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1px;
      color: ${theme.accent};
    }
    
    .ocrmeow-pad-body {
      padding: 0;
      flex: 1;
    }
    
    .ocrmeow-pad-textarea {
      width: 100%;
      height: 180px;
      background: transparent;
      border: none;
      color: #fff;
      padding: 12px;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.5;
      resize: none;
      outline: none;
    }
    
    .ocrmeow-pad-actions {
      padding: 8px;
      background: rgba(0, 0, 0, 0.3);
      display: flex;
      gap: 8px;
    }
    
    .ocrmeow-btn {
      flex: 1;
      background: transparent;
      border: 1px solid ${theme.accent};
      color: ${theme.accent};
      padding: 6px;
      font-family: inherit;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .ocrmeow-btn:hover {
      background: ${theme.accentDim};
    }
    
    .ocrmeow-btn.primary {
      background: ${theme.accent};
      color: #000;
    }

    /* Sub-components */
    .ocrmeow-pad-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ocrmeow-pad-header-leds {
      display: flex;
      gap: 5px;
      align-items: center;
    }

    .ocrmeow-pad-header-title {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 2px;
      color: ${theme.accent};
      text-shadow: 0 0 8px ${theme.accent}4d;
    }

    .ocrmeow-pad-header-version {
      font-size: 9px;
      color: rgba(0, 243, 255, 0.35);
      letter-spacing: 1px;
    }

    .ocrmeow-pad-hexbar {
      padding: 4px 20px;
      font-size: 9px;
      font-family: monospace;
      color: rgba(0, 243, 255, 0.2);
      letter-spacing: 3px;
      border-bottom: 1px solid rgba(0, 243, 255, 0.08);
      user-select: none;
    }

    .ocrmeow-pad-togglebar {
      display: flex;
      padding: 12px 20px 8px 20px;
      gap: 8px;
    }

    .ocrmeow-pad-togglebtn {
      flex: 1;
      padding: 10px;
      font-size: 10px;
      font-weight: 900;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 2px;
      letter-spacing: 1.5px;
      user-select: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .ocrmeow-pad-togglebtn:hover {
      background: ${theme.accent}15;
      transform: translateY(-1px);
    }

    .ocrmeow-pad-togglebtn:active {
      transform: translateY(0) scale(0.98);
    }

    .ocrmeow-pad-togglebtn.active {
      background: ${theme.accentDim};
      border-color: ${theme.accent};
      color: ${theme.accent};
    }

    .ocrmeow-pad-togglebtn:not(.active) {
      background: transparent;
      color: rgba(255, 255, 255, 0.3);
    }
    
    .ocrmeow-pad-togglebtn.filter-active {
      background: ${theme.secondary}26;
      border-color: ${theme.secondary};
      color: ${theme.secondary};
    }

    .ocrmeow-pad-mainview {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 10px 20px;
      position: relative;
    }

    .ocrmeow-pad-filterhint {
      flex: 1;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 15px;
      border: 1px dashed ${theme.secondary}33;
      border-radius: 2px;
      position: relative;
    }

    .ocrmeow-pad-filterhint-title {
      font-size: 18px;
      color: ${theme.secondary};
      letter-spacing: 4px;
      font-weight: 900;
    }

    .ocrmeow-pad-filterhint-desc {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.3);
      line-height: 1.8;
      font-family: monospace;
    }

    .ocrmeow-pad-filterhint-meta {
      margin-top: 8px;
      font-size: 9px;
      color: ${theme.secondary}44;
      letter-spacing: 2px;
    }

    .ocrmeow-pad-statusbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 20px;
      border-top: 1px solid rgba(0, 243, 255, 0.1);
      font-size: 9px;
      font-family: monospace;
      color: rgba(0, 243, 255, 0.25);
      user-select: none;
    }

    .ocrmeow-pad-actionbar {
      display: flex;
      gap: 10px;
      padding: 12px 20px 16px 20px;
    }

    .ocrmeow-pad-copybtn {
      flex: 1;
      padding: 12px;
      background: ${theme.accentDim};
      color: ${theme.accent};
      border: 1px solid ${theme.accent};
      font-weight: 900;
      font-size: 11px;
      letter-spacing: 1px;
      font-family: monospace;
      border-radius: 2px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .ocrmeow-pad-copybtn:hover {
      background: ${theme.accent}33;
      box-shadow: 0 4px 15px ${theme.accentDim};
      transform: translateY(-2px);
    }

    .ocrmeow-pad-copybtn:active {
      transform: translateY(0) scale(0.98);
    }

    .ocrmeow-pad-closebtn {
      padding: 12px 20px;
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 11px;
      font-weight: bold;
      font-family: monospace;
      border-radius: 2px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .ocrmeow-pad-closebtn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.4);
      transform: translateY(-2px);
    }

    .ocrmeow-pad-closebtn:active {
      transform: translateY(0) scale(0.98);
    }
    
    .ocrmeow-scanline {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, transparent, rgba(0, 243, 255, 0.12), transparent);
      z-index: 1;
      pointer-events: none;
      animation: ocrmeow-scanline 4s linear infinite;
    }
  `;
}

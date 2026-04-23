import { saveHistory } from "../utils/db";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || tab.url.startsWith("chrome://")) return;

  // Optimistic capture IMMEDIATELY on click to eliminate IPC latency
  chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
    chrome.tabs
      .sendMessage(tab.id!, { action: "PING" })
      .then(() => {
        chrome.tabs.sendMessage(tab.id!, { action: "START_SELECTION", payload: { dataUrl } });
        chrome.action.setBadgeText({ text: "ON", tabId: tab.id });
      })
      .catch((err: any) => {
        if (err.message?.includes("Could not establish connection")) {
          console.error("OCRMeow: Content script not ready. Please refresh the page.");
        }
        // Non-connection errors bubble up naturally
      });
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "open-dashboard",
      title: "🐱 Open OCRMeow Studio",
      contexts: ["action"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-dashboard") {
    chrome.tabs.create({ url: "dashboard.html" });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "CAPTURE_TAB") {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }

  if (message.action === "OCR_REQUEST") {
    handleOCRRequest(message.payload).then((res) => sendResponse(res));
    return true;
  }

  if (message.action === "SELECTION_DONE") {
    chrome.action.setBadgeText({ text: "", tabId: sender.tab?.id });
    sendResponse({});
    return false;
  }

  if (message.action === "BROADCAST_DOWNLOADING") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "OCR_AUTO_DOWNLOADING" }).catch(() => {});
      }
    });
    return false;
  }
});

/**
 * Send OCR request to offscreen document with retry logic.
 * Uses recursive Promise chaining instead of try-catch to comply with project rules.
 */
async function handleOCRRequest(payload: any) {
  await setupOffscreen();

  const response = await sendWithRetry(payload, 5);
  if (!response) throw new Error("OCR_ENGINE_CONNECTION_FAILED");

  // Save to history automatically
  if (response && response.items && response.items.length > 0) {
    const text = response.items.map((it: any) => it.text).join("\n");
    const settings: any = await chrome.storage.local.get("ocrSettings");
    const limit = settings.ocrSettings?.historyLimit
      ? parseInt(settings.ocrSettings.historyLimit, 10)
      : 100;
    await saveHistory(text, payload.image, "Direct Capture", limit);
  }

  return response;
}

function sendWithRetry(payload: any, retries: number): Promise<any> {
  return chrome.runtime
    .sendMessage({
      target: "offscreen",
      action: "RUN_OCR",
      payload,
    })
    .then(
      (response) => response,
      (err: any) => {
        const isTransient =
          err.message?.includes("Could not establish connection") ||
          err.message?.includes("Receiving end does not exist");
        if (isTransient && retries > 1) {
          console.warn(`Bridge: Offscreen not ready, retrying... (${retries - 1} left)`);
          return new Promise((r) => setTimeout(r, 200)).then(() =>
            sendWithRetry(payload, retries - 1),
          );
        }
        if (isTransient) return null; // Exhausted retries
        throw err; // Real error — let it bubble
      },
    );
}

let creating: Promise<void> | null = null;
async function setupOffscreen() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  // @ts-ignore
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });

  if (contexts.length > 0) return;

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "OCR Engine",
    });
    await creating;
    creating = null;
  }
}

import { getAsset } from "../utils/db";
import { downloadAndCacheModels } from "../utils/models";

const sandbox = document.getElementById("sandbox") as HTMLIFrameElement;
const pendingRequests = new Map<string, (res: any) => void>();
let modelsReady = false;

// Helper to try loading models from IndexedDB or bundled fallback
async function tryGetModels() {
  let detBlob = await getAsset("det.tar");
  let recBlob = await getAsset("rec.tar");

  if (!detBlob || !recBlob) {
    // Fallback: Check if models were bundled inside the extension package
    const dRes = await fetch("/models/det.tar").catch(() => null);
    const rRes = await fetch("/models/rec.tar").catch(() => null);

    if (dRes && rRes && dRes.ok && rRes.ok) {
      detBlob = await dRes.blob();
      recBlob = await rRes.blob();
    }
  }
  return { detBlob, recBlob };
}

// Wait for iframe to load, then send config
sandbox.onload = async () => {
  const { detBlob, recBlob } = await tryGetModels();

  if (detBlob && recBlob) {
    modelsReady = true;
    sandbox.contentWindow?.postMessage(
      {
        action: "INIT_CONFIG",
        payload: {
          detBlob: detBlob,
          recBlob: recBlob,
          wasmPath: chrome.runtime.getURL("/wasm/"),
        },
      },
      "*",
    );
  } else {
    // Just send wasmPath first, models will be sent when needed
    sandbox.contentWindow?.postMessage(
      {
        action: "INIT_CONFIG",
        payload: {
          wasmPath: chrome.runtime.getURL("/wasm/"),
        },
      },
      "*",
    );
  }
};

async function checkAndLoadModels(): Promise<boolean> {
  if (modelsReady) return true;
  let { detBlob, recBlob } = await tryGetModels();

  if (!detBlob || !recBlob) {
    // Notify the user via content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "OCR_AUTO_DOWNLOADING" }).catch(() => {});
      }
    });

    const blobs = await downloadAndCacheModels().catch((err) => {
      console.error("OCRMeow Bridge: Auto-download failed:", err);
      return null;
    });
    if (blobs) {
      detBlob = blobs.detBlob;
      recBlob = blobs.recBlob;
    }
  }

  if (detBlob && recBlob) {
    modelsReady = true;
    sandbox.contentWindow?.postMessage(
      {
        action: "INIT_CONFIG",
        payload: {
          detBlob: detBlob,
          recBlob: recBlob,
          wasmPath: chrome.runtime.getURL("/wasm/"),
        },
      },
      "*",
    );
    // Wait briefly to allow sandbox initialization to begin
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }
  return false;
}

// Listen for messages from Worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target === "offscreen" && message.action === "RUN_OCR") {
    (async () => {
      const ready = await checkAndLoadModels();
      if (!ready) {
        sendResponse({ error: "MODELS_MISSING" });
        return;
      }

      const requestId = Math.random().toString(36).substring(2);
      pendingRequests.set(requestId, sendResponse);

      sandbox.contentWindow?.postMessage(
        {
          action: "RUN_OCR",
          payload: message.payload,
          requestId,
        },
        "*",
      );
    })();

    return true; // Keep channel open for async response
  }
});

// Listen for results from Sandbox
window.addEventListener("message", (event) => {
  const { action, payload, requestId, error } = event.data;
  if (action === "OCR_RESULT") {
    const sendResponse = pendingRequests.get(requestId);
    if (sendResponse) {
      if (error) {
        sendResponse({ error });
      } else {
        sendResponse(payload);
      }
      pendingRequests.delete(requestId);
    }
  }
});

import { getAsset } from "../utils/db";
import { downloadAndCacheModels } from "../utils/models";

let modelsReady = false;
let detBlob: Blob | null = null;
let recBlob: Blob | null = null;

// Helper to try loading models from IndexedDB or bundled fallback
async function tryGetModels() {
  let d = await getAsset("det.tar");
  let r = await getAsset("rec.tar");

  if (!d || !r) {
    const dRes = await fetch("/models/det.tar").catch(() => null);
    const rRes = await fetch("/models/rec.tar").catch(() => null);

    if (dRes && rRes && dRes.ok && rRes.ok) {
      d = await dRes.blob();
      r = await rRes.blob();
    }
  }
  return { detBlob: d, recBlob: r };
}

async function checkAndLoadModels(): Promise<boolean> {
  if (modelsReady) return true;
  const blobs = await tryGetModels();
  detBlob = blobs.detBlob;
  recBlob = blobs.recBlob;

  if (!detBlob || !recBlob) {
    chrome.runtime.sendMessage({ action: "BROADCAST_DOWNLOADING" }).catch(() => {});
    const downloaded = await downloadAndCacheModels().catch((err) => {
      console.error("OCRMeow Bridge: Auto-download failed:", err);
      return null;
    });
    if (downloaded) {
      detBlob = downloaded.detBlob;
      recBlob = downloaded.recBlob;
    }
  }

  if (detBlob && recBlob) {
    modelsReady = true;
    const sandbox = document.getElementById("ocr-sandbox") as HTMLIFrameElement;
    if (sandbox) {
      const sendInit = () => {
        sandbox.contentWindow?.postMessage(
          {
            action: "INIT_CONFIG",
            payload: {
              detBlob,
              recBlob,
              wasmPath: "wasm/",
            },
          },
          "*",
        );
      };
      // Send immediately (iframe likely already loaded) + onload fallback for safety
      sendInit();
      sandbox.onload = sendInit;
    }
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

      const sandbox = document.getElementById("ocr-sandbox") as HTMLIFrameElement;
      if (!sandbox) {
        sendResponse({ error: "Sandbox iframe not found in offscreen document" });
        return;
      }

      const requestId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        if (event.data.action === "OCR_RESULT" && event.data.requestId === requestId) {
          window.removeEventListener("message", listener);
          if (event.data.error) {
            sendResponse({ error: event.data.error });
          } else {
            sendResponse(event.data.payload);
          }
        }
      };

      window.addEventListener("message", listener);
      sandbox.contentWindow?.postMessage(
        {
          action: "RUN_OCR",
          requestId,
          payload: { image: message.payload.image },
        },
        "*",
      );
    })();

    return true; // Keep channel open for async response
  }
});

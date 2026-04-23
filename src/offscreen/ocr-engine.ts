import { getAsset } from "../utils/db";
import { downloadAndCacheModels } from "../utils/models";
// @ts-ignore
import { PaddleOCR } from "@paddleocr/paddleocr-js";

let modelsReady = false;

let ocrInstance: any = null;
let modelUrls: { det: string; rec: string } | null = null;
let wasmPath: string = chrome.runtime.getURL("/wasm/");

async function initOCR() {
  if (ocrInstance) return ocrInstance;

  ocrInstance = await PaddleOCR.create({
    textDetectionModelName: "PP-OCRv5_mobile_det",
    textDetectionModelAsset: {
      url: modelUrls!.det,
    },
    textRecognitionModelName: "PP-OCRv5_mobile_rec",
    textRecognitionModelAsset: {
      url: modelUrls!.rec,
    },
    ortOptions: {
      backend: "wasm",
      wasmPaths: wasmPath,
      numThreads: 1,
    },
    worker: false,
  });
  return ocrInstance;
}

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

async function checkAndLoadModels(): Promise<boolean> {
  if (modelsReady) return true;
  let { detBlob, recBlob } = await tryGetModels();

  if (!detBlob || !recBlob) {
    // Notify the user via content script
    chrome.runtime.sendMessage({ action: "BROADCAST_DOWNLOADING" }).catch(() => {});

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
    // Revoke stale Blob URLs before creating new ones to prevent memory accumulation
    if (modelUrls) {
      URL.revokeObjectURL(modelUrls.det);
      URL.revokeObjectURL(modelUrls.rec);
      // Reset instance so it re-initializes with the new model URLs
      ocrInstance = null;
    }
    modelUrls = {
      det: URL.createObjectURL(detBlob),
      rec: URL.createObjectURL(recBlob),
    };
    modelsReady = true;
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

      initOCR()
        .then(async (ocr) => {
          const response = await fetch(message.payload.image);
          const blob = await response.blob();
          const results = await ocr.predict(blob);
          sendResponse(results[0]);
        })
        .catch((error: any) => {
          console.error("OCRMeow Offscreen OCR Error:", error);
          sendResponse({ error: error.message || "Unknown OCR Error" });
        });
    })();

    return true; // Keep channel open for async response
  }
});

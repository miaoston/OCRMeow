// @ts-ignore
import { PaddleOCR } from "@paddleocr/paddleocr-js";

let ocrInstance: any = null;

// Sandbox doesn't have access to chrome.* APIs directly.
// We get the URLs from the parent message.
let modelUrls: { det: string; rec: string } | null = null;
const wasmPath = new URL("wasm/", window.location.href).href;
const OCR_INIT_TIMEOUT_MS = 180000;
const OCR_PREDICT_TIMEOUT_MS = 120000;

function withTimeout<T>(task: Promise<T>, timeoutMs: number, errorCode: string): Promise<T> {
  let timeoutId = 0;
  return Promise.race([
    task,
    new Promise<T>((_resolve, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(errorCode)), timeoutMs);
    }),
  ]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

async function initOCR() {
  if (ocrInstance) return ocrInstance;
  if (!modelUrls) throw new Error("OCR_MODELS_NOT_READY");

  ocrInstance = await withTimeout(
    PaddleOCR.create({
      textDetectionModelName: "PP-OCRv5_mobile_det",
      textDetectionModelAsset: {
        url: modelUrls.det,
      },
      textRecognitionModelName: "PP-OCRv5_mobile_rec",
      textRecognitionModelAsset: {
        url: modelUrls.rec,
      },
      ortOptions: {
        backend: "wasm",
        wasmPaths: wasmPath,
        numThreads: 1,
      },
      worker: false,
    }),
    OCR_INIT_TIMEOUT_MS,
    "OCR_ENGINE_INIT_TIMEOUT",
  );
  return ocrInstance;
}

window.addEventListener("message", async (event) => {
  const { action, payload, requestId } = event.data;

  if (action === "INIT_CONFIG") {
    if (payload.detBlob && payload.recBlob) {
      // Revoke stale Blob URLs before creating new ones to prevent memory accumulation
      if (modelUrls) {
        URL.revokeObjectURL(modelUrls.det);
        URL.revokeObjectURL(modelUrls.rec);
        // Reset instance so it re-initializes with the new model URLs
        ocrInstance = null;
      }
      modelUrls = {
        det: URL.createObjectURL(payload.detBlob),
        rec: URL.createObjectURL(payload.recBlob),
      };
    } else {
      modelUrls = null;
    }
    return;
  }

  if (action === "RUN_OCR") {
    initOCR()
      .then(async (ocr) => {
        const response = await fetch(payload.image);
        const blob = await response.blob();
        const results = await withTimeout<any[]>(
          ocr.predict(blob),
          OCR_PREDICT_TIMEOUT_MS,
          "OCR_ENGINE_PREDICT_TIMEOUT",
        );
        window.parent.postMessage(
          {
            action: "OCR_RESULT",
            payload: results[0],
            requestId,
          },
          "*",
        );
      })
      .catch((error: any) => {
        console.error("OCRMeow Sandbox OCR Error:", error);
        window.parent.postMessage(
          {
            action: "OCR_RESULT",
            error: error.message || String(error),
            requestId,
          },
          "*",
        );
      });
  }
});

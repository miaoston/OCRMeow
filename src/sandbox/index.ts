// @ts-ignore
import { PaddleOCR } from "@paddleocr/paddleocr-js";

let ocrInstance: any = null;

// Sandbox doesn't have access to chrome.* APIs directly.
// We get the URLs from the parent message.
let modelUrls: { det: string; rec: string } | null = null;
let wasmPath: string = "";

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
    wasmPath = payload.wasmPath;
    return;
  }

  if (action === "RUN_OCR") {
    console.log("OCRMeow Sandbox: Starting OCR Prediction...");
    initOCR()
      .then(async (ocr) => {
        console.log("OCRMeow Sandbox: Engine Ready. Fetching Image...");
        const response = await fetch(payload.image);
        const blob = await response.blob();
        console.log("OCRMeow Sandbox: Running Prediction...");
        const results = await ocr.predict(blob);
        console.log("OCRMeow Sandbox: Prediction Success.");
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

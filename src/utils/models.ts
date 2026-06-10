import { saveAsset, getAsset } from "./db";

type ProgressReporter = (phase: string, pct: number) => void;

export const DEFAULT_MODEL_URLS = {
  det: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx.tar",
  rec: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx.tar",
};

export const BACKUP_MODEL_URLS = {
  det: "https://github.com/miaoston/OCRMeow/releases/download/models/PP-OCRv5_mobile_det_onnx.tar",
  rec: "https://github.com/miaoston/OCRMeow/releases/download/models/PP-OCRv5_mobile_rec_onnx.tar",
};

/**
 * Fetch with timeout and fallback logic.
 */
async function fetchWithFallback(
  primaryUrl: string,
  backupUrl: string,
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const primaryRes = await fetch(primaryUrl, { signal: controller.signal })
    .then((res) => {
      clearTimeout(timeoutId);
      return res;
    })
    .catch(() => null);

  if (primaryRes && primaryRes.ok) return primaryRes;

  console.warn(`Primary fetch failed or timed out for ${primaryUrl}, falling back to ${backupUrl}`);

  const backupRes = await fetch(backupUrl);
  if (!backupRes.ok) throw new Error(`Failed to fetch from both primary and backup URLs.`);
  return backupRes;
}

async function responseToBlobWithProgress(
  response: Response,
  phase: string,
  startPct: number,
  endPct: number,
  onProgress?: ProgressReporter,
): Promise<Blob> {
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body || total <= 0) {
    const blob = await response.blob();
    if (onProgress) onProgress(phase, endPct);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      const chunk = result.value.buffer.slice(
        result.value.byteOffset,
        result.value.byteOffset + result.value.byteLength,
      ) as ArrayBuffer;
      chunks.push(chunk);
      received += result.value.byteLength;
      const fraction = Math.min(received / total, 1);
      const pct = Math.round(startPct + (endPct - startPct) * fraction);
      if (onProgress) onProgress(phase, pct);
    }
  }

  return new Blob(chunks, {
    type: response.headers.get("content-type") || "application/octet-stream",
  });
}

/**
 * Download and cache models to IndexedDB
 */
export async function downloadAndCacheModels(
  urls = DEFAULT_MODEL_URLS,
  onProgress?: ProgressReporter,
) {
  const detUrl = urls.det || DEFAULT_MODEL_URLS.det;
  const recUrl = urls.rec || DEFAULT_MODEL_URLS.rec;

  const detBackupUrl = BACKUP_MODEL_URLS.det;
  const recBackupUrl = BACKUP_MODEL_URLS.rec;

  if (onProgress) onProgress("Downloading Detection Model...", 2);
  const detRes = await fetchWithFallback(detUrl, detBackupUrl);
  const detBlob = await responseToBlobWithProgress(
    detRes,
    "Downloading Detection Model...",
    2,
    32,
    onProgress,
  );
  await saveAsset("det.tar", detBlob);

  if (onProgress) onProgress("Downloading Recognition Model...", 36);
  const recRes = await fetchWithFallback(recUrl, recBackupUrl);
  const recBlob = await responseToBlobWithProgress(
    recRes,
    "Downloading Recognition Model...",
    36,
    96,
    onProgress,
  );
  await saveAsset("rec.tar", recBlob);

  if (onProgress) onProgress("Done!", 100);
  return { detBlob, recBlob };
}

/**
 * Download and cache a single model to IndexedDB
 */
export async function downloadSingleModel(type: "det" | "rec", onProgress?: ProgressReporter) {
  const url = type === "det" ? DEFAULT_MODEL_URLS.det : DEFAULT_MODEL_URLS.rec;
  const backupUrl = type === "det" ? BACKUP_MODEL_URLS.det : BACKUP_MODEL_URLS.rec;
  const filename = `${type}.tar`;
  const label = type === "det" ? "Detection" : "Recognition";

  if (onProgress) onProgress(`Downloading ${label} Model...`, 5);
  const res = await fetchWithFallback(url, backupUrl);
  const blob = await responseToBlobWithProgress(
    res,
    `Downloading ${label} Model...`,
    5,
    96,
    onProgress,
  );
  await saveAsset(filename, blob);
  if (onProgress) onProgress("Done!", 100);
  return blob;
}

/**
 * Check if models exist in IndexedDB
 */
export async function areModelsCached() {
  const det = await getAsset("det.tar");
  const rec = await getAsset("rec.tar");
  return !!(det && rec);
}

import { saveAsset, getAsset } from "./db";

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

/**
 * Download and cache models to IndexedDB
 */
export async function downloadAndCacheModels(
  urls = DEFAULT_MODEL_URLS,
  onProgress?: (phase: string, pct: number) => void,
) {
  const detUrl = urls.det || DEFAULT_MODEL_URLS.det;
  const recUrl = urls.rec || DEFAULT_MODEL_URLS.rec;

  const detBackupUrl = BACKUP_MODEL_URLS.det;
  const recBackupUrl = BACKUP_MODEL_URLS.rec;

  if (onProgress) onProgress("Downloading Detection Model...", 10);
  const detRes = await fetchWithFallback(detUrl, detBackupUrl);
  const detBlob = await detRes.blob();
  await saveAsset("det.tar", detBlob);

  if (onProgress) onProgress("Downloading Recognition Model...", 50);
  const recRes = await fetchWithFallback(recUrl, recBackupUrl);
  const recBlob = await recRes.blob();
  await saveAsset("rec.tar", recBlob);

  if (onProgress) onProgress("Done!", 100);
  return { detBlob, recBlob };
}

/**
 * Download and cache a single model to IndexedDB
 */
export async function downloadSingleModel(
  type: "det" | "rec",
  onProgress?: (phase: string, pct: number) => void,
) {
  const url = type === "det" ? DEFAULT_MODEL_URLS.det : DEFAULT_MODEL_URLS.rec;
  const backupUrl = type === "det" ? BACKUP_MODEL_URLS.det : BACKUP_MODEL_URLS.rec;
  const filename = `${type}.tar`;
  const label = type === "det" ? "Detection" : "Recognition";

  if (onProgress) onProgress(`Downloading ${label} Model...`, 15);
  const res = await fetchWithFallback(url, backupUrl);
  const blob = await res.blob();
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

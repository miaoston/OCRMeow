import { saveAsset, getAsset } from "./db";

export const DEFAULT_MODEL_URLS = {
  det: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx.tar",
  rec: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx.tar",
};

/**
 * Download and cache models to IndexedDB
 */
export async function downloadAndCacheModels(
  urls = DEFAULT_MODEL_URLS,
  onProgress?: (phase: string, pct: number) => void,
) {
  const detUrl = urls.det || DEFAULT_MODEL_URLS.det;
  const recUrl = urls.rec || DEFAULT_MODEL_URLS.rec;

  if (onProgress) onProgress("Downloading Detection Model...", 10);
  const detRes = await fetch(detUrl);
  if (!detRes.ok) throw new Error(`Failed to fetch det.tar from ${detUrl}`);
  const detBlob = await detRes.blob();
  await saveAsset("det.tar", detBlob);

  if (onProgress) onProgress("Downloading Recognition Model...", 50);
  const recRes = await fetch(recUrl);
  if (!recRes.ok) throw new Error(`Failed to fetch rec.tar from ${recUrl}`);
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
  const filename = `${type}.tar`;
  const label = type === "det" ? "Detection" : "Recognition";

  if (onProgress) onProgress(`Downloading ${label} Model...`, 15);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${filename} from ${url}`);
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

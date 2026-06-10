import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const publicModelsDir = path.join(rootDir, "public", "models");
const publicWasmDir = path.join(rootDir, "public", "wasm");
const tempModelsDir = path.join(rootDir, "models_temp");
const tempWasmDir = path.join(rootDir, "wasm_temp");
const ortRuntimeDir = path.join(rootDir, "node_modules", "onnxruntime-web", "dist");
const requiredOrtRuntimeFiles = [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function recoverStaleHiddenDir(publicDir, tempDir) {
  if (!fs.existsSync(publicDir) && fs.existsSync(tempDir)) {
    fs.renameSync(tempDir, publicDir);
  }
}

function hidePublicDir(publicDir, tempDir) {
  if (!fs.existsSync(publicDir)) {
    return false;
  }
  cleanDir(tempDir);
  fs.renameSync(publicDir, tempDir);
  return true;
}

function restorePublicDir(publicDir, tempDir, hidden) {
  if (!hidden) {
    return;
  }
  fs.renameSync(tempDir, publicDir);
}

function copyMinimalOrtRuntime() {
  const distWasmDir = path.join(distDir, "wasm");
  fs.mkdirSync(distWasmDir, { recursive: true });

  for (const file of requiredOrtRuntimeFiles) {
    const source = path.join(ortRuntimeDir, file);
    const target = path.join(distWasmDir, file);
    fs.copyFileSync(source, target);
  }
}

function pruneBundledOrtFallbackWasm() {
  const assetsDir = path.join(distDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    return;
  }

  for (const file of fs.readdirSync(assetsDir)) {
    if (/^ort-wasm-.*\.wasm$/.test(file)) {
      fs.rmSync(path.join(assetsDir, file), { force: true });
    }
  }
}

async function run() {
  console.log("🚀 Starting OCRMeow Build Pipeline (Lean Only)...");

  // 1. Clean previous build outputs
  cleanDir(distDir);
  cleanDir(path.join(rootDir, "dist-lean"));
  cleanDir(path.join(rootDir, "dist-bundled"));

  // 2. Hide heavyweight public payloads before Vite copies public/ into dist/
  recoverStaleHiddenDir(publicModelsDir, tempModelsDir);
  recoverStaleHiddenDir(publicWasmDir, tempWasmDir);
  const modelsHidden = hidePublicDir(publicModelsDir, tempModelsDir);
  const wasmHidden = hidePublicDir(publicWasmDir, tempWasmDir);

  try {
    execSync("npx vite build", { stdio: "inherit" });
    copyMinimalOrtRuntime();
    pruneBundledOrtFallbackWasm();
    console.log("✅ Success: dist/ generated successfully (Lean Only)!");
  } finally {
    // Always restore local developer assets after packaging.
    restorePublicDir(publicWasmDir, tempWasmDir, wasmHidden);
    restorePublicDir(publicModelsDir, tempModelsDir, modelsHidden);
  }

  console.log(
    "\n🎉 OCRMeow build complete! Outputs generated in dist/ (no models, minimal ORT runtime bundled).",
  );
}

run();

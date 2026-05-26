import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const publicModelsDir = path.join(rootDir, "public", "models");
const tempModelsDir = path.join(rootDir, "public", "models_temp");

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function run() {
  console.log("🚀 Starting OCRMeow Dual-Build Pipeline...");

  const hasModels =
    fs.existsSync(path.join(publicModelsDir, "det.tar")) &&
    fs.existsSync(path.join(publicModelsDir, "rec.tar"));

  // 1. Clean previous build outputs
  cleanDir(path.join(rootDir, "dist-lean"));
  cleanDir(path.join(rootDir, "dist-bundled"));
  cleanDir(path.join(rootDir, "dist"));

  // 2. BUILD LEAN VERSION
  console.log("\n📦 Phase 1: Building LEAN version (No Models)...");
  let modelsHidden = false;
  if (fs.existsSync(publicModelsDir)) {
    fs.renameSync(publicModelsDir, tempModelsDir);
    modelsHidden = true;
  }

  try {
    execSync("npx vite build", { stdio: "inherit" });
    fs.renameSync(path.join(rootDir, "dist"), path.join(rootDir, "dist-lean"));
    console.log("✅ Success: dist-lean/ generated successfully!");
  } finally {
    // Always restore models folder to prevent losing assets if build crashes
    if (modelsHidden) {
      fs.renameSync(tempModelsDir, publicModelsDir);
    }
  }

  // 3. BUILD BUNDLED VERSION (if models are available)
  if (hasModels) {
    console.log("\n📦 Phase 2: Building BUNDLED version (With Models)...");
    execSync("npx vite build", { stdio: "inherit" });
    fs.renameSync(path.join(rootDir, "dist"), path.join(rootDir, "dist-bundled"));
    console.log("✅ Success: dist-bundled/ generated successfully!");

    // 4. Copy dist-bundled to dist for default test/developer usage
    console.log("\n🚚 Copying dist-bundled/ to dist/ for default runtime compatibility...");
    copyDir(path.join(rootDir, "dist-bundled"), path.join(rootDir, "dist"));
  } else {
    console.log("\n⚠️ Warning: Local model assets not found in public/models/.");
    console.log("Skipping BUNDLED build phase. Only dist-lean/ has been generated.");

    // Copy dist-lean to dist as default fallback
    console.log("\n🚚 Copying dist-lean/ to dist/ for default runtime compatibility...");
    copyDir(path.join(rootDir, "dist-lean"), path.join(rootDir, "dist"));
  }

  console.log("\n🎉 OCRMeow Pipeline complete! Outputs generated in:");
  console.log("   - [Lean]    dist-lean/ (无自带模型，弹窗引导下载)");
  if (hasModels) {
    console.log("   - [Bundled] dist-bundled/ (自带模型，完全离线即用)");
  }
  console.log("   - [Default] dist/ (默认兼容，用于自动化测试)");
}

run();

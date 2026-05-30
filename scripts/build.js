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

async function run() {
  console.log("🚀 Starting OCRMeow Build Pipeline (Lean Only)...");

  // 1. Clean previous build outputs
  cleanDir(path.join(rootDir, "dist"));
  cleanDir(path.join(rootDir, "dist-lean"));
  cleanDir(path.join(rootDir, "dist-bundled"));

  // 2. Hide models directory to ensure it is never bundled in dist/
  let modelsHidden = false;
  if (fs.existsSync(publicModelsDir)) {
    fs.renameSync(publicModelsDir, tempModelsDir);
    modelsHidden = true;
  }

  try {
    execSync("npx vite build", { stdio: "inherit" });
    console.log("✅ Success: dist/ generated successfully (Lean Only)!");
  } finally {
    // Always restore models folder to preserve developer environment
    if (modelsHidden) {
      fs.renameSync(tempModelsDir, publicModelsDir);
    }
  }

  console.log("\n🎉 OCRMeow build complete! Outputs generated in dist/ (no models bundled).");
}

run();

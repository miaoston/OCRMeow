import puppeteer from "puppeteer-core";
import sirv from "sirv";
import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";

const TEST_MODEL_URLS = {
  "det.tar":
    "https://github.com/miaoston/OCRMeow/releases/download/models/PP-OCRv5_mobile_det_onnx.tar",
  "rec.tar":
    "https://github.com/miaoston/OCRMeow/releases/download/models/PP-OCRv5_mobile_rec_onnx.tar",
};

function findChrome() {
  try {
    const npxPath = execSync("npx puppeteer browsers bin chrome", { stdio: "pipe" })
      .toString()
      .trim();
    if (npxPath) return npxPath;
  } catch {}

  const paths = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ];

  for (const p of paths) {
    try {
      if (execSync(`ls "${p}"`, { stdio: "pipe" }).toString().trim()) return p;
    } catch {}
  }

  try {
    const whichPath = execSync(
      "which google-chrome || which google-chrome-stable || which chromium-browser || which chromium",
      { stdio: "pipe" },
    )
      .toString()
      .trim();
    if (whichPath) return whichPath;
  } catch {}

  return null;
}

async function ensureModelFile(filename) {
  const localPath = path.resolve("public/models", filename);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1024 * 1024) {
    return localPath;
  }

  const cacheDir = path.join(os.tmpdir(), "ocrmeow-test-models");
  const cachedPath = path.join(cacheDir, filename);
  if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 1024 * 1024) {
    return cachedPath;
  }

  const url = TEST_MODEL_URLS[filename];
  console.log(`🚀 Downloading CI model fixture ${filename} from GitHub Releases...`);
  fs.mkdirSync(cacheDir, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${filename}: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length <= 1024 * 1024) {
    throw new Error(`Downloaded ${filename} is unexpectedly small (${buffer.length} bytes).`);
  }
  fs.writeFileSync(cachedPath, buffer);
  return cachedPath;
}

async function runTest() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error("❌ ERROR: Chrome not found.");
    process.exit(1);
  }

  console.log("🚀 Building project for production-like testing...");
  try {
    execSync("npm run build", {
      stdio: "inherit",
      env: { ...process.env, OCRMEOW_INCLUDE_EASTER_EGG: "1" },
    });
  } catch {
    console.error("❌ Build failed!");
    process.exit(1);
  }

  console.log("🚀 Verifying build directories for models leakage...");
  if (
    fs.existsSync(path.resolve("dist/models")) ||
    fs.existsSync(path.resolve("dist/models_temp")) ||
    fs.existsSync(path.resolve("dist/wasm/ort-wasm-simd-threaded.asyncify.wasm")) ||
    fs.existsSync(path.resolve("dist/wasm/ort-wasm-simd-threaded.jspi.wasm")) ||
    fs.existsSync(path.resolve("dist/wasm/ort-wasm-simd-threaded.wasm")) ||
    fs.existsSync(path.resolve("dist/wasm/ort-wasm-simd.wasm")) ||
    fs.existsSync(path.resolve("dist/wasm/ort-wasm.wasm")) ||
    fs.readdirSync(path.resolve("dist/assets")).some((file) => /^ort-wasm-.*\.wasm$/.test(file))
  ) {
    console.error(
      "❌ FAILED: Package leakage detected! models or unused ORT wasm variants exist inside dist/.",
    );
    process.exit(1);
  }
  console.log("🎉 SUCCESS: No model files leaked into dist/!");

  // Serve the dist directory
  const assets = sirv("dist", { dev: true });
  const server = http.createServer((req, res) => {
    assets(req, res);
  });

  server.listen(15173);
  console.log("✅ Production-like server started on http://localhost:15173");

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(60000);

  page.on("console", (msg) => {
    console.log(`[BROWSER] ${msg.text()}`);
  });

  page.on("requestfailed", (request) => {
    console.error(`[FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      console.error(`[HTTP ${response.status()}] ${response.url()}`);
    }
  });

  console.log("🚀 Navigating to the Easter Egg Test Page...");
  // In dist, the file should be at /easter_egg_test.html
  await page.goto("http://localhost:15173/easter_egg_test.html", { waitUntil: "load" });

  console.log("🚀 Waiting for OCR completion...");

  try {
    const result = await page.waitForSelector("#test-result", { timeout: 180000 });
    const text = await page.evaluate((el) => el.textContent, result);

    if (text !== "PASS") {
      console.error(`❌ FAILED: Easter Egg Test did not pass. Status: ${text}`);
      await browser.close();
      server.close();
      process.exit(1);
    }
    console.log("🎉 SUCCESS: Easter Egg OCR Test Passed!");

    // TEST STEP 2: Navigating to Open OCRMeow Studio dashboard
    console.log("🚀 Test Step 2: Navigating to Open OCRMeow Studio dashboard...");
    await page.goto("http://localhost:15173/index.html", { waitUntil: "load" });

    // Close the welcome setup wizard if it appears
    const welcomeModal = await page
      .waitForSelector(".modal-overlay", { timeout: 5000 })
      .catch(() => null);
    if (welcomeModal) {
      console.log("🚀 Dismissing welcome setup wizard modal...");
      const cancelBtn = await page.$(".modal-actions .btn-destructive");
      if (cancelBtn) {
        await cancelBtn.click();
      } else {
        await page.click(".modal-actions .btn");
      }
      await page.waitForSelector(".modal-overlay", { hidden: true });
    }

    console.log("🚀 Verifying dashboard navigation is interactive...");
    await page.click("#nav-history");
    await page.waitForFunction(
      () =>
        document.querySelector("#nav-history")?.classList.contains("active") &&
        document.querySelector("#view-history")?.classList.contains("active"),
      { timeout: 5000 },
    );

    await page.click("#nav-settings");
    await page.waitForFunction(
      () =>
        document.querySelector("#nav-settings")?.classList.contains("active") &&
        document.querySelector("#view-settings")?.classList.contains("active"),
      { timeout: 5000 },
    );
    console.log("🎉 SUCCESS: Dashboard Navigation Test Passed!");

    console.log("🚀 Verifying the model import functionality...");
    // Keep settings tab active to expose settings visually.
    await page.click("#nav-settings");

    // Find the hidden input and upload the local tar files
    const modelInput = await page.$("#model-file-input");
    const detPath = await ensureModelFile("det.tar");
    const recPath = await ensureModelFile("rec.tar");
    await modelInput.uploadFile(detPath, recPath);

    // Wait for the import modal to pop up
    console.log("🚀 Waiting for import success dialog...");
    await page.waitForFunction(
      () => {
        const body = document.querySelector(".modal-body");
        const title = document.querySelector(".modal-title");
        const allText = (
          (title?.textContent || "") +
          " " +
          (body?.textContent || "")
        ).toLowerCase();
        return (
          allText.includes("导入") ||
          allText.includes("成功") ||
          allText.includes("import") ||
          allText.includes("success")
        );
      },
      { timeout: 30000 },
    );

    // Click confirm/OK button on the modal to close it
    await page.click(".modal-actions .btn-confirm");

    // Verify status indicators changed to READY
    const detStatus = await page.$eval("#status-det", (el) => el.textContent);
    const recStatus = await page.$eval("#status-rec", (el) => el.textContent);
    console.log(`[MODEL STATUS] DET: ${detStatus}, REC: ${recStatus}`);

    if (
      !(detStatus.includes("READY") || detStatus.includes("已就绪")) ||
      !(recStatus.includes("READY") || recStatus.includes("已就绪"))
    ) {
      console.error("❌ FAILED: Status indicators did not update to READY.");
      await browser.close();
      server.close();
      process.exit(1);
    }
    console.log("🎉 SUCCESS: Model File Import Test Passed!");

    // TEST STEP 3: Verifying Workspace OCR on imported models
    console.log("🚀 Test Step 3: Verifying Workspace OCR on imported models...");
    await page.click("#nav-studio");

    const ocrFileInput = await page.$("#file-input");
    const iconPath = path.resolve("public/icon-128.png");
    await ocrFileInput.uploadFile(iconPath);

    // Wait for result card to appear
    console.log("🚀 Waiting for OCR results to display...");
    await page.waitForSelector(".result-card", { timeout: 30000 });
    const resultText = await page.$eval(".result-text", (el) => el.textContent);
    console.log(`[EXTRACTED WORKSPACE TEXT] ${resultText}`);
    if (
      !resultText ||
      resultText.trim().startsWith("Error:") ||
      resultText.trim().includes("error:")
    ) {
      console.error(`❌ FAILED: Workspace OCR resulted in an error: ${resultText}`);
      await browser.close();
      server.close();
      process.exit(1);
    }
    console.log("🎉 SUCCESS: Workspace OCR Test Passed!");

    // TEST STEP 4: Verifying History permanent deletion
    console.log("🚀 Test Step 4: Verifying History permanent deletion...");

    console.log("🚀 Injecting dummy history record directly into IndexedDB...");
    await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("ocrmeow-db", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("history", "readwrite");
          const store = tx.objectStore("history");
          const addReq = store.add({
            timestamp: Date.now(),
            text: "Hello Steins Gate",
            image:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            source: "Test Capture",
          });
          addReq.onerror = () => reject(addReq.error);
          addReq.onsuccess = () => resolve();
        };
      });
    });
    console.log("🎉 SUCCESS: Dummy history record injected!");

    await page.click("#nav-history");

    // Wait for the history card to render
    console.log("🚀 Waiting for history card to render...");
    await page.waitForSelector("#history-container .result-card", { timeout: 10000 });

    // Assert that we have the card
    const historyTextBefore = await page.$eval(
      "#history-container .result-text",
      (el) => el.textContent,
    );
    console.log(`[HISTORY BEFORE DELETE] ${historyTextBefore}`);

    // Click delete
    console.log("🚀 Clicking delete button on history card...");
    await page.click("#history-container .result-card .btn-danger");

    // Wait for the history card to disappear from the DOM
    await page.waitForSelector("#history-container .result-card", { hidden: true, timeout: 5000 });
    console.log("🎉 Card disappeared from DOM visually.");

    console.log("🚀 Waiting for database-level deletion...");
    await page.waitForFunction(
      async () => {
        const records = await new Promise((resolve, reject) => {
          const request = indexedDB.open("ocrmeow-db", 2);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("history", "readonly");
            const store = tx.objectStore("history");
            const getAllReq = store.getAll();
            getAllReq.onerror = () => reject(getAllReq.error);
            getAllReq.onsuccess = () => resolve(getAllReq.result);
          };
        });
        return !records.some((item) => item.text === "Hello Steins Gate");
      },
      { timeout: 10000 },
    );
    console.log("🎉 Database record disappeared.");

    // Refresh the page to verify it does not resurrect from IndexedDB
    console.log("🚀 Refreshing page to verify database-level deletion...");
    await page.reload({ waitUntil: "load" });
    await page.click("#nav-history");

    await page.waitForSelector("#history-container", { timeout: 10000 });
    const historyAfterReload = await page.$eval("#history-container", (el) => el.textContent || "");
    console.log(`[HISTORY AFTER RELOAD] ${historyAfterReload}`);
    if (historyAfterReload.includes("Hello Steins Gate")) {
      console.error("❌ FAILED: Deleted history record resurrected after reload.");
      await browser.close();
      server.close();
      process.exit(1);
    }

    console.log("🎉 SUCCESS: History Permanent Deletion Test Passed!");

    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ TIMEOUT OR ERROR: ", err);
    await browser.close();
    server.close();
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("❌ FATAL ERROR: ", err);
  process.exit(1);
});

import puppeteer from "puppeteer-core";
import sirv from "sirv";
import http from "http";
import path from "path";
import { execSync } from "child_process";

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

async function runTest() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error("❌ ERROR: Chrome not found.");
    process.exit(1);
  }

  console.log("🚀 Building project for production-like testing...");
  try {
    execSync("npm run build", { stdio: "inherit" });
  } catch {
    console.error("❌ Build failed!");
    process.exit(1);
  }

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

    console.log("🚀 Verifying the model import functionality...");
    // Click settings tab to expose settings
    await page.click("#nav-settings");

    // Find the hidden input and upload the local tar files
    const modelInput = await page.$("#model-file-input");
    const detPath = path.resolve("public/models/det.tar");
    const recPath = path.resolve("public/models/rec.tar");
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

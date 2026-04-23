import puppeteer from "puppeteer-core";
import sirv from "sirv";
import http from "http";
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

  server.listen(5173);
  console.log("✅ Production-like server started on http://localhost:5173");

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
  await page.goto("http://localhost:5173/easter_egg_test.html", { waitUntil: "load" });

  console.log("🚀 Waiting for OCR completion...");

  try {
    const result = await page.waitForSelector("#test-result", { timeout: 180000 });
    const text = await page.evaluate((el) => el.textContent, result);

    if (text === "PASS") {
      console.log("🎉 SUCCESS: Easter Egg OCR Test Passed!");
      await browser.close();
      server.close();
      process.exit(0);
    } else {
      console.error(`❌ FAILED: Test did not pass. Status: ${text}`);
      await browser.close();
      server.close();
      process.exit(1);
    }
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

const { chromium } = require("playwright");
const path = require("path");

const FPS = 30;
const DURATION_MS = 5300;
const FRAME_INTERVAL = 1000 / FPS;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 320 } });
  await page.goto("file://" + path.join(__dirname, "name-animation.html"));

  const frameCount = Math.ceil(DURATION_MS / FRAME_INTERVAL);
  for (let i = 0; i < frameCount; i++) {
    await page.screenshot({ path: path.join(__dirname, "frames", `frame_${String(i).padStart(4, "0")}.png`) });
    await page.waitForTimeout(FRAME_INTERVAL);
  }

  await browser.close();
  console.log(`Captured ${frameCount} frames`);
})();

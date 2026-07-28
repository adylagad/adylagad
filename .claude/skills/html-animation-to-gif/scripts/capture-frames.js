// Template: capture PNG frames of a local HTML animation with Playwright.
// Copy next to the target HTML file and fill in the CONFIG block below.
const { chromium } = require("playwright");
const path = require("path");

const CONFIG = {
  htmlFile: "name-animation.html",   // file to load, relative to this script
  framesDir: "frames",               // output dir, relative to this script
  width: 900,                        // must match the animation's intended canvas size
  height: 320,
  fps: 30,                           // capture fps; can downsample when encoding
  durationMs: 5300,                  // from html-animation-duration, + small buffer

  // Seek mode (recommended): pauses window.<timelineGlobal> to an exact
  // time before each screenshot, immune to per-frame capture overhead.
  // Requires the HTML to expose its driving timeline, e.g.
  // `window.master = master;` at the end of the script (see
  // html-animation-duration, which wants this hook anyway).
  // Set to false only if the animation has no single JS timeline to seek
  // (e.g. plain CSS animations) -- falls back to wall-clock pacing, which
  // is fine for one-shot animations but can drift on loops (see SKILL.md).
  seek: true,
  timelineGlobal: "master",
};

(async () => {
  const frameInterval = 1000 / CONFIG.fps;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: CONFIG.width, height: CONFIG.height } });
  await page.goto("file://" + path.join(__dirname, CONFIG.htmlFile));

  const frameCount = Math.ceil(CONFIG.durationMs / frameInterval);
  for (let i = 0; i < frameCount; i++) {
    if (CONFIG.seek) {
      const t = (i * frameInterval) / 1000;
      // NOTE: must return nothing -- returning the timeline (pause()'s
      // return value) hangs Playwright trying to serialize a circular
      // GSAP object graph. See SKILL.md's page.evaluate gotcha.
      await page.evaluate(
        ({ name, seekTime }) => { window[name].pause(seekTime, false); },
        { name: CONFIG.timelineGlobal, seekTime: t }
      );
    }
    await page.screenshot({
      path: path.join(__dirname, CONFIG.framesDir, `frame_${String(i).padStart(4, "0")}.png`),
    });
    if (!CONFIG.seek) {
      await page.waitForTimeout(frameInterval);
    }
  }

  await browser.close();
  console.log(`Captured ${frameCount} frames to ${CONFIG.framesDir}/`);
})();

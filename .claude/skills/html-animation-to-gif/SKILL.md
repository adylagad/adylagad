---
name: html-animation-to-gif
description: Turn a local HTML/CSS/JS (e.g. GSAP) animation into a recorded, optimized GIF via headless-browser frame capture and ffmpeg — the standard way to get client-side animation into a static context like a GitHub README, since READMEs strip <script> tags and can't execute JS. Use whenever the user wants an animation "recorded", turned into a GIF, or embedded somewhere that can't run JS (README, image tag, Slack, etc).
license: MIT
---

# HTML Animation → GIF

## When to Use This Skill

The animation exists as a working local HTML file (built with **gsap-core**/**gsap-timeline**/**gsap-plugins** or plain CSS/JS) and needs to become a static, embeddable GIF — most commonly for a GitHub README, which renders only static Markdown/HTML and cannot execute `<script>` tags.

**Prerequisite skills, in order:** **html-animation-preview** (confirm it renders correctly) → **html-animation-duration** (measure exact playback length) → this skill (capture, encode, verify, clean up).

## Requirements

- `npm install playwright --no-save` once per project, then `npx playwright install chromium` once per machine.
- `ffmpeg` on PATH (`brew install ffmpeg` on macOS if missing).

## Procedure

### 1. Capture frames

Copy `scripts/capture-frames.js` (in this skill directory) next to the target HTML file, fill in the `CONFIG` block (file name, canvas size matching the HTML's intended dimensions, and `durationMs` from **html-animation-duration** + a small buffer), and run it:

```bash
mkdir -p animation/frames
node animation/capture-frames.js
```

**Prefer seek-based capture over wall-clock capture whenever the animation can expose its GSAP timeline** (e.g. `window.master = master;` at the end of the driving script — see **html-animation-duration**, which already wants this hook for measuring duration). The template's default mode calls `window.master.pause(t, false)` before each screenshot instead of `waitForTimeout(frameInterval)` between screenshots. This matters because:

- **Wall-clock capture drifts.** Each `screenshot()` call has real overhead (tens to hundreds of ms). A loop of `await screenshot(); await waitForTimeout(interval);` accumulates that overhead across every iteration, so by frame ~150-200 the actual elapsed wall-clock time can be several hundred ms ahead of the nominal `i * interval` the frame filename implies. For a one-shot (non-looping) animation this just means the tail is slightly mistimed. For a **looping** animation it can be much worse: the drift can push the last several "frames" past the loop boundary into the *next* cycle's opening moments, which reads as visually broken (e.g. text that should be static at the loop point shown mid-scramble instead) even though every individual frame capture "succeeded" with no errors.
- **Seeking is drift-proof.** `window.master.pause(t, false)` sets the timeline to exactly `t` seconds regardless of how long the previous screenshot took, so frame `i` is always exactly `i / fps` seconds of animation time. This is also considerably faster to run since there's no real-time waiting at all.

If the animation genuinely can't expose a single driving timeline (e.g. plain CSS animations with no JS handle), fall back to the wall-clock mode still present in the template (toggle `CONFIG.seek: false`).

**Critical `page.evaluate` gotcha with seeking:** always wrap the seek call in a block so it returns nothing —

```js
// WRONG — hangs Playwright, often for minutes, with no error:
await page.evaluate((t) => window.master.pause(t, false), t);

// RIGHT:
await page.evaluate((t) => { window.master.pause(t, false); }, t);
```

`timeline.pause()` returns the timeline instance itself (for chaining). An arrow function with no braces implicitly returns that expression, so Playwright tries to serialize the entire GSAP timeline object graph (circular refs, DOM element handles, functions) back across the CDP bridge — this stalls indefinitely rather than throwing, so the failure looks like a hang, not an error. If a capture run seems stuck with no console output and no error after the first `evaluate` call, check for exactly this before anything else.

Always delete any stale frames in the output dir first (`find animation/frames -name "*.png" -delete`) — leftover frames from a previous run silently blend into the new sequence otherwise.

### 2. Encode to GIF

Use ffmpeg's two-pass palette approach — a naive single-pass GIF encode looks banded/dithered badly; this looks close to the source:

```bash
ffmpeg -y -framerate 30 -i frames/frame_%04d.png \
  -vf "fps=20,scale=600:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer" \
  name-animation.gif
```

- `fps=20` in the filter downsamples from the 30fps capture — GIFs rarely need more than 20-24fps and it cuts file size.
- `scale=<width>:-1` sets the final embed width; keep aspect ratio with `-1`.
- `stats_mode=diff` in `palettegen` builds the palette from frame-to-frame *changes*, which holds onto more color detail for animations with a mostly-static background than the default full-frame palette would.
- Watch the `palettegen` log line: `N(+1) colors generated out of M colors`. If `M` (colors before dedup) is suspiciously low (e.g. `1` or `2`), the source frames are blank/flat — stop and go back to **html-animation-preview** to find why, don't proceed to encoding a broken result.

### 2.5. Seamless loops (if the animation repeats)

GIFs loop natively, so a `repeat: -1` GSAP timeline can produce an infinitely-looping GIF with no visible seam — *if* the first and last captured frames match:

- Build in a **static hold at both ends of one cycle** — a brief pause after the timeline settles at the start, and a `repeatDelay` before it repeats at the end — so there's a window of identical-looking frames on both sides of the loop boundary to land the capture in.
- Set `durationMs` to stop **inside the trailing hold**, comfortably before the exact repeat point (e.g. a few hundred ms of margin), not at the measured total duration itself — landing exactly on the boundary risks capturing the first instant of the next cycle instead of the settled state.
- If any tween in the timeline uses `gsap.utils.random(...)` for duration/delay/speed, **the total cycle length is different every page load** — a duration measured in one run won't match a later capture run, silently breaking the margin above. Replace `gsap.utils.random(...)` with a fixed lookup (e.g. `const DURATIONS = [0.9, 1.15, ...]; DURATIONS[i % DURATIONS.length]`) so per-element variation is preserved but the total timeline duration is deterministic and reproducible across runs.
- After capturing, verify the seam directly: extract frame 0 and the last frame from the **encoded GIF** (not just the source PNGs) and eyeball them side by side — they should be visually identical.

### 3. Verify the encoded output

Encoding is a second lossy step (palette reduction, frame dropping) — a correct frame sequence can still produce a bad GIF. Extract a couple of frames from the *finished GIF itself* (not the source PNGs) and look at them:

```bash
ffmpeg -y -i name-animation.gif -vf "select=eq(n\,40)" -update 1 -frames:v 1 check_a.png
```

Read `check_a.png` with the image tool and confirm it matches the corresponding source frame.

### 4. Clean up

Delete the capture script, the `frames/` directory, and any `check_*.png` verification frames. Only the source HTML and the final `.gif` are deliverables — raw frames and one-off scripts bloat the repo for no benefit.

```bash
rm -f animation/capture-frames.js
find animation/frames -name "*.png" -delete && rmdir animation/frames
rm -f check_a.png check_b.png
```

## Do Not

- ❌ Encode straight from a single-pass ffmpeg GIF filter (no palettegen/paletteuse) — banding and dithering will be visibly worse.
- ❌ Skip step 3 and assume the GIF matches the PNG frames — palette reduction can wash out gradients/glows that looked fine pre-encode.
- ❌ Leave `frames/` (often 100+ PNGs) or the capture script committed — they're intermediate artifacts, not deliverables.
- ❌ Reference a CDN script from the HTML being captured — see **html-animation-preview**'s failure modes; bundle libraries locally instead.
- ❌ Capture a looping animation with wall-clock `waitForTimeout` pacing — the accumulated per-frame overhead drifts the later frames past the loop boundary; use timeline-seek capture instead (see 2.5).
- ❌ Let a `page.evaluate` call implicitly return a GSAP timeline/tween (no braces around the arrow body) — it hangs Playwright's serialization with no error. Always wrap in `{ }` when the call's return value isn't needed.
- ❌ Leave `gsap.utils.random(...)` in a timeline you intend to capture as a seamless loop — it makes the total duration different every page load, so a duration measured once won't hold for the actual capture run.

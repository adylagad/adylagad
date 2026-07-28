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

It screenshots at a fixed interval (default 30fps) for the full duration. Always delete any stale frames in the output dir first (`find animation/frames -name "*.png" -delete`) — leftover frames from a previous run silently blend into the new sequence otherwise.

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

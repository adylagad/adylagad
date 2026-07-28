---
name: html-animation-preview
description: Visually verify a local HTML/CSS/JS animation renders correctly (right colors, right timing, no console errors) before spending time on a full frame capture or GIF export. Use when an HTML file with a GSAP/CSS/JS animation was just written or edited and needs a sanity check, or when a previous capture/GIF came out blank, wrong, or broken and the root cause needs to be found.
license: MIT
---

# HTML Animation Preview

## When to Use This Skill

After writing or editing an HTML file that contains a JS/CSS animation (e.g. GSAP), before capturing frames or building a GIF. Also use it to debug a bad result — e.g. a GIF that came out blank, a single flat color, or missing an effect — since the fastest way to find the cause is to look at a few checkpoint screenshots and the browser console, not to re-run the full capture pipeline blind.

**Related skills:** Once the animation is confirmed correct, use **html-animation-duration** to measure real playback length, then **html-animation-to-gif** for the full capture → GIF → verify pipeline.

## Requirements

- Node with `playwright` installed (`npm install playwright --no-save`, then `npx playwright install chromium` once per machine).
- The animation must expose no special hooks for this step — it just needs to run when the HTML file loads.

## Procedure

1. Write a small throwaway script (e.g. `debug.js` next to the HTML file) that:
   - Launches headless Chromium with a viewport matching the animation's intended canvas size.
   - Attaches `page.on("console", ...)` and `page.on("pageerror", ...)` listeners **before** `page.goto()` — this is the #1 way to catch a silently-broken animation (e.g. a missing plugin registration, a CDN script that didn't load, a selector that matched nothing).
   - Navigates to the file with `file://<absolute path>`.
   - Takes screenshots at a handful of checkpoints spread across the expected animation timeline (e.g. `[200, 1200, 1600, 2200, 2800, 3400]` ms), waiting the *delta* between checkpoints, not the absolute value.
2. Run the script and check the console/page-error output first — an animation that produces no errors but still renders wrong is a *logic* bug (see Common Failure Modes below); errors point at a *loading* bug.
3. Read each screenshot with the image-reading tool and confirm, phase by phase, that what's on screen matches intent (right elements visible, right colors, right position).
4. Delete the throwaway script and screenshots once satisfied — they're not deliverables.

## Common Failure Modes (found by this technique, in past runs)

- **CSS start-state equals GSAP's `from()` target.** If a CSS rule sets `opacity: 0` on an element and a `gsap.from(el, { opacity: 0, ... })` tween is used, GSAP reads the *current computed style* as the implicit "to" value — so it animates from 0 to 0 and the element never becomes visible. Symptom: blank/empty screenshots, no console errors. Fix: don't duplicate the tween's start value in CSS; let CSS hold the *end* state, or make the "from" values explicit and different from the CSS default.
- **CDN script silently didn't execute in a sandboxed browser context.** Prefer bundling the library locally (copy the `.min.js` from `node_modules/<pkg>/dist/` next to the HTML) over a CDN `<script src>` when capturing in an automated/sandboxed environment — it removes a whole class of network-timing flakiness.
- **Plugin used without `gsap.registerPlugin(...)`.** Throws a page error caught by the `pageerror` listener; easy to miss if you're only staring at the rendered screenshot.

## Do Not

- ❌ Skip straight to full frame capture on a newly-written animation — a 5-second capture-and-encode cycle is slow to iterate on; a handful of screenshots is fast.
- ❌ Trust "no console errors" alone as proof the animation is correct — always eyeball at least 3-4 checkpoints across the timeline.
- ❌ Leave the debug script and its screenshots in the repo after the check passes.

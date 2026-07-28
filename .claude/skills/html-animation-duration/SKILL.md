---
name: html-animation-duration
description: Measure the real, actual playback duration of a JS/GSAP animation running in a browser, instead of guessing or hand-calculating it from tween durations, delays, and stagger math. Use before capturing frames for a GIF/video export, whenever the animation has more than one or two chained tweens, dynamically-added timeline children (e.g. added inside a .call()), or any repeat/yoyo — anywhere hand-calculating total duration is error-prone.
license: MIT
---

# HTML Animation Duration Measurement

## When to Use This Skill

Right before deciding how long to capture frames for (see **html-animation-to-gif**). Hand-calculating a GSAP timeline's total duration from its source (summing durations, stagger delays, position parameters, dynamically-appended children) is easy to get wrong — especially when tweens are added at runtime inside `.call()` callbacks, or when `stagger`/`repeat`/`yoyo` are involved. Measuring it empirically is faster and more reliable than auditing the timeline code.

**Related skills:** Use **html-animation-preview** first to confirm the animation is visually correct, then this skill to size the capture, then **html-animation-to-gif** to do the capture (which also wants the timeline exposed globally, per Method A below, to seek it frame-by-frame).

## Method A: query the timeline directly (preferred)

If the HTML exposes its driving timeline globally — `window.master = master;` at the end of the script — read its duration directly instead of measuring wall-clock time at all:

```js
const info = await page.evaluate(() => ({
  duration: window.master.duration(),   // one non-repeating iteration, in seconds
  repeatDelay: window.master.vars.repeatDelay || 0,
}));
console.log("One cycle:", info.duration + info.repeatDelay, "s");
```

This is exact (no polling granularity, no page-load/launch overhead baked into the number) and works the same whether the timeline is `repeat: -1` or not — `duration()` always returns one iteration's length regardless of repeat settings. Exposing the timeline this way also directly enables **html-animation-to-gif**'s seek-based capture, so it's worth doing by default rather than only reaching for it when Method B is inconvenient.

**Precondition:** every tween's `duration`/`delay`/`stagger`/`scrambleText.speed`/`revealDelay` etc. must be deterministic (no `gsap.utils.random(...)`) or this number won't match what an actual capture run produces. Replace randomized values with a fixed lookup array (e.g. `DURATIONS[i % DURATIONS.length]`) if per-element variation is wanted without sacrificing reproducibility.

## Method B: poll a completion flag (fallback)

Use this when the timeline isn't (or can't be) exposed globally, or as a sanity cross-check against Method A.

1. Have the animation set a flag when it finishes — the cheapest hook is a timeline-level `onComplete`:
   ```js
   const tl = gsap.timeline({ onComplete: () => { window.animationDone = true; } });
   ```
   If the animation loops forever (`repeat: -1`), use `onRepeat` instead of `onComplete` (which never fires on an infinite-repeat timeline) — it flags exactly when one full cycle (content + `repeatDelay`) has elapsed.
2. In a throwaway Node script, launch headless Chromium, navigate to the file, then poll:
   ```js
   const start = Date.now();
   let done = false;
   while (!done && Date.now() - start < 8000) { // generous upper bound
     await page.waitForTimeout(100);
     done = await page.evaluate(() => window.animationDone);
   }
   console.log("Total time to complete:", Date.now() - start, "ms");
   ```
3. Use that measured number (plus a small buffer, e.g. +100-300ms so the final frame isn't cut off mid-settle) as the capture duration.
4. Delete the throwaway script.

This has ~100ms of polling-interval slop built in and is more sensitive to system load than Method A, but doesn't require any code changes to the animation beyond the one callback.

## Do Not

- ❌ Hardcode a guessed duration and iterate by trial-and-error re-capturing — either method above gets the exact number in one run.
- ❌ Forget the upper-bound timeout on Method B's polling loop — an animation that never sets the flag (e.g. a typo in the `onComplete`/`onRepeat` wiring) would otherwise hang the script forever.
- ❌ Trust a duration measured against a timeline that still contains `gsap.utils.random(...)` — the actual capture run will produce a different total, silently breaking any margin calculated from the measured number.
- ❌ Use either method as a substitute for **html-animation-preview** — duration alone doesn't tell you the animation looks right, only how long it runs.

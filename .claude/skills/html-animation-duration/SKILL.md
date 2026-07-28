---
name: html-animation-duration
description: Measure the real, actual playback duration of a JS/GSAP animation running in a browser, instead of guessing or hand-calculating it from tween durations, delays, and stagger math. Use before capturing frames for a GIF/video export, whenever the animation has more than one or two chained tweens, dynamically-added timeline children (e.g. added inside a .call()), or any repeat/yoyo — anywhere hand-calculating total duration is error-prone.
license: MIT
---

# HTML Animation Duration Measurement

## When to Use This Skill

Right before deciding how long to capture frames for (see **html-animation-to-gif**). Hand-calculating a GSAP timeline's total duration from its source (summing durations, stagger delays, position parameters, dynamically-appended children) is easy to get wrong — especially when tweens are added at runtime inside `.call()` callbacks, or when `stagger`/`repeat`/`yoyo` are involved. Measuring it empirically is faster and more reliable than auditing the timeline code.

**Related skills:** Use **html-animation-preview** first to confirm the animation is visually correct, then this skill to size the capture, then **html-animation-to-gif** to do the capture.

## Procedure

1. Have the animation set a flag when it finishes — the cheapest hook is a timeline-level `onComplete`:
   ```js
   const tl = gsap.timeline({ onComplete: () => { window.animationDone = true; } });
   ```
   If the animation loops forever (`repeat: -1`), instead flag completion of the *last non-repeating phase* (e.g. the intro), and treat the loop's own duration as the thing to measure/replicate for a seamless capture.
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

## Do Not

- ❌ Hardcode a guessed duration and iterate by trial-and-error re-capturing — polling `window.animationDone` gets the exact number in one run.
- ❌ Forget the upper-bound timeout on the polling loop — an animation that never sets the flag (e.g. a typo in the `onComplete` wiring) would otherwise hang the script forever.
- ❌ Use this technique as a substitute for **html-animation-preview** — duration alone doesn't tell you the animation looks right, only how long it runs.

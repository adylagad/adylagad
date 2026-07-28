// Generates education-dark.svg and education-light.svg from one layout +
// data definition, so the two theme variants can't drift apart. Uses CSS
// animations (not GSAP/JS) since GitHub strips <script> from SVGs embedded
// via <img>, but CSS @keyframes still run in that context.
//
// Shares job-timeline-*.svg's gsap.com-inspired palette (black background,
// cream text, rotated accent colors) but trades its rail-and-chip grammar
// for an editorial numbered list -- big index numerals, no boxes, and a
// full-width divider under each row instead of chips -- so the two
// sections read as related but distinct. Each row's index number + name
// underline are colored to match that institution's real palette (USC
// cardinal/gold, PICT purple/cyan) instead of a generic cycling palette;
// an earlier version also drew a themed icon per row (a shield, a circuit
// chip) but they read as clutter next to the plain-text rows, so the
// theming now lives entirely in color.
//
// No `id` attributes anywhere -- GitHub's image pipeline strips ids from
// embedded SVGs, which silently breaks id-based CSS selectors and
// url(#id) references (see job-timeline's history for the same fix).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const WIDTH = 780;
const PAD_LEFT = 48;
const PAD_TOP = 44;
const PAD_BOTTOM = 44;
const INDEX_COL_WIDTH = 68;
const TEXT_X = PAD_LEFT + INDEX_COL_WIDTH;
const CONTENT_WIDTH = WIDTH - PAD_LEFT * 2 - INDEX_COL_WIDTH;
const ROW_GAP = 46;
const NAME_MAX_FONT = 30;
const NAME_MIN_FONT = 19;
const STAGGER = 0.35;

const DEFAULT_ACCENT = "#FF7A1A";

const entries = [
  {
    school: "University of Southern California",
    degree: "M.S. Computer Science",
    accent: "#B71234", // USC cardinal
    accent2: "#FFC72C", // USC gold
  },
  {
    school: "Pune Institute of Computer Technology",
    degree: "B.E. Computer Engineering",
    accent: "#7C3AED", // circuit purple
    accent2: "#22D3EE", // circuit cyan
  },
  { school: "Auxilium Convent School" },
];

function palette(theme) {
  return theme === "dark"
    ? { bg: "#0d1117", name: "#f2ede0", degree: "#a8a196", divider: "#22272e" }
    : { bg: "#ffffff", name: "#1a1a1a", degree: "#5b564c", divider: "#e8e3d8" };
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const SANS_STACK = "-apple-system, Segoe UI, Helvetica, Arial, sans-serif";
const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, monospace";

// Text widths are measured in a real browser (SVG getComputedTextLength)
// rather than guessed, and used to auto-shrink each name's font size until
// it fits the row -- avoids hardcoding a size per institution name length.
let WIDTHS = null;
function widthKey(text, fontSize) { return text + "|" + fontSize; }
function widthOf(text, fontSize) {
  const w = WIDTHS.get(widthKey(text, fontSize));
  if (w === undefined) throw new Error('No measured width for "' + text + '" @ ' + fontSize);
  return w;
}

async function measureAll(requests) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<svg xmlns="http://www.w3.org/2000/svg"><text id="m" font-weight="700"></text></svg>');
  const results = await page.evaluate(({ reqs, sansStack }) => {
    const el = document.getElementById("m");
    return reqs.map(({ text, fontSize }) => {
      el.setAttribute("font-size", fontSize);
      el.setAttribute("font-family", sansStack);
      el.textContent = text;
      return el.getComputedTextLength();
    });
  }, { reqs: requests, sansStack: SANS_STACK });
  await browser.close();

  const map = new Map();
  requests.forEach((r, i) => map.set(widthKey(r.text, r.fontSize), results[i]));
  return map;
}

function collectMeasurements() {
  const reqs = [];
  const seen = new Set();
  const add = (text, fontSize) => {
    const k = widthKey(text, fontSize);
    if (!seen.has(k)) { seen.add(k); reqs.push({ text, fontSize }); }
  };
  entries.forEach(entry => {
    for (let fs = NAME_MAX_FONT; fs >= NAME_MIN_FONT; fs--) add(entry.school, fs);
  });
  return reqs;
}

// Picks the largest font size (within the allowed range) whose measured
// width still fits inside the row's content area.
function fitFontSize(text) {
  for (let fs = NAME_MAX_FONT; fs >= NAME_MIN_FONT; fs--) {
    if (widthOf(text, fs) <= CONTENT_WIDTH) return fs;
  }
  return NAME_MIN_FONT;
}

// Built only after WIDTHS is populated (fitFontSize needs measured widths).
let rows = null;
let HEIGHT = null;
function layoutRows() {
  rows = entries.map((entry, i) => {
    const nameFontSize = fitFontSize(entry.school);
    const blockHeight = entry.degree ? nameFontSize + 8 + 30 : nameFontSize + 8;
    const accent = entry.accent || DEFAULT_ACCENT;
    const accent2 = entry.accent2 || accent;
    return { ...entry, nameFontSize, blockHeight, accent, accent2, index: i + 1 };
  });

  let top = PAD_TOP;
  rows.forEach(row => {
    row.top = top;
    top += row.blockHeight + ROW_GAP;
  });
  HEIGHT = top - ROW_GAP + PAD_BOTTOM;
}

function buildSvg(theme) {
  const c = palette(theme);

  const style = `
    .row-${theme} { transform-box: fill-box; transform-origin: left center; animation-name: row-in; animation-duration: 0.45s; animation-timing-function: ease-out; animation-fill-mode: both; }
    .underline-${theme} { animation-name: draw-underline; animation-duration: 0.4s; animation-timing-function: cubic-bezier(0.45,0,0.55,1); animation-fill-mode: both; }
    .degree-${theme} { animation-name: degree-in; animation-duration: 0.3s; animation-timing-function: ease-out; animation-fill-mode: both; }
    .divider-${theme} { animation-name: draw-divider; animation-duration: 0.7s; animation-timing-function: cubic-bezier(0.45,0,0.55,1); animation-fill-mode: both; }
    @keyframes row-in { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes draw-underline { to { stroke-dashoffset: 0; } }
    @keyframes degree-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes draw-divider { to { stroke-dashoffset: 0; } }
  `;

  let body = "";
  rows.forEach((row, i) => {
    const rowDelay = i * STAGGER;
    const nameBaseline = row.top + row.nameFontSize * 0.78;
    const nameW = widthOf(row.school, row.nameFontSize);
    const underlineY = nameBaseline + 8;
    const indexFontSize = Math.round(row.nameFontSize * 0.62);
    const indexBaseline = nameBaseline;
    const dividerWidth = WIDTH - PAD_LEFT * 2;

    body += `<g class="row-${theme}" style="animation-delay:${rowDelay.toFixed(2)}s">\n`;
    body += `<text x="${PAD_LEFT}" y="${indexBaseline}" font-size="${indexFontSize}" font-weight="600" font-family="${MONO_STACK}" fill="${row.accent2}">${String(row.index).padStart(2, "0")}</text>\n`;
    body += `<text x="${TEXT_X}" y="${nameBaseline}" font-size="${row.nameFontSize}" font-weight="700" font-family="${SANS_STACK}" fill="${c.name}">${esc(row.school)}</text>\n`;
    body += `<line class="underline-${theme}" x1="${TEXT_X}" y1="${underlineY}" x2="${TEXT_X + nameW}" y2="${underlineY}" stroke="${row.accent}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${nameW.toFixed(1)}" stroke-dashoffset="${nameW.toFixed(1)}" style="animation-delay:${(rowDelay + 0.3).toFixed(2)}s"/>\n`;

    if (row.degree) {
      const degreeBaseline = underlineY + 30;
      body += `<text class="degree-${theme}" x="${TEXT_X}" y="${degreeBaseline}" font-size="16" font-weight="500" font-family="${SANS_STACK}" fill="${c.degree}" style="animation-delay:${(rowDelay + 0.55).toFixed(2)}s">${esc(row.degree)}</text>\n`;
    }

    body += `</g>\n`;

    const dividerY = row.top + row.blockHeight + ROW_GAP / 2;
    body += `<line class="divider-${theme}" x1="${PAD_LEFT}" y1="${dividerY}" x2="${WIDTH - PAD_LEFT}" y2="${dividerY}" stroke="${c.divider}" stroke-width="1.5" stroke-dasharray="${dividerWidth}" stroke-dashoffset="${dividerWidth}" style="animation-delay:${(rowDelay + 0.15).toFixed(2)}s"/>\n`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${SANS_STACK}">
  <style>${style}</style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${c.bg}"/>
  ${body}
</svg>`;
}

(async () => {
  WIDTHS = await measureAll(collectMeasurements());
  layoutRows();
  fs.writeFileSync(path.join(__dirname, "education-dark.svg"), buildSvg("dark"));
  fs.writeFileSync(path.join(__dirname, "education-light.svg"), buildSvg("light"));
  console.log("Generated education-dark.svg and education-light.svg");
})();

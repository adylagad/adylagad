// Generates job-timeline-dark.svg and job-timeline-light.svg from one
// layout + data definition, so the two theme variants can't drift apart.
// Uses CSS animations (not GSAP/JS) since GitHub strips <script> from SVGs
// embedded via <img>, but CSS @keyframes still run in that context.
//
// Visual style follows gsap.com: black background, cream body text, and
// key words (company names, dates) called out as solid-color, slightly
// rotated "chip" badges with black text rather than a single accent hue.
// No `id` attributes anywhere — GitHub's image pipeline strips ids from
// embedded SVGs, which silently breaks id-based CSS selectors and
// url(#id) references (found the hard way with an earlier gradient rail).
const fs = require("fs");
const path = require("path");

const WIDTH = 780;
const PAD_LEFT = 48;
const PAD_TOP = 48;
const PAD_BOTTOM = 48;
const RAIL_X = PAD_LEFT + 18;
const TEXT_X = RAIL_X + 34;
const LINE_DURATION = 2.0;

// Chip colors are theme-independent -- they carry their own background
// fill and always use black text, so they read the same on light or dark.
const BADGE_COLORS = ["#6BE675", "#8B7CF6", "#FF7A1A", "#F45CC0"];
const ROTATIONS = [-3, 2, -2, 3, -2.5, 2.5];
let colorCursor = 0;
let rotationCursor = 0;
function nextBadgeColor() { return BADGE_COLORS[colorCursor++ % BADGE_COLORS.length]; }
function nextRotation() { return ROTATIONS[rotationCursor++ % ROTATIONS.length]; }

const entries = [
  {
    title: "Junior Software Engineer",
    company: "Fetch.ai",
    dates: "May 2026 — Present",
    blurbLines: ["Building AI agents and contributing to the ASI One mobile team."],
  },
  {
    title: "Software Engineer Intern",
    company: "Orbit AI",
    dates: "Jan 2026 — May 2026",
    blurbLines: ["Built full-stack features for AI-powered, personalized college admissions guidance."],
  },
  {
    title: "Bajaj Finserv Health",
    dates: "Jan 2023 — Apr 2025",
    subRoles: [
      { title: "Software Engineer", dates: "Oct 2024 — Apr 2025" },
      { title: "Associate Software Engineer", dates: "Jul 2023 — Sep 2024" },
      { title: "Software Engineer Intern", dates: "Jan 2023 — Jun 2023" },
    ],
    blurbLines: [
      "Progressed from intern to full-time engineer, building features and",
      "improving performance across mobile and web.",
    ],
  },
  {
    title: "Software Engineer Intern",
    company: "CuriousJr",
    dates: "May 2022 — Dec 2022",
    blurbLines: ["Built educational games that made learning fun and engaging for kids."],
  },
];

// Manually laid out row geometry: each normal entry reserves 116px, the
// grouped Bajaj entry reserves more for its header + 3 sub-roles + 2-line
// blurb, all with generous breathing room between blocks.
const rowHeights = [116, 116, 236, 116];
let top = PAD_TOP;
const rows = rowHeights.map(h => {
  const row = { top, height: h, centerY: top + h / 2 };
  top += h;
  return row;
});
const HEIGHT = top + PAD_BOTTOM;

function palette(theme) {
  return theme === "dark"
    ? {
        bg: "#0d1117",
        title: "#f2ede0",
        blurb: "#9a938a",
        subTitle: "#d8d2c5",
        subRail: "#30363d",
        rail: "#30363d",
        dotFill: "#0d1117",
      }
    : {
        bg: "#ffffff",
        title: "#1a1a1a",
        blurb: "#5c5650",
        subTitle: "#26241f",
        subRail: "#d8d2c8",
        rail: "#d8d2c8",
        dotFill: "#ffffff",
      };
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Rough average-char-width estimate (good enough for sizing a decorative
// chip background, not pixel-exact text layout).
function estimateWidth(text, fontSize) {
  return text.length * fontSize * 0.6;
}

// A rotated, drop-shadowed "chip": colored rect + black text, offset
// shadow rect behind it instead of an SVG filter (feDropShadow needs an
// id-able <filter>, which GitHub's sanitizer would strip).
function buildChip(x, baseline, text, { fontSize, mono, color }) {
  const padX = fontSize >= 18 ? 12 : 9;
  const padY = fontSize >= 18 ? 6 : 5;
  const textW = estimateWidth(text, fontSize);
  const chipW = textW + padX * 2;
  const chipH = fontSize * 0.94 + padY * 2;
  const chipY = baseline - fontSize * 0.74 - padY;
  const cx = x + chipW / 2;
  const cy = chipY + chipH / 2;
  const rot = nextRotation();
  const fontFamily = mono
    ? "ui-monospace, SFMono-Regular, Menlo, monospace"
    : "-apple-system, Segoe UI, Helvetica, Arial, sans-serif";
  const svg = `<g transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)})">
    <rect x="${(x + 2).toFixed(1)}" y="${(chipY + 3).toFixed(1)}" width="${chipW.toFixed(1)}" height="${chipH.toFixed(1)}" rx="6" fill="#000000" opacity="0.35"/>
    <rect x="${x.toFixed(1)}" y="${chipY.toFixed(1)}" width="${chipW.toFixed(1)}" height="${chipH.toFixed(1)}" rx="6" fill="${color}"/>
    <text x="${(x + padX).toFixed(1)}" y="${baseline}" font-size="${fontSize}" font-weight="700" font-family="${fontFamily}" fill="#111111">${esc(text)}</text>
  </g>`;
  return { svg, width: chipW };
}

function buildSvg(theme) {
  const c = palette(theme);
  const firstY = rows[0].centerY;
  const lastY = rows[rows.length - 1].centerY;
  const lineLength = lastY - firstY;

  const style = `
    .dot-${theme} { transform-box: fill-box; transform-origin: center; animation-name: pop; animation-duration: 0.35s; animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); animation-fill-mode: both; }
    .fade-${theme} { animation-name: fadein; animation-duration: 0.5s; animation-timing-function: ease-out; animation-fill-mode: both; }
    .subfade-${theme} { animation-name: fadein-sub; animation-duration: 0.35s; animation-timing-function: ease-out; animation-fill-mode: both; }
    .rail-${theme} { stroke-dasharray: ${lineLength}; stroke-dashoffset: ${lineLength}; animation: draw-${theme} ${LINE_DURATION}s cubic-bezier(0.45,0,0.55,1) both; }
    @keyframes draw-${theme} { to { stroke-dashoffset: 0; } }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
    @keyframes fadein { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fadein-sub { from { opacity: 0; } to { opacity: 1; } }
  `;

  colorCursor = 0;
  rotationCursor = 0;

  let body = "";
  entries.forEach((entry, i) => {
    const row = rows[i];
    const atLine = ((row.centerY - firstY) / lineLength) * LINE_DURATION;
    const titleBaseline = row.top + 28;

    // Company/group name is always the entry's primary color; the dot on
    // the rail borrows that same color for continuity.
    const entryColor = nextBadgeColor();
    const dateColor = nextBadgeColor();

    body += `<circle class="dot-${theme}" cx="${RAIL_X}" cy="${row.centerY}" r="8" fill="${c.dotFill}" stroke="${entryColor}" stroke-width="3" style="animation-delay:${atLine.toFixed(2)}s"/>\n`;

    body += `<g class="fade-${theme}" style="animation-delay:${(atLine + 0.05).toFixed(2)}s">\n`;

    let cursorX = TEXT_X;
    if (entry.company) {
      const prefix = `${entry.title} @ `;
      body += `<text x="${cursorX}" y="${titleBaseline}" font-size="21" font-weight="700" fill="${c.title}">${esc(prefix)}</text>\n`;
      cursorX += estimateWidth(prefix, 21);
      const chip = buildChip(cursorX, titleBaseline, entry.company, { fontSize: 21, color: entryColor });
      body += chip.svg;
      cursorX += chip.width + 12;
    } else {
      const chip = buildChip(cursorX, titleBaseline, entry.title, { fontSize: 21, color: entryColor });
      body += chip.svg;
      cursorX += chip.width + 12;
    }
    const dateChip = buildChip(cursorX, titleBaseline, entry.dates, { fontSize: 13, mono: true, color: dateColor });
    body += dateChip.svg;

    let blurbStartY;

    if (entry.subRoles) {
      const railTop = titleBaseline + 24;
      const rowH = 38;
      const railBottom = railTop + (entry.subRoles.length - 1) * rowH + 8;
      body += `<line x1="${TEXT_X + 8}" y1="${railTop}" x2="${TEXT_X + 8}" y2="${railBottom}" stroke="${c.subRail}" stroke-width="2"/>\n`;

      entry.subRoles.forEach((sr, si) => {
        const y = railTop + si * rowH + 14;
        const subDotColor = nextBadgeColor();
        const subDateColor = nextBadgeColor();
        body += `<g class="subfade-${theme}" style="animation-delay:${(atLine + 0.25 + si * 0.1).toFixed(2)}s">`;
        body += `<circle cx="${TEXT_X + 8}" cy="${y - 4}" r="4" fill="${subDotColor}"/>`;
        body += `<text x="${TEXT_X + 26}" y="${y}" font-size="14" font-weight="600" fill="${c.subTitle}">${esc(sr.title)} </text>`;
        const srTextW = estimateWidth(sr.title + " ", 14);
        const srChip = buildChip(TEXT_X + 26 + srTextW, y, sr.dates, { fontSize: 12, mono: true, color: subDateColor });
        body += srChip.svg;
        body += `</g>\n`;
      });
      blurbStartY = railTop + (entry.subRoles.length - 1) * rowH + 14 + 32;
    } else {
      blurbStartY = titleBaseline + 36;
    }

    entry.blurbLines.forEach((line, li) => {
      body += `<text x="${TEXT_X}" y="${blurbStartY + li * 20}" font-size="14" fill="${c.blurb}">${esc(line)}</text>\n`;
    });

    body += `</g>\n`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <style>${style}</style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${c.bg}"/>
  <line class="rail-${theme}" x1="${RAIL_X}" y1="${firstY}" x2="${RAIL_X}" y2="${lastY}" stroke="${c.rail}" stroke-width="2" stroke-linecap="round"/>
  ${body}
</svg>`;
}

fs.writeFileSync(path.join(__dirname, "job-timeline-dark.svg"), buildSvg("dark"));
fs.writeFileSync(path.join(__dirname, "job-timeline-light.svg"), buildSvg("light"));
console.log("Generated job-timeline-dark.svg and job-timeline-light.svg");

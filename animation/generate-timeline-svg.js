// Generates job-timeline-dark.svg and job-timeline-light.svg from one
// layout + data definition, so the two theme variants can't drift apart.
// Uses CSS animations (not GSAP/JS) since GitHub strips <script> from SVGs
// embedded via <img>, but CSS @keyframes still run in that context.
const fs = require("fs");
const path = require("path");

const WIDTH = 720;
const HEIGHT = 500;
const RAIL_X = 60;
const TEXT_X = 72;
const LINE_DURATION = 2.0;

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

// Manually laid out row geometry (mirrors the flow a flexbox version of
// this would produce): each normal entry reserves 80px, the grouped Bajaj
// entry reserves more to fit its header + 3 sub-roles + 2-line blurb.
const rowHeights = [80, 80, 182, 80];
let top = 36;
const rows = rowHeights.map(h => {
  const row = { top, height: h, centerY: top + h / 2 };
  top += h;
  return row;
});

function palette(theme) {
  return theme === "dark"
    ? {
        bg: "#0d1117",
        title: "#e6edf3",
        company: "#818cf8",
        date: "#fb923c",
        blurb: "#8b949e",
        subTitle: "#c9d1d9",
        subRail: "#21262d",
        dotFill: "#0d1117",
        dotStroke: "#818cf8",
        lineFrom: "#818cf8",
        lineTo: "#fb923c",
      }
    : {
        bg: "#ffffff",
        title: "#1f2328",
        company: "#4f46e5",
        date: "#c2410c",
        blurb: "#57606a",
        subTitle: "#24292f",
        subRail: "#d0d7de",
        dotFill: "#ffffff",
        dotStroke: "#4f46e5",
        lineFrom: "#4f46e5",
        lineTo: "#c2410c",
      };
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSvg(theme) {
  const c = palette(theme);
  const firstY = rows[0].centerY;
  const lastY = rows[rows.length - 1].centerY;
  const lineLength = lastY - firstY;

  let defs = `<linearGradient id="rail-${theme}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c.lineFrom}"/>
      <stop offset="100%" stop-color="${c.lineTo}"/>
    </linearGradient>`;

  let style = `
    .dot-${theme} { transform-box: fill-box; transform-origin: center; animation-name: pop; animation-duration: 0.35s; animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); animation-fill-mode: both; }
    .fade-${theme} { animation-name: fadein; animation-duration: 0.5s; animation-timing-function: ease-out; animation-fill-mode: both; }
    .subfade-${theme} { animation-name: fadein-sub; animation-duration: 0.35s; animation-timing-function: ease-out; animation-fill-mode: both; }
    #line-${theme} { stroke-dasharray: ${lineLength}; stroke-dashoffset: ${lineLength}; animation: draw-${theme} ${LINE_DURATION}s cubic-bezier(0.45,0,0.55,1) both; }
    @keyframes draw-${theme} { to { stroke-dashoffset: 0; } }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
    @keyframes fadein { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fadein-sub { from { opacity: 0; } to { opacity: 1; } }
  `;

  let body = "";
  entries.forEach((entry, i) => {
    const row = rows[i];
    const atLine = ((row.centerY - firstY) / lineLength) * LINE_DURATION;

    body += `<circle class="dot-${theme}" cx="${RAIL_X}" cy="${row.centerY}" r="8" fill="${c.dotFill}" stroke="${c.dotStroke}" stroke-width="2" style="animation-delay:${atLine.toFixed(2)}s"/>\n`;

    const titleBaseline = row.top + 14 + 18;
    let titleSpans = `${esc(entry.title)} `;
    if (entry.company) {
      titleSpans += `<tspan fill="${c.company}" font-weight="600">@ ${esc(entry.company)}</tspan> `;
    }
    titleSpans += `<tspan font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" fill="${c.date}"> ${esc(entry.dates)}</tspan>`;

    body += `<g class="fade-${theme}" style="animation-delay:${(atLine + 0.05).toFixed(2)}s">\n`;
    body += `<text x="${TEXT_X}" y="${titleBaseline}" font-size="21" font-weight="700" fill="${c.title}">${titleSpans}</text>\n`;

    let cursorY = titleBaseline;

    if (entry.subRoles) {
      const railTop = titleBaseline + 10;
      const rowH = 24;
      const railBottom = railTop + entry.subRoles.length * rowH - rowH + 8;
      body += `<line x1="${TEXT_X + 8}" y1="${railTop}" x2="${TEXT_X + 8}" y2="${railBottom}" stroke="${c.subRail}" stroke-width="2"/>\n`;

      entry.subRoles.forEach((sr, si) => {
        const y = railTop + si * rowH + 12;
        body += `<g class="subfade-${theme}" style="animation-delay:${(atLine + 0.25 + si * 0.1).toFixed(2)}s">`;
        body += `<circle cx="${TEXT_X + 8}" cy="${y - 4}" r="4" fill="${c.company}"/>`;
        body += `<text x="${TEXT_X + 24}" y="${y}" font-size="14" font-weight="600" fill="${c.subTitle}">${esc(sr.title)} <tspan font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="${c.date}">${esc(sr.dates)}</tspan></text>`;
        body += `</g>\n`;
      });
      cursorY = railBottom + 10;
    }

    const blurbStartY = entry.subRoles ? cursorY + 12 : titleBaseline + 26;
    entry.blurbLines.forEach((line, li) => {
      body += `<text x="${TEXT_X}" y="${blurbStartY + li * 18}" font-size="14" fill="${c.blurb}">${esc(line)}</text>\n`;
    });

    body += `</g>\n`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <defs>${defs}</defs>
  <style>${style}</style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${c.bg}"/>
  <line id="line-${theme}" x1="${RAIL_X}" y1="${firstY}" x2="${RAIL_X}" y2="${lastY}" stroke="url(#rail-${theme})" stroke-width="2" stroke-linecap="round"/>
  ${body}
</svg>`;
}

fs.writeFileSync(path.join(__dirname, "job-timeline-dark.svg"), buildSvg("dark"));
fs.writeFileSync(path.join(__dirname, "job-timeline-light.svg"), buildSvg("light"));
console.log("Generated job-timeline-dark.svg and job-timeline-light.svg");

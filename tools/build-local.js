// Writes complete, standalone copies of the artifact pages:
//   local/  for opening by double-clicking (git-ignored)
//   docs/   for GitHub Pages: the game is index.html and the analysis is analysis.html
// The artifact files leave out the document skeleton (the artifact host adds it), so this adds it back,
// and rewrites the links between the two pages to point at the copies instead of the private artifact URLs.
// Usage: node tools/build-local.js
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const GAME_URL = "https://claude.ai/artifact/2gGbnXZDqvGNfo3MqqSHhy";
const ANALYSIS_URL = "https://claude.ai/artifact/UbGLFkAFw8cgxGhL3ueAQE";
const TARGETS = [
  { dir: "local", game: "tension-score.html", analysis: "tension-score-analysis.html" },
  { dir: "docs", game: "index.html", analysis: "analysis.html" }
];
const head = title => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${title}: a graphical notation for tension in games.">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
`;
for (const t of TARGETS) {
  const out = path.join(ROOT, t.dir);
  fs.mkdirSync(out, { recursive: true });
  const relink = html => html.split(`href="${GAME_URL}"`).join(`href="${t.game}"`).split(`href="${ANALYSIS_URL}"`).join(`href="${t.analysis}"`);
  for (const [src, dest, title] of [["tension-score.html", t.game, "Tension Score"], ["tension-score-analysis.html", t.analysis, "Tension Score Analysis"]]) {
    const body = relink(fs.readFileSync(path.join(ROOT, src), "utf8"));
    const file = path.join(out, dest);
    fs.writeFileSync(file, head(title) + body + "\n</body>\n</html>\n");
    console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
  }
  if (t.dir === "docs") fs.writeFileSync(path.join(out, ".nojekyll"), ""); // serve files as they are
}

// Writes standalone copies of the artifact pages to local/, ready to open by double-clicking.
// The artifact files leave out the document skeleton (the artifact host adds it), so this adds it back.
// Usage: node tools/build-local.js
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "local");
const PAGES = [
  { src: "tension-score.html", out: "tension-score.html" },
  { src: "tension-score-analysis.html", out: "tension-score-analysis.html",
    // Link to the local game page, not the private artifact URL.
    fix: html => html.replace('href="https://claude.ai/artifact/2gGbnXZDqvGNfo3MqqSHhy"', 'href="tension-score.html"') }
];
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
`;
fs.mkdirSync(OUT, { recursive: true });
for (const p of PAGES) {
  let body = fs.readFileSync(path.join(ROOT, p.src), "utf8");
  if (p.fix) body = p.fix(body);
  const file = path.join(OUT, p.out);
  fs.writeFileSync(file, head + body + "\n</body>\n</html>\n");
  console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

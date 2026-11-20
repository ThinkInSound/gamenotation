// Inlines data/arena-analysis.json into analysis/template.html and writes tension-score-analysis.html.
// Usage: node tools/build-analysis.js
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const tpl = fs.readFileSync(path.join(ROOT, "analysis", "template.html"), "utf8");
const data = fs.readFileSync(path.join(ROOT, "data", "arena-analysis.json"), "utf8").replace(/</g, "\\u003c");
if (!tpl.includes("__DATA__")) throw new Error("template has no __DATA__ placeholder");
const out = path.join(ROOT, "tension-score-analysis.html");
fs.writeFileSync(out, tpl.replace("__DATA__", () => data));
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

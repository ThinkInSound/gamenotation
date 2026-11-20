// Rewrites non-ASCII characters as escapes so a page displays correctly however it is opened
// (as an artifact, straight from disk, or from GitHub), even when the browser cannot tell the file's encoding.
//   inside <script> blocks:  \uXXXX   (valid in JS strings, template literals, regexes and comments)
//   inside <style> blocks:   \XXXX    (CSS escape, followed by a space)
//   everywhere else (HTML):  &#xXXXX;
// Usage: node tools/ascii-safe.js file.html [more.html ...]   (rewrites in place; prints what changed)
"use strict";
const fs = require("fs");
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8");
  let out = "", i = 0, changed = 0;
  const re = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const esc = (text, kind) => text.replace(/[^\x00-\x7F]/gu, ch => {
    changed++;
    const cp = ch.codePointAt(0);
    if (kind === "script") return cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, "0")}`;
    if (kind === "style") return `\\${cp.toString(16)} `;
    return `&#x${cp.toString(16)};`;
  });
  let m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(i, m.index), "html");
    const open = m[0].slice(0, m[0].indexOf(">") + 1), close = `</${m[1]}>`;
    out += open + esc(m[2], m[1].toLowerCase()) + close;
    i = m.index + m[0].length;
  }
  out += esc(src.slice(i), "html");
  fs.writeFileSync(file, out);
  console.log(`${file}: ${changed} character(s) escaped`);
}

// Post-build: adds a strict Content Security Policy to every exported HTML page, as a <meta> tag.
// A static export has no server to generate nonces, so each page's inline scripts (Next's bootstrap) are allowed
// by their SHA-256 hash; everything else must come from the site itself. Directives that a <meta> policy cannot
// carry (frame-ancestors) are sent as HTTP headers by vercel.json.
//
// Usage: node scripts/csp.mjs [dir=out]  (runs as part of `npm run build`)
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "out");

const POLICY = {
  "default-src": ["'self'"],
  // 'wasm-unsafe-eval': compiling WebAssembly (MediaPipe, Draco); no JavaScript eval is allowed.
  "script-src": ["'self'", "'wasm-unsafe-eval'"],
  // Draco decodes in a Worker created from a Blob URL (three's DRACOLoader).
  "worker-src": ["'self'", "blob:"],
  // MediaPipe's WASM binary is handed over as a Blob URL after a progress-tracked download.
  "connect-src": ["'self'", "blob:"],
  // Cart thumbnails and captured photos are data:/blob: URLs.
  "img-src": ["'self'", "data:", "blob:"],
  "media-src": ["'self'", "blob:"],
  // React and three set inline styles (canvas sizing, animated panels).
  "style-src": ["'self'", "'unsafe-inline'"],
  "font-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
};

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) out.push(path);
  }
  return out;
}

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g;

for (const file of await htmlFiles(root)) {
  let html = await readFile(file, "utf8");
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT)) {
    // Data blocks (JSON-LD) are never executed, so script-src does not apply to them.
    if (/type="application\/(ld\+)?json"/.test(attrs)) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  const directives = Object.entries(POLICY).map(([name, values]) =>
    [name, ...values, ...(name === "script-src" ? hashes : [])].join(" "),
  );
  const meta = `<meta http-equiv="Content-Security-Policy" content="${directives.join("; ")}"/>`;
  // The policy must precede every script: right after <meta charSet>, which Next always emits first in <head>.
  const at = html.search(/<meta charSet="utf-8"\/>/i);
  if (at < 0) throw new Error(`[csp] ${file}: no <meta charSet> to anchor the policy`);
  const end = html.indexOf(">", at) + 1;
  html = html.slice(0, end) + meta + html.slice(end);
  await writeFile(file, html);
  console.log(`[csp] ${file.slice(root.length + 1)}: ${hashes.size} inline script hash(es)`);
}

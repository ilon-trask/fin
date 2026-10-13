import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
execFileSync("npx", ["expo", "export", "--platform", "web"], { stdio: "inherit" });
function files(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? files(join(directory, entry.name), relative) : [relative];
  });
}
const assets = files("dist").filter((file) => !file.endsWith(".map") && !["/sw.js", "/_headers"].includes(file));
const hash = createHash("sha256");
for (const asset of assets) hash.update(readFileSync(`dist${asset}`));
const version = hash.digest("hex").slice(0, 16);
writeFileSync("dist/sw.js", `
const CACHE = 'fin-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fin-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(url.pathname);
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) { if (event.request.mode === 'navigate') return await cache.match('/index.html'); throw error; }
  }));
});
`);
// Netlify / Cloudflare Pages format; other hosts need the same two headers.
writeFileSync("dist/_headers", "/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: credentialless\n/sw.js\n  Cache-Control: no-cache\n");
console.log(`Offline app shell generated (${assets.length} assets).`);

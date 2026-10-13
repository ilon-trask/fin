import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createSyncStore } from "./store";
import { createApp } from "./app";

const token = process.env.SYNC_TOKEN;
if (!token || token.length < 32) throw new Error("Set SYNC_TOKEN to a random secret of at least 32 characters");
const filename = process.env.SYNC_DATABASE ?? "./server-data/fin.db";
mkdirSync(dirname(filename), { recursive: true });
const store = createSyncStore(filename);
const app = createApp(store, token, process.env.SYNC_ALLOWED_ORIGIN);
if (process.env.WEB_DIST) {
  app.use("*", async (c, next) => {
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    c.header("Cross-Origin-Embedder-Policy", "credentialless");
    if (c.req.path === "/sw.js") c.header("Cache-Control", "no-cache");
    await next();
  });
  app.get("*", serveStatic({ root: process.env.WEB_DIST, rewriteRequestPath: (path) => path === "/" ? "/index.html" : path }));
}
const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3001), hostname: process.env.HOST ?? "127.0.0.1" }, () => console.log("Fin Hono sync API listening"));
if ("requestTimeout" in server) server.requestTimeout = 20000;
function shutdown() { server.close(() => { store.close(); process.exit(0); }); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

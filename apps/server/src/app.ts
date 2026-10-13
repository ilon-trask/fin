import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { timingSafeEqual } from "node:crypto";
import { requestSchema } from "@fin/shared";
import type { createSyncStore } from "./store";

export function createApp(store: ReturnType<typeof createSyncStore>, token: string, allowedOrigin?: string) {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true }));
  if (allowedOrigin) app.use("/sync", cors({ origin: allowedOrigin, allowMethods: ["POST", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"] }));
  app.use("/sync", async (c, next) => {
    const provided = Buffer.from(c.req.header("Authorization") ?? "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return c.json({ error: "Unauthorized" }, 401);
    await next();
  });
  app.post("/sync", bodyLimit({ maxSize: 2_000_000, onError: (c) => c.json({ error: "Request too large" }, 413) }), async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Invalid sync request" }, 400);
    try { return c.json(store.sync(parsed.data)); }
    catch (error) {
      if (error instanceof Error && /Cursor exceeds|Operation ID was reused/.test(error.message)) return c.json({ error: error.message }, 409);
      throw error;
    }
  });
  app.onError((error, c) => { console.error("Sync request failed", error.message); return c.json({ error: "Sync server error" }, 500); });
  return app;
}

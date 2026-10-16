import { requestSchema } from "@fin/shared";
import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { SyncConflictError } from "./errors";
import type { createSyncStore } from "./store";

const MAX_REQUEST_BYTES = 2_000_000;

function hasValidToken(header: string | undefined, token: string): boolean {
  const provided = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function createApp(
  store: ReturnType<typeof createSyncStore>,
  token: string,
  allowedOrigin?: string,
) {
  const app = new Hono();
  app.get("/health", (context) => context.json({ ok: true }));

  if (allowedOrigin) {
    app.use("/sync", cors({
      origin: allowedOrigin,
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }));
  }

  app.use("/sync", async (context, next) => {
    if (!hasValidToken(context.req.header("Authorization"), token)) {
      return context.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  app.post("/sync", bodyLimit({
    maxSize: MAX_REQUEST_BYTES,
    onError: (context) => context.json({ error: "Request too large" }, 413),
  }), async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "Invalid JSON" }, 400);
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return context.json({ error: "Invalid sync request" }, 400);
    try {
      return context.json(store.sync(parsed.data));
    } catch (error) {
      if (error instanceof SyncConflictError) {
        return context.json({ error: error.message }, 409);
      }
      throw error;
    }
  });

  app.onError((error, context) => {
    console.error("Sync request failed", error.message);
    return context.json({ error: "Sync server error" }, 500);
  });
  return app;
}

import { Hono } from "hono";
import { ok } from "../lib/response.js";
import type { AppEnv } from "../lib/types.js";

const startTime = Date.now();

export function healthRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", (c) => {
    return ok(c, {
      status: "ok",
      version: "0.0.0",
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  return app;
}

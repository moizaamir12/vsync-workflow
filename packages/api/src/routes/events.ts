import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth } from "@vsync/auth";
import type { WSManager, WSLike } from "../ws/manager.js";
import type { AppEnv } from "../lib/types.js";

/**
 * SSE fallback for clients that cannot use WebSocket
 * (restrictive firewalls, HTTP/1.1-only proxies, etc.).
 *
 * Clients connect to GET /events?channels=run:abc,org:xyz
 * and receive the same events they would over WS, serialised
 * as Server-Sent Events with the event type as the SSE `event` field.
 */
export function eventRoutes(auth: AuthInstance, wsManager: WSManager) {
  const app = new Hono<AppEnv>();

  app.get("/", requireAuth(auth), async (c) => {
    const authCtx = c.get("auth");
    // TODO(validation): Validate channel names to prevent clients from subscribing to arbitrary internal channels.
    const channelsParam = c.req.query("channels") ?? "";
    const channels = channelsParam
      .split(",")
      .map((ch) => ch.trim())
      .filter(Boolean);

    if (channels.length === 0) {
      return c.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "At least one channel is required via ?channels= query param" },
          meta: undefined,
        },
        400,
      );
    }

    return streamSSE(c, async (stream) => {
      /**
       * Create a lightweight WSLike adapter that bridges
       * the WSManager broadcast mechanism to SSE writes.
       * This avoids duplicating broadcast logic.
       */
      const sseAdapter: WSLike = {
        readyState: 1,
        send(data: string) {
          /* Parse the event to use its type as the SSE event field */
          try {
            const event = JSON.parse(data) as { type?: string };
            stream.writeSSE({
              event: event.type ?? "message",
              data,
            }).catch(() => {
              /* Stream closed — will be cleaned up on next broadcast */
            });
          } catch {
            stream.writeSSE({ event: "message", data }).catch(() => {});
          }
        },
      };

      /* Register as a normal client so broadcasts reach it */
      wsManager.register(sseAdapter, {
        userId: authCtx.userId,
        orgId: authCtx.orgId,
        channels: new Set(channels),
      });

      /* Send a connected confirmation */
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          userId: authCtx.userId,
          channels,
          timestamp: new Date().toISOString(),
        }),
      });

      /**
       * Keep the stream open with periodic heartbeats.
       * The stream closes when the client disconnects or
       * after 10 minutes (server-side timeout).
       */
      const maxIterations = 600;
      for (let i = 0; i < maxIterations; i++) {
        if (stream.aborted) break;

        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ ts: Date.now() }),
        });

        await stream.sleep(1000);
      }

      /* Clean up when stream ends */
      wsManager.unregister(sseAdapter);
    });
  });

  return app;
}

import { z } from "zod";
import type { WSManager, WSLike } from "./manager.js";

/**
 * Inbound message schema.
 * Clients send JSON messages to subscribe/unsubscribe from channels
 * or to send actions that get routed through the run system.
 */
const InboundMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    channel: z.string().min(1),
  }),
  z.object({
    type: z.literal("unsubscribe"),
    channel: z.string().min(1),
  }),
  z.object({
    type: z.literal("ping"),
  }),
]);

type InboundMessage = z.infer<typeof InboundMessageSchema>;

/**
 * Handle an incoming WebSocket message.
 *
 * Messages are validated with Zod. Invalid messages are silently
 * ignored (logging them would let malicious clients spam server logs).
 * The handler keeps subscribe/unsubscribe as pure state management —
 * no DB calls or side effects beyond pub/sub bookkeeping.
 */
export function handleMessage(
  manager: WSManager,
  ws: WSLike,
  raw: string | ArrayBuffer,
): void {
  const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* Not valid JSON — ignore */
    return;
  }

  const result = InboundMessageSchema.safeParse(parsed);
  if (!result.success) return;

  const msg: InboundMessage = result.data;

  switch (msg.type) {
    case "subscribe":
      manager.subscribe(ws, msg.channel);
      safeSend(ws, { type: "subscribed", channel: msg.channel });
      break;

    case "unsubscribe":
      manager.unsubscribe(ws, msg.channel);
      safeSend(ws, { type: "unsubscribed", channel: msg.channel });
      break;

    case "ping":
      safeSend(ws, { type: "pong", timestamp: new Date().toISOString() });
      break;
  }
}

/**
 * Called when a WebSocket connection closes (clean or unclean).
 * Ensures all subscriptions are freed.
 */
export function handleDisconnect(manager: WSManager, ws: WSLike): void {
  manager.unregister(ws);
}

/* ── Helpers ─────────────────────────────────────────────────── */

/** Send a JSON payload, swallowing errors for closed sockets. */
function safeSend(ws: WSLike, data: Record<string, unknown>): void {
  try {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  } catch {
    /* Socket may have closed between the readyState check and send */
  }
}

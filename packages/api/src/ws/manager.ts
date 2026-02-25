import type { WSEvent } from "@vsync/shared-types";

/**
 * Minimal interface so the manager works with any WebSocket-like
 * object (native WS, Hono upgradeWebSocket result, or test doubles).
 * Only `send` and `readyState` are required for broadcasting.
 */
export interface WSLike {
  readonly readyState: number;
  send(data: string): void;
}

/** Metadata attached to each connected client. */
export interface ClientMeta {
  /** Authenticated user ID — null for unauthenticated connections */
  userId: string | null;
  /** Organization the client belongs to */
  orgId: string | null;
  /** Set of channel keys this client is subscribed to */
  channels: Set<string>;
}

/**
 * Channel-based WebSocket pub/sub manager.
 *
 * Channels follow a hierarchical naming convention:
 *   - `org:<orgId>`             — all events for an organisation
 *   - `run:<runId>`             — events scoped to a single run
 *   - `workflow:<workflowId>`   — workflow-level changes
 *
 * The manager is intentionally a plain class (not a singleton)
 * so tests can create isolated instances. The app factory creates
 * one instance and threads it through route constructors.
 */
export class WSManager {
  /** channel → set of connected sockets */
  private channels = new Map<string, Set<WSLike>>();
  /** socket → client metadata */
  private clients = new Map<WSLike, ClientMeta>();

  /* ── Connection lifecycle ────────────────────────────────── */

  /** Register a new WebSocket client. */
  register(ws: WSLike, meta: ClientMeta): void {
    this.clients.set(ws, meta);

    /* Auto-subscribe to initial channels */
    for (const ch of meta.channels) {
      this.subscribe(ws, ch);
    }
  }

  /** Remove a client and clean up all its subscriptions. */
  unregister(ws: WSLike): void {
    const meta = this.clients.get(ws);
    if (meta) {
      for (const ch of meta.channels) {
        this.channels.get(ch)?.delete(ws);
        /* Remove empty channel sets to avoid memory leaks */
        if (this.channels.get(ch)?.size === 0) {
          this.channels.delete(ch);
        }
      }
    }
    this.clients.delete(ws);
  }

  /* ── Subscription management ─────────────────────────────── */

  /** Subscribe a socket to a named channel. */
  subscribe(ws: WSLike, channel: string): void {
    let sockets = this.channels.get(channel);
    if (!sockets) {
      sockets = new Set();
      this.channels.set(channel, sockets);
    }
    sockets.add(ws);

    /* Keep the client metadata in sync */
    const meta = this.clients.get(ws);
    if (meta) meta.channels.add(channel);
  }

  /** Unsubscribe a socket from a named channel. */
  unsubscribe(ws: WSLike, channel: string): void {
    this.channels.get(channel)?.delete(ws);
    if (this.channels.get(channel)?.size === 0) {
      this.channels.delete(channel);
    }

    const meta = this.clients.get(ws);
    if (meta) meta.channels.delete(channel);
  }

  /* ── Broadcasting ────────────────────────────────────────── */

  /**
   * Send an event to every connected client on the given channel.
   * Sockets that are no longer OPEN are silently skipped and cleaned up.
   */
  broadcast(channel: string, event: WSEvent): void {
    const sockets = this.channels.get(channel);
    if (!sockets) return;

    const payload = JSON.stringify(event);

    for (const ws of sockets) {
      /* readyState 1 === WebSocket.OPEN */
      if (ws.readyState === 1) {
        ws.send(payload);
      } else {
        /* Stale socket — remove it */
        this.unregister(ws);
      }
    }
  }

  /**
   * Convenience: broadcast the same event to multiple channels at once.
   * Useful when a run event should land in both `run:<id>` and `org:<orgId>`.
   */
  broadcastToMany(channels: string[], event: WSEvent): void {
    for (const ch of channels) {
      this.broadcast(ch, event);
    }
  }

  /* ── Introspection (useful for tests and admin) ──────────── */

  /** Return the number of active client connections. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Return the number of active channels. */
  get channelCount(): number {
    return this.channels.size;
  }

  /** Return the number of subscribers on a given channel. */
  subscriberCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }

  /** Get the metadata for a connected socket. */
  getClientMeta(ws: WSLike): ClientMeta | undefined {
    return this.clients.get(ws);
  }
}

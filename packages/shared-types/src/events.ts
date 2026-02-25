/**
 * Discriminated event types broadcast over WebSocket connections.
 * Clients subscribe to these to drive real-time UI updates
 * (run progress, workflow changes, etc.).
 */
export type WSEventType =
  | "run:started"
  | "run:step"
  | "run:completed"
  | "run:failed"
  | "run:awaiting_action"
  | "workflow:updated"
  | "workflow:deleted";

/**
 * Envelope for all WebSocket messages.
 * The `type` field lets clients route payloads to the correct handler
 * without inspecting the payload itself.
 */
export interface WSEvent {
  /** Event discriminator — determines how `payload` should be interpreted */
  type: WSEventType;

  /** Event-specific data — shape varies by `type` */
  payload: unknown;

  /** ISO-8601 timestamp of when the event was emitted */
  timestamp: string;
}

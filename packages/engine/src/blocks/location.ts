import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * Location block executor.
 *
 * Operations:
 * - get_coordinates: Delegate to adapter.getLocation()
 * - distance: Haversine formula between two {lat, lng} points
 * - verify: Check if coordinates are within radius of target
 *
 * Binding: location_bind_value → $state.key
 */
export async function locationExecutor(
  block: Block,
  context: WorkflowContext,
  adapter?: { getLocation: () => Promise<{ lat: number; lng: number }> },
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;
  const operation = resolveDynamic(cm, logic.location_operation, context) as string;

  let result: unknown;

  switch (operation) {
    case "get_coordinates": {
      if (!adapter) {
        throw new Error(
          "Location get_coordinates requires a platform adapter with getLocation(). " +
          "No adapter was provided.",
        );
      }
      result = await adapter.getLocation();
      break;
    }
    case "distance": {
      result = executeDistance(cm, logic, context);
      break;
    }
    case "verify": {
      result = executeVerify(cm, logic, context);
      break;
    }
    default:
      throw new Error(`Unknown location operation: "${operation}"`);
  }

  const bindTo = logic.location_bind_value as string | undefined;
  if (bindTo) {
    return { stateDelta: { [extractBindKey(bindTo)]: result } };
  }
  return {};
}

/* ── Distance (Haversine) ────────────────────────────── */

/** Earth's mean radius in km */
const EARTH_RADIUS_KM = 6_371;

/** Conversion factors from km to other units */
const UNIT_FACTORS: Record<string, number> = {
  km: 1,
  mi: 0.621_371,
  m: 1_000,
  ft: 3_280.84,
};

/**
 * Haversine distance between two {lat, lng} points.
 * Returns distance in the requested unit (default: km).
 * Exported for testing.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit = "km",
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = EARTH_RADIUS_KM * c;

  const factor = UNIT_FACTORS[unit];
  if (!factor) throw new Error(`Unknown distance unit: "${unit}"`);

  return distanceKm * factor;
}

function executeDistance(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): { distance: number; unit: string } {
  const from = resolveCoordinates(cm, logic, context, "location_from");
  const to = resolveCoordinates(cm, logic, context, "location_to");
  const unit = String(resolveDynamic(cm, logic.location_unit, context) ?? "km");

  const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng, unit);

  return { distance, unit };
}

/* ── Verify (within radius) ──────────────────────────── */

function executeVerify(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): { within: boolean; distance: number; unit: string } {
  const currentCoords = resolveCoordinates(cm, logic, context, "location_current");
  const targetLat = Number(resolveDynamic(cm, logic.location_target_lat, context) ?? 0);
  const targetLng = Number(resolveDynamic(cm, logic.location_target_lng, context) ?? 0);
  const radius = Number(resolveDynamic(cm, logic.location_radius, context) ?? 0);
  const unit = String(resolveDynamic(cm, logic.location_radius_unit, context) ?? "km");

  const distance = haversineDistance(
    currentCoords.lat,
    currentCoords.lng,
    targetLat,
    targetLng,
    unit,
  );

  return {
    within: distance <= radius,
    distance,
    unit,
  };
}

/* ── Helpers ──────────────────────────────────────────── */

function resolveCoordinates(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
  prefix: string,
): { lat: number; lng: number } {
  const raw = resolveDynamic(cm, logic[prefix], context);

  /* Support object format { lat, lng } */
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      lat: Number(obj.lat ?? 0),
      lng: Number(obj.lng ?? 0),
    };
  }

  /* Support separate lat/lng fields */
  return {
    lat: Number(resolveDynamic(cm, logic[`${prefix}_lat`], context) ?? 0),
    lng: Number(resolveDynamic(cm, logic[`${prefix}_lng`], context) ?? 0),
  };
}

function resolveDynamic(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  return cm.resolveValue(value, context);
}

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}

import type { BlockSchema } from "./types.js";

export const LOCATION_SCHEMA: BlockSchema = {
  required: ["location_operation"],
  optional: {
    location_bind_value: { default: null },
    /* distance */
    location_from: { default: null },
    location_from_lat: { default: null },
    location_from_lng: { default: null },
    location_to: { default: null },
    location_to_lat: { default: null },
    location_to_lng: { default: null },
    location_unit: { default: "km", enum: ["km", "mi", "m", "ft"] },
    /* verify */
    location_current: { default: null },
    location_current_lat: { default: null },
    location_current_lng: { default: null },
    location_target_lat: { default: null },
    location_target_lng: { default: null },
    location_radius: { default: 0 },
    location_radius_unit: { default: "km", enum: ["km", "mi", "m", "ft"] },
  },
  commonMistakes: {
    operation: "location_operation",
    lat: "location_from_lat",
    lng: "location_from_lng",
    radius: "location_radius",
    unit: "location_unit",
    bind_value: "location_bind_value",
  },
} as const;

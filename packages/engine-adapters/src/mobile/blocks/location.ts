import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "@vsync/engine";
import { ContextManager } from "@vsync/engine";

/**
 * Type stubs for expo-location.
 * expo-location is an optional peer dep installed in the host RN project.
 */
interface LocationResult {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

interface PermissionResponse {
  status: string;
}

/**
 * Mobile location block executor using expo-location.
 *
 * Requests foreground permissions and returns high-accuracy GPS coordinates.
 * Bind result to location_bind_value.
 */
export async function mobileLocationExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  /* Dynamically import expo-location at runtime */
  let Location: {
    requestForegroundPermissionsAsync: () => Promise<PermissionResponse>;
    getCurrentPositionAsync: (
      options: { accuracy: number },
    ) => Promise<LocationResult>;
    Accuracy: { High: number };
  };

  try {
    Location = await import("expo-location");
  } catch {
    throw new Error(
      "expo-location is required for mobile location services. " +
      "Install it with: npx expo install expo-location",
    );
  }

  /* Request permissions */
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission denied by user");
  }

  /* Get current position with high accuracy */
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const result = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };

  const bindTo = logic.location_bind_value as string | undefined;
  if (bindTo) {
    return { stateDelta: { [extractBindKey(bindTo)]: result } };
  }
  return {};
}

/* ── Helpers ──────────────────────────────────────────── */

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}

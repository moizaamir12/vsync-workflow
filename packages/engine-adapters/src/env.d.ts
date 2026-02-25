/**
 * Ambient module declarations for optional peer dependencies.
 *
 * These packages are only available in the host React Native / Expo
 * project at runtime. The type stubs here let TypeScript resolve the
 * dynamic import() calls without requiring the packages be installed.
 */

declare module "expo-location" {
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

  export function requestForegroundPermissionsAsync(): Promise<PermissionResponse>;
  export function getCurrentPositionAsync(options: {
    accuracy: number;
  }): Promise<LocationResult>;

  export const Accuracy: { High: number };
}

declare module "expo-image-manipulator" {
  interface ManipulateAction {
    rotate?: number;
    flip?: { horizontal?: boolean; vertical?: boolean };
    crop?: { originX: number; originY: number; width: number; height: number };
    resize?: { width?: number; height?: number };
  }

  interface SaveOptions {
    compress?: number;
    format?: string;
  }

  interface ManipulateResult {
    uri: string;
    width: number;
    height: number;
  }

  export function manipulateAsync(
    uri: string,
    actions: ManipulateAction[],
    saveOptions?: SaveOptions,
  ): Promise<ManipulateResult>;
}

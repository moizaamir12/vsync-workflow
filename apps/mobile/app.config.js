/** @type {import("expo/config").ExpoConfig} */
const config = {
  name: "V Sync",
  slug: "vsync",
  version: "0.1.0",
  scheme: "vsync",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",

  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0f172a",
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: "io.vsync.mobile",
    infoPlist: {
      NSCameraUsageDescription:
        "V Sync uses the camera for photo capture and barcode scanning in workflow blocks.",
      NSLocationWhenInUseUsageDescription:
        "V Sync uses your location for location-based workflow blocks.",
      NSPhotoLibraryUsageDescription:
        "V Sync needs photo library access to save captured images.",
    },
  },

  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#0f172a",
    },
    package: "io.vsync.mobile",
    permissions: [
      "CAMERA",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
    ],
  },

  web: {
    bundler: "metro",
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-camera",
      {
        cameraPermission:
          "V Sync uses the camera for photo capture and barcode scanning.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "V Sync uses your location for location-based workflow blocks.",
      },
    ],
    [
      "expo-image-manipulator",
      {
        photosPermission:
          "V Sync needs photo library access to save captured images.",
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },
};

module.exports = config;

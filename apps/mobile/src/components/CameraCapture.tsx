import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { UICameraConfig } from "@vsync/shared-types";

/**
 * Camera component for photo capture and barcode scanning.
 *
 * Dynamically imports expo-camera so the rest of the app compiles
 * even in environments where the native module isn't linked.
 */

interface CameraCaptureProps {
  config: UICameraConfig;
  onCapture: (result: { uri?: string; barcode?: string }) => void;
  onCancel: () => void;
}

export function CameraCapture({ config, onCapture, onCancel }: CameraCaptureProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [CameraModule, setCameraModule] = useState<{
    CameraView: React.ComponentType<Record<string, unknown>>;
  } | null>(null);
  const cameraRef = useRef<{ takePictureAsync?: () => Promise<{ uri: string }> }>(null);
  const [loading, setLoading] = useState(true);

  /* Request permissions and load the camera module on mount */
  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const cam = await import("expo-camera");
        const { status } = await cam.Camera.requestCameraPermissionsAsync();
        if (mounted) {
          setHasPermission(status === "granted");
          setCameraModule({ CameraView: cam.CameraView as unknown as React.ComponentType<Record<string, unknown>> });
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setHasPermission(false);
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current?.takePictureAsync) return;
    const photo = await cameraRef.current.takePictureAsync();
    onCapture({ uri: photo.uri });
  }, [onCapture]);

  const handleBarcodeScan = useCallback(
    (event: { data: string }) => {
      onCapture({ barcode: event.data });
    },
    [onCapture],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!hasPermission || !CameraModule) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Camera permission denied</Text>
        <TouchableOpacity style={styles.button} onPress={onCancel}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { CameraView } = CameraModule;

  return (
    <View style={styles.container}>
      {config.instructions ? (
        <Text style={styles.instructions}>{config.instructions}</Text>
      ) : null}

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        flash={config.flash}
        onBarcodeScanned={config.mode === "barcode" ? handleBarcodeScan : undefined}
        barcodeScannerSettings={
          config.mode === "barcode"
            ? { barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a"] }
            : undefined
        }
      />

      <View style={styles.controls}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>

        {config.mode === "photo" && (
          <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  camera: { flex: 1 },
  instructions: {
    color: "#fff",
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#374151",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#6366f1",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  loadingText: { marginTop: 12, color: "#9ca3af", fontSize: 14 },
  errorText: { color: "#ef4444", fontSize: 16, marginBottom: 12 },
});

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "../../../src/services/api";
import { mapBlockLogicToUIConfig } from "@vsync/shared-types";
import type { Block, Step, UIBlockConfig } from "@vsync/shared-types";
import {
  getExecutionStrategy,
  executeLocally,
} from "../../../src/engine/mobile-engine";
import { RunProgress } from "../../../src/components/RunProgress";
import { CameraCapture } from "../../../src/components/CameraCapture";
import { FormRenderer } from "../../../src/components/FormRenderer";
import { TableRenderer } from "../../../src/components/TableRenderer";
import { DetailsRenderer } from "../../../src/components/DetailsRenderer";

interface ActiveVersionData {
  version: { version: number; status: string };
  blocks: Block[];
}

/**
 * Execute a workflow — shows step progress, handles UI block interactions.
 */
export default function WorkflowRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [versionNum, setVersionNum] = useState(1);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [uiConfig, setUiConfig] = useState<UIBlockConfig | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Load the active version and its blocks */
  useEffect(() => {
    void (async () => {
      const res = await api.get<ActiveVersionData>(`/workflows/${id}/active-version`);
      if (res.data) {
        setBlocks(res.data.blocks);
        setVersionNum(res.data.version.version);
      } else {
        setError(res.error?.message ?? "Failed to load workflow");
      }
      setLoading(false);
    })();
  }, [id]);

  /** Trigger the workflow run. */
  const handleTrigger = useCallback(async () => {
    const strategy = getExecutionStrategy(blocks);
    setRunning(true);
    setSteps([]);
    setError(null);
    setRunStatus("running");

    if (strategy === "local" || strategy === "hybrid") {
      /* Execute on-device */
      try {
        const result = await executeLocally({
          workflowId: id!,
          version: versionNum,
          blocks,
        });

        /* Update progress from the returned steps */
        setSteps(result.steps);
        if (result.steps.length > 0) {
          setCurrentBlockIdx(result.steps.length - 1);
        }

        /* If a UI block paused execution, show its UI */
        if (result.status === "awaiting_action") {
          const lastStep = result.steps[result.steps.length - 1];
          if (lastStep) {
            const block = blocks.find((b) => b.id === lastStep.blockId);
            if (block) {
              const config = mapBlockLogicToUIConfig(
                block.type,
                (block.logic ?? {}) as Record<string, unknown>,
              );
              setUiConfig(config);
            }
          }
        }

        setRunStatus(result.status);
        if (result.error) setError(result.error);
      } catch (err) {
        setRunStatus("failed");
        setError(err instanceof Error ? err.message : "Execution failed");
      }
    } else {
      /* Delegate to cloud API */
      const res = await api.post<{ id: string; status: string }>(
        `/workflows/${id}/trigger`,
      );
      if (res.data) {
        setRunStatus(res.data.status);
        /* Navigate to run detail for real-time updates */
        router.push(`/(tabs)/runs/${res.data.id}`);
      } else {
        setRunStatus("failed");
        setError(res.error?.message ?? "Trigger failed");
      }
    }

    setRunning(false);
  }, [blocks, id, versionNum]);

  /** Handle user response from a UI block (form submit, camera capture). */
  const handleUiResponse = useCallback(
    (response: Record<string, unknown>) => {
      setUiConfig(null);
      /* POST the response to the API to continue the run */
      void api.post(`/runs/current/action`, { response });
    },
    [],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  /* ── Render active UI block ──────────────────────────────── */

  if (uiConfig) {
    switch (uiConfig.kind) {
      case "ui_camera":
        return (
          <CameraCapture
            config={uiConfig}
            onCapture={(result) => handleUiResponse(result)}
            onCancel={() => setUiConfig(null)}
          />
        );
      case "ui_form":
        return <FormRenderer config={uiConfig} onSubmit={handleUiResponse} />;
      case "ui_table":
        return <TableRenderer config={uiConfig} />;
      case "ui_details":
        return <DetailsRenderer config={uiConfig} />;
    }
  }

  /* ── Main view ───────────────────────────────────────────── */

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Run Workflow</Text>
      <Text style={styles.blockCount}>{blocks.length} blocks loaded</Text>

      {/* Run button */}
      {!running && !runStatus && (
        <TouchableOpacity style={styles.triggerButton} onPress={handleTrigger}>
          <Text style={styles.triggerText}>Execute Workflow</Text>
        </TouchableOpacity>
      )}

      {/* Progress */}
      {steps.length > 0 && (
        <RunProgress
          steps={steps}
          currentBlockIndex={currentBlockIdx}
          totalBlocks={blocks.length}
        />
      )}

      {/* Status */}
      {runStatus && (
        <View style={styles.statusContainer}>
          <Text
            style={[
              styles.statusLabel,
              runStatus === "completed"
                ? { color: "#22c55e" }
                : runStatus === "failed"
                  ? { color: "#ef4444" }
                  : { color: "#6366f1" },
            ]}
          >
            {runStatus.toUpperCase()}
          </Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      )}

      {/* Run again */}
      {runStatus && !running && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setRunStatus(null);
            setSteps([]);
            setError(null);
          }}
        >
          <Text style={styles.retryText}>Run Again</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  heading: { fontSize: 24, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  blockCount: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  triggerButton: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  triggerText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  statusContainer: { padding: 16, alignItems: "center", marginTop: 12 },
  statusLabel: { fontSize: 20, fontWeight: "800" },
  errorText: { color: "#f87171", fontSize: 13, marginTop: 8, textAlign: "center" },
  retryButton: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  retryText: { color: "#e2e8f0", fontSize: 15, fontWeight: "500" },
});

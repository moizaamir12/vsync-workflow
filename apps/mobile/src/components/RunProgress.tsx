import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Step } from "@vsync/shared-types";

interface RunProgressProps {
  steps: Step[];
  currentBlockIndex: number;
  totalBlocks: number;
}

/**
 * Step-by-step progress indicator for an active workflow run.
 * Shows completed, active, and pending steps with status colours.
 */
export function RunProgress({ steps, currentBlockIndex, totalBlocks }: RunProgressProps) {
  const progressPct = totalBlocks > 0 ? Math.round(((currentBlockIndex + 1) / totalBlocks) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.barOuter}>
        <View style={[styles.barInner, { width: `${progressPct}%` }]} />
      </View>
      <Text style={styles.progressText}>
        Step {currentBlockIndex + 1} of {totalBlocks} ({progressPct}%)
      </Text>

      {/* Step list */}
      <View style={styles.stepList}>
        {steps.map((step, idx) => (
          <View key={step.stepId ?? idx} style={styles.stepRow}>
            <View style={[styles.dot, dotColor(step.status)]} />
            <View style={styles.stepInfo}>
              <Text style={styles.stepName} numberOfLines={1}>
                {step.blockName ?? `Step ${idx + 1}`}
              </Text>
              <Text style={styles.stepType}>{step.blockType}</Text>
            </View>
            <Text style={[styles.stepStatus, statusColor(step.status)]}>
              {step.status}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function dotColor(status: string) {
  switch (status) {
    case "completed":
      return { backgroundColor: "#22c55e" };
    case "running":
      return { backgroundColor: "#6366f1" };
    case "failed":
      return { backgroundColor: "#ef4444" };
    case "skipped":
      return { backgroundColor: "#f59e0b" };
    default:
      return { backgroundColor: "#475569" };
  }
}

function statusColor(status: string) {
  switch (status) {
    case "completed":
      return { color: "#22c55e" };
    case "running":
      return { color: "#6366f1" };
    case "failed":
      return { color: "#ef4444" };
    case "skipped":
      return { color: "#f59e0b" };
    default:
      return { color: "#475569" };
  }
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  barOuter: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1e293b",
    overflow: "hidden",
    marginBottom: 8,
  },
  barInner: { height: 6, borderRadius: 3, backgroundColor: "#6366f1" },
  progressText: { fontSize: 13, color: "#94a3b8", marginBottom: 16 },
  stepList: { gap: 10 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepInfo: { flex: 1 },
  stepName: { fontSize: 14, color: "#f8fafc", fontWeight: "500" },
  stepType: { fontSize: 12, color: "#64748b" },
  stepStatus: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
});
